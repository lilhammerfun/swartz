use super::*;

#[test]
fn invalid_model_ids_are_rejected_before_creating_a_rig_request() {
    let connection = ModelConnection::for_test("http://127.0.0.1:1/v1".into());
    for model in ["   ".to_owned(), "a".repeat(257)] {
        let error = match connection.completion_model(Some(&model)) {
            Ok(_) => panic!("An invalid model must not be accepted"),
            Err(error) => error,
        };
        assert_eq!(error, "Enter a model ID.");
    }
}

#[test]
fn endpoint_validation_rejects_remote_http_and_embedded_credentials() {
    for invalid in [
        "http://remote.example/v1",
        "https://user:secret@example.com/v1",
        "https://example.com/v1?key=secret",
        "file:///tmp",
    ] {
        assert!(normalize_base(invalid).is_err());
    }
    assert_eq!(
        normalize_base("http://127.0.0.1:1234/v1/").unwrap(),
        "http://127.0.0.1:1234/v1"
    );
}
