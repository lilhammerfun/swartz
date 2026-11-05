use serde_json::{Value, json};

use super::{TutorRequest, TutorResult};

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
