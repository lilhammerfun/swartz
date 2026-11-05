use super::types::TutorInput;
use super::*;
use serde_json::{Value, json};
use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
    time::{Duration, Instant},
};

fn request() -> TutorRequest {
    let samples: Value = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/mock-data/tutor-contracts.json"
    )))
    .unwrap();
    serde_json::from_value(samples["requests"]["ordinary"].clone()).unwrap()
}

fn response(text: &str) -> Value {
    json!({"id": "response-test", "object": "response", "model": "test-model", "status": "completed", "output": [
        {"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": text}]}
    ]})
}

/// Real local HTTP boundary: verifies Rig's emitted Responses payload, without credentials or a remote model.
fn provider(replies: Vec<(u16, Value)>) -> (Arc<ModelConnection>, thread::JoinHandle<Vec<Value>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let connection = ModelConnection::for_test(format!(
        "http://{}/gateway/v1",
        listener.local_addr().unwrap()
    ));
    let server = thread::spawn(move || {
        let mut payloads = Vec::new();
        for (status, reply) in replies {
            let deadline = Instant::now() + Duration::from_secs(10);
            let mut socket = loop {
                match listener.accept() {
                    Ok((socket, _)) => break socket,
                    Err(error)
                        if error.kind() == std::io::ErrorKind::WouldBlock
                            && Instant::now() < deadline =>
                    {
                        thread::sleep(Duration::from_millis(2))
                    }
                    Err(error) => panic!("Expected a model request: {error}"),
                }
            };
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            let mut buffer = [0; 4096];
            let body_start = loop {
                let count = socket.read(&mut buffer).unwrap();
                assert_ne!(count, 0, "Request ended before its body");
                bytes.extend_from_slice(&buffer[..count]);
                if let Some(end) = bytes.windows(4).position(|part| part == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..end]);
                    let length = headers
                        .lines()
                        .find_map(|line| {
                            line.to_ascii_lowercase()
                                .strip_prefix("content-length:")
                                .map(str::trim)
                                .and_then(|value| value.parse::<usize>().ok())
                        })
                        .unwrap();
                    if bytes.len() >= end + 4 + length {
                        break end + 4;
                    }
                }
            };
            let headers = String::from_utf8_lossy(&bytes[..body_start]).to_ascii_lowercase();
            assert!(
                headers.starts_with("post /gateway/v1/responses http/1.1"),
                "{headers}"
            );
            assert!(headers.contains("authorization: bearer test-key"));
            payloads.push(serde_json::from_slice(&bytes[body_start..]).unwrap());
            let body = reply.to_string();
            write!(socket, "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        }
        payloads
    });
    (connection, server)
}

#[tokio::test]
async fn agent_is_reused_while_history_and_model_overrides_stay_with_the_run() {
    let (connection, server) = provider(vec![
        (200, response("First answer.")),
        (200, response("Second answer.")),
    ]);
    let service = TutorService::default();
    let original_agent = service.agent(connection.clone()).unwrap();
    let mut first = request();
    first.options =
        serde_json::from_value(json!({"model": "alternate-model", "reasoningEffort": "low"}))
            .unwrap();
    first.history = serde_json::from_value(json!([{"id": "earlier-question", "role": "user", "text": "Only the first run knows this.", "createdAt": "2026-11-05T00:00:00Z"}])).unwrap();
    let lease = service.register("main", &first).unwrap();
    assert_eq!(
        service
            .respond(connection.clone(), &first, None, lease.run.clone())
            .await
            .unwrap(),
        "First answer."
    );
    drop(lease);
    let second = request();
    let lease = service.register("main", &second).unwrap();
    assert_eq!(
        service
            .respond(connection.clone(), &second, None, lease.run.clone())
            .await
            .unwrap(),
        "Second answer."
    );
    drop(lease);
    assert!(Arc::ptr_eq(
        &original_agent,
        &service.agent(connection).unwrap()
    ));
    assert!(service.runs.lock().unwrap().is_empty());
    let payloads = server.join().unwrap();
    assert_eq!(payloads[0]["model"], "alternate-model");
    assert_eq!(payloads[0]["reasoning"]["effort"], "low");
    assert!(
        payloads[0]
            .to_string()
            .contains("Only the first run knows this.")
    );
    assert_eq!(payloads[1]["model"], "test-model");
    assert!(payloads[1].get("reasoning").is_none());
    assert!(
        !payloads[1]
            .to_string()
            .contains("Only the first run knows this.")
    );
    for payload in payloads {
        assert_eq!(payload["store"], false);
        assert_ne!(payload["stream"], true); // Omitted stream uses the Responses API's buffered default.
        let serialized = payload.to_string();
        assert_eq!(
            serialized
                .matches("I'd like an introduction to Rust.")
                .count(),
            1
        );
        assert!(!serialized.contains("attempt-home-1"));
    }
    let changed = ModelConnection::for_test("http://127.0.0.1:1/v1".into());
    assert!(!Arc::ptr_eq(
        &original_agent,
        &service.agent(changed).unwrap()
    ));
}

#[tokio::test]
async fn cancellation_is_scoped_survives_early_signal_and_cleans_the_registration() {
    let service = TutorService::default();
    let request = request();
    let lease = service.register("main", &request).unwrap();
    assert!(service.register("other", &request).is_err());
    assert!(!service.cancel("other", &request.request_id).unwrap());
    assert!(service.cancel("main", &request.request_id).unwrap());
    let outcome = lease.resolve(std::future::pending()).await;
    assert!(matches!(
        lease.finish(outcome).unwrap(),
        TutorOutcome::Cancelled
    ));
    assert!(service.runs.lock().unwrap().is_empty());
    assert!(!service.cancel("main", &request.request_id).unwrap());
    let lease = service.register("main", &request).unwrap();
    let context = ToolContext::default().with_scope(lease.run.clone());
    assert!(Arc::ptr_eq(
        &lease.run,
        &context.for_dispatch().scope::<RunState>().unwrap()
    ));
    service.cancel_owner("main");
    assert!(matches!(
        lease
            .finish(TutorOutcome::Completed {
                text: "A late answer.".into()
            })
            .unwrap(),
        TutorOutcome::Cancelled
    ));
    assert!(service.runs.lock().unwrap().is_empty());
    drop(service.register("main", &request).unwrap());
    assert!(service.runs.lock().unwrap().is_empty());
}

#[tokio::test]
async fn provider_failures_and_incomplete_text_never_become_successful_answers() {
    let mut incomplete = response("Partial answer.");
    incomplete["status"] = json!("incomplete");
    let (connection, server) = provider(vec![
        (
            401,
            json!({"error": {"message": "private-provider-detail"}}),
        ),
        (200, incomplete),
        (200, response("")),
    ]);
    let service = TutorService::default();
    for expected in [Some("API key"), None, None] {
        let request = request();
        let lease = service.register("main", &request).unwrap();
        let error = service
            .respond(connection.clone(), &request, None, lease.run.clone())
            .await
            .unwrap_err();
        if let Some(expected) = expected {
            assert!(error.contains(expected), "Expected {expected}: {error}");
        }
        assert!(!error.contains("Partial answer."));
        assert!(!error.contains("private-provider-detail"));
    }
    assert!(service.runs.lock().unwrap().is_empty());
    server.join().unwrap();
}

#[test]
fn input_limits_and_missing_project_context_fail_before_model_execution() {
    let mut request = request();
    request.target = ConversationTarget::Project {
        project_id: "missing-project".into(),
    };
    assert!(context::prepare(&request, None).is_err());
    request.target = ConversationTarget::Unassigned {
        conversation_id: "chat-home".into(),
    };
    if let TutorInput::Question { message } = &mut request.input {
        message.text = "x".repeat(120_001);
    }
    assert!(context::prepare(&request, None).is_err());
}

#[test]
fn project_context_retains_goal_plan_and_the_original_quote_snapshot() {
    let mut request = request();
    let samples: Vec<projects::ProjectDetail> = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/mock-data/backend-interview.json"
    )))
    .unwrap();
    let project = &samples[0];
    request.target = ConversationTarget::Project {
        project_id: project.project.id.clone(),
    };
    if let TutorInput::Question { message } = &mut request.input {
        message.attachments = serde_json::from_value(
            json!([{"id": "notes", "name": "notes.md", "text": "The learner's source notes."}]),
        )
        .unwrap();
        message.passage = Some(serde_json::from_value(json!({"bookId": project.project.id, "chapterId": "chapter", "sectionId": "section", "paragraphId": "paragraph", "version": 1, "quote": "Original quoted wording."})).unwrap());
    }
    let input = context::prepare(&request, Some(project)).unwrap();
    let history = serde_json::to_string(&input.history).unwrap();
    let prompt = serde_json::to_string(&input.prompt).unwrap();
    assert!(history.contains(&project.goal.content));
    assert!(history.contains(&project.plan.overview));
    assert!(prompt.contains("Original quoted wording."));
    assert!(prompt.contains("The learner's source notes."));
    assert!(!history.contains("Original quoted wording."));
    let event = serde_json::to_value(TutorEvent::Started {
        request_id: "run-1".into(),
    })
    .unwrap();
    assert_eq!(event, json!({"kind": "started", "requestId": "run-1"}));
}
