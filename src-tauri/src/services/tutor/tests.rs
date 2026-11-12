use super::*;
use serde_json::{Value, json};
use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
    time::{Duration, Instant},
};

fn service() -> TutorService {
    TutorService::new(
        Arc::new(ModelService::default()),
        Arc::new(ProjectStore::new(
            std::env::temp_dir().join("swartz-unused-projects.json"),
        )),
    )
}

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
    let service = TutorService::new(
        Arc::new(ModelService::for_test(connection.clone())),
        // A directory is not a valid library file: Home must not try reading it.
        Arc::new(ProjectStore::new(std::env::temp_dir())),
    );
    let original_agent = service.agent(connection.clone()).unwrap();
    let mut first = request();
    first.options =
        serde_json::from_value(json!({"model": "alternate-model", "reasoningEffort": "low"}))
            .unwrap();
    first.history = serde_json::from_value(json!([{"id": "earlier-question", "role": "user", "text": "Only the first run knows this.", "createdAt": "2026-11-05T00:00:00Z"}])).unwrap();
    let result = service
        .run("main", first, |id| {
            assert_eq!(id, "attempt-home-1");
            Ok(())
        })
        .await
        .unwrap();
    assert_eq!(
        serde_json::to_value(result).unwrap()["outcome"]["text"],
        "First answer."
    );
    assert!(!service.cancel("main", "attempt-home-1").unwrap());
    let second = request();
    let result = service.run("main", second, |_| Ok(())).await.unwrap();
    assert_eq!(
        serde_json::to_value(result).unwrap()["outcome"]["text"],
        "Second answer."
    );
    assert!(Arc::ptr_eq(
        &original_agent,
        &service.agent(connection).unwrap()
    ));
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
    let runs = ActiveRuns::default();
    let request = request();
    let mut lease = runs
        .register("main", &request.request_id, &request.target)
        .unwrap();
    assert!(
        runs.register("other", &request.request_id, &request.target)
            .is_err()
    );
    assert!(!runs.cancel("other", &request.request_id).unwrap());
    assert!(runs.cancel("main", &request.request_id).unwrap());
    let outcome = lease.resolve(std::future::pending()).await;
    assert!(matches!(
        lease.finish(outcome).unwrap(),
        TutorOutcome::Cancelled
    ));
    assert!(!runs.cancel("main", &request.request_id).unwrap());
    let lease = runs
        .register("main", &request.request_id, &request.target)
        .unwrap();
    runs.cancel_owner("main");
    assert!(matches!(
        lease
            .finish(TutorOutcome::Completed {
                text: "A late answer.".into()
            })
            .unwrap(),
        TutorOutcome::Cancelled
    ));
    drop(
        runs.register("main", &request.request_id, &request.target)
            .unwrap(),
    );
    assert!(!runs.cancel("main", &request.request_id).unwrap());
    // Dropping the completed lease must not remove a later reservation with the same ID.
    let replacement = runs
        .register("main", &request.request_id, &request.target)
        .unwrap();
    assert!(runs.cancel("main", &request.request_id).unwrap());
    drop(replacement);
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
    let service = TutorService::new(
        Arc::new(ModelService::for_test(connection)),
        Arc::new(ProjectStore::new(std::env::temp_dir())),
    );
    for expected in [Some("API key"), None, None] {
        let request = request();
        let result = service.run("main", request, |_| Ok(())).await.unwrap();
        let TutorOutcome::Failed { error } = result.outcome else {
            panic!("A failed provider response must not become an answer.");
        };
        if let Some(expected) = expected {
            assert!(error.contains(expected), "Expected {expected}: {error}");
        }
        assert!(!error.contains("Partial answer."));
        assert!(!error.contains("private-provider-detail"));
    }
    server.join().unwrap();
}

#[tokio::test]
async fn injected_project_store_is_reloaded_before_each_run() {
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };
    struct ProjectFile(PathBuf);
    impl Drop for ProjectFile {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.0);
        }
    }
    let file = ProjectFile(std::env::temp_dir().join(format!(
        "swartz-tutor-{}-{}.json", std::process::id(),
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos(),
    )));
    let (connection, server) = provider(vec![
        (200, response("First project answer.")),
        (200, response("Updated project answer.")),
    ]);
    let service = TutorService::new(
        Arc::new(ModelService::for_test(connection)),
        Arc::new(ProjectStore::new(file.0.clone())),
    );
    let mut data: Value = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/mock-data/backend-interview.json"
    )))
    .unwrap();
    for goal in ["Understand ownership.", "Understand borrowing."] {
        data["projects"][0]["goal"]["content"] = json!(goal);
        fs::write(&file.0, data.to_string()).unwrap();
        let mut input = request();
        input.target = ConversationTarget::Project {
            project_id: data["projects"][0]["project"]["id"]
                .as_str()
                .unwrap()
                .into(),
        };
        let result = service.run("main", input, |_| Ok(())).await.unwrap();
        assert!(matches!(result.outcome, TutorOutcome::Completed { .. }));
    }
    let payloads = server.join().unwrap();
    assert!(payloads[0].to_string().contains("Understand ownership."));
    assert!(payloads[1].to_string().contains("Understand borrowing."));
    assert!(!payloads[1].to_string().contains("Understand ownership."));
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
    let samples: Value = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/mock-data/backend-interview.json"
    )))
    .unwrap();
    let project: ProjectDetail = serde_json::from_value(samples["projects"][0].clone()).unwrap();
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
    let input = context::prepare(&request, Some(&project)).unwrap();
    let history = serde_json::to_string(&input.history).unwrap();
    let prompt = serde_json::to_string(&input.prompt).unwrap();
    assert!(history.contains(&project.goal.content));
    assert!(history.contains(&project.plan.overview));
    assert!(prompt.contains("Original quoted wording."));
    assert!(prompt.contains("The learner's source notes."));
    assert!(!history.contains("Original quoted wording."));
}

#[tokio::test]
async fn registration_notification_can_cancel_before_dependencies_are_accessed() {
    let service = service();
    let request_id = request().request_id;
    let result = service
        .run("main", request(), |id| {
            assert_eq!(id, request_id);
            assert!(!service.cancel("other", id)?);
            assert!(service.cancel("main", id)?);
            Ok(())
        })
        .await
        .unwrap();
    assert!(matches!(result.outcome, TutorOutcome::Cancelled));
    assert!(!service.cancel("main", &request_id).unwrap());
}

#[tokio::test]
async fn notification_failure_releases_the_target_and_validation_precedes_registration() {
    let service = service();
    let request_id = request().request_id;
    let error = service
        .run("main", request(), |_| Err("Receiver closed.".into()))
        .await
        .err()
        .unwrap();
    assert_eq!(error, "Receiver closed.");
    assert!(!service.cancel("main", &request_id).unwrap());
    let mut invalid = request();
    invalid.request_id.clear();
    assert!(
        service
            .run("main", invalid, |_| panic!(
                "Invalid input must not be accepted."
            ))
            .await
            .is_err()
    );
    // The same target can be accepted after either failure, without accessing real credentials.
    let result = service
        .run("main", request(), |id| {
            assert!(service.cancel("main", id)?);
            Ok(())
        })
        .await
        .unwrap();
    assert!(matches!(result.outcome, TutorOutcome::Cancelled));
}

#[tokio::test]
async fn cancelling_a_running_future_drops_its_resources_and_releases_the_target() {
    use std::sync::atomic::{AtomicBool, Ordering};
    struct Resource(Arc<AtomicBool>);
    impl Drop for Resource {
        fn drop(&mut self) {
            self.0.store(true, Ordering::SeqCst);
        }
    }

    let runs = ActiveRuns::default();
    let request = request();
    let mut lease = runs
        .register("main", &request.request_id, &request.target)
        .unwrap();
    let dropped = Arc::new(AtomicBool::new(false));
    let (started, ready) = tokio::sync::oneshot::channel();
    let operation = async {
        let _resource = Resource(dropped.clone());
        started.send(()).unwrap();
        std::future::pending::<Result<String, String>>().await
    };
    let cancel = async {
        ready.await.unwrap();
        assert!(runs.cancel("main", &request.request_id).unwrap());
    };
    let (outcome, ()) = tokio::join!(lease.resolve(operation), cancel);
    assert!(dropped.load(Ordering::SeqCst));
    assert!(matches!(
        lease.finish(outcome).unwrap(),
        TutorOutcome::Cancelled
    ));
    drop(
        runs.register("main", &request.request_id, &request.target)
            .unwrap(),
    );
}

#[tokio::test]
async fn dropping_an_unfinished_operation_releases_its_reservation() {
    let runs = ActiveRuns::default();
    let request = request();
    let mut lease = runs
        .register("main", &request.request_id, &request.target)
        .unwrap();
    tokio::select! {
        biased;
        _ = lease.resolve(std::future::pending()) => panic!("Operation should remain pending."),
        _ = std::future::ready(()) => {},
    }
    drop(lease);
    assert!(!runs.cancel("main", &request.request_id).unwrap());
    drop(
        runs.register("main", &request.request_id, &request.target)
            .unwrap(),
    );
}

fn mock_data() -> Value {
    // Share wire-format samples with the frontend adapter to catch field and enum mismatches.
    serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/mock-data/tutor-contracts.json"
    )))
    .unwrap()
}

#[test]
fn frontend_requests_and_terminal_results_round_trip_without_losing_identity_or_snapshots() {
    let samples = mock_data();
    for (name, value) in samples["requests"].as_object().unwrap() {
        let request: TutorRequest = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(request.validate(), Ok(()), "{name}");
        assert_eq!(serde_json::to_value(request).unwrap(), *value, "{name}");
    }
    for value in samples["results"].as_array().unwrap() {
        let result: TutorResult = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(result).unwrap(), *value);
    }
}

#[test]
fn history_cannot_repeat_the_current_question_or_attach_quotes_to_another_project() {
    let original = mock_data()["requests"]["quoted"].clone();
    let mut duplicated = original.clone();
    let question = duplicated["input"]["message"].clone();
    duplicated["history"].as_array_mut().unwrap().push(question);
    let request: TutorRequest = serde_json::from_value(duplicated).unwrap();
    assert!(
        request
            .validate()
            .unwrap_err()
            .contains("distinct message IDs")
    );

    let mut wrong_project = original;
    wrong_project["target"]["projectId"] = json!("another-project");
    let request: TutorRequest = serde_json::from_value(wrong_project).unwrap();
    assert!(
        request
            .validate()
            .unwrap_err()
            .contains("different project")
    );
}

#[test]
fn business_requests_reject_system_roles_credentials_and_unassigned_learning_starts() {
    let samples = mock_data();
    for key in ["apiKey", "systemPrompt", "messages"] {
        let mut value = samples["requests"]["ordinary"].clone();
        value[key] = json!("not a business field");
        assert!(serde_json::from_value::<TutorRequest>(value).is_err());
    }
    let mut system = samples["requests"]["ordinary"].clone();
    system["input"]["message"]["role"] = json!("system");
    assert!(serde_json::from_value::<TutorRequest>(system).is_err());

    let mut start = samples["requests"]["startLearning"].clone();
    start["target"] = samples["requests"]["ordinary"]["target"].clone();
    let request: TutorRequest = serde_json::from_value(start).unwrap();
    assert_eq!(
        request.validate(),
        Err("Start learning requires a project.")
    );
}
