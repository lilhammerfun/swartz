use super::*;
use serde_json::json;
use std::time::Duration;
use std::{cell::Cell, sync::mpsc, thread};

fn stored_config() -> ModelConfig {
    ModelConfig {
        api_format: ApiFormat::OpenaiResponses,
        base_url: "https://provider.example/v1".into(),
        model: "saved-model".into(),
        api_key: "saved-key".into(),
    }
}

fn model_input(model: &str, api_key: &str) -> ModelInput {
    ModelInput {
        api_format: ApiFormat::OpenaiResponses,
        base_url: "https://provider.example/v1".into(),
        model: model.into(),
        api_key: api_key.into(),
    }
}

#[test]
fn configured_and_missing_settings_are_each_loaded_only_once() {
    for stored in [Some(stored_config()), None] {
        let state = ModelService::default();
        let reads = Cell::new(0);
        let mut first: Option<Arc<ModelConnection>> = None;
        for _ in 0..3 {
            let config = state
                .load_with(|| {
                    reads.set(reads.get() + 1);
                    Ok(stored.clone())
                })
                .unwrap();
            assert_eq!(
                config
                    .as_ref()
                    .map(|connection| connection.config.model.as_str()),
                stored.as_ref().map(|config| config.model.as_str())
            );
            if let Some(connection) = config {
                if let Some(previous) = &first {
                    assert!(Arc::ptr_eq(previous, &connection));
                }
                first = Some(connection);
            }
        }
        assert_eq!(reads.get(), 1);
    }
}

#[test]
fn failed_credential_reads_can_be_retried() {
    let state = ModelService::default();
    assert!(
        state
            .load_with(|| Err("Keyring is locked.".into()))
            .is_err()
    );
    let config = state.load_with(|| Ok(Some(stored_config()))).unwrap();
    assert_eq!(config.unwrap().config.api_key, "saved-key");
}

#[test]
fn cache_changes_only_after_a_successful_save_and_requests_keep_their_snapshot() {
    let state = ModelService::default();
    let request_config = state
        .load_with(|| Ok(Some(stored_config())))
        .unwrap()
        .unwrap();
    assert!(
        state
            .save_with(
                model_input("new-model", "new-key"),
                || panic!("Cached settings must not be read from storage again."),
                |_| Err("Could not write credentials.".into()),
            )
            .is_err()
    );
    let unchanged = state
        .load_with(|| panic!("A failed write must keep the cached settings."))
        .unwrap()
        .unwrap();
    assert_eq!(unchanged.config.model, "saved-model");
    assert_eq!(unchanged.config.api_key, "saved-key");
    assert!(Arc::ptr_eq(&request_config, &unchanged));

    let settings = state
        .save_with(
            model_input("new-model", "new-key"),
            || panic!("Saving must use the current cached settings."),
            |config| {
                assert_eq!(config.model, "new-model");
                assert_eq!(config.api_key, "new-key");
                Ok(())
            },
        )
        .unwrap();
    assert_eq!(settings.model, "new-model");
    assert!(settings.has_api_key);
    let current = state
        .load_with(|| panic!("New requests must use the updated cache."))
        .unwrap()
        .unwrap();
    assert_eq!(current.config.model, "new-model");
    assert_eq!(current.config.api_key, "new-key");
    assert_eq!(request_config.config.model, "saved-model");
    assert_eq!(request_config.config.api_key, "saved-key");
    assert!(!Arc::ptr_eq(&request_config, &current));
}

#[test]
fn saving_before_loading_can_preserve_the_existing_key() {
    let state = ModelService::default();
    state
        .save_with(
            model_input("updated-model", ""),
            || Ok(Some(stored_config())),
            |config| {
                assert_eq!(config.model, "updated-model");
                assert_eq!(config.api_key, "saved-key");
                Ok(())
            },
        )
        .unwrap();
    let config = state
        .load_with(|| panic!("Saved settings must already be cached."))
        .unwrap()
        .unwrap();
    assert_eq!(config.config.model, "updated-model");
    assert_eq!(config.config.api_key, "saved-key");
}

#[test]
fn concurrent_saves_keep_storage_and_cache_in_the_same_order() {
    let state = Arc::new(ModelService::default());
    let stored = Arc::new(Mutex::new(stored_config()));
    state.load_with(|| Ok(Some(stored_config()))).unwrap();
    let (writing, started) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let first_state = Arc::clone(&state);
    let first_stored = Arc::clone(&stored);
    let first = thread::spawn(move || {
        first_state
            .save_with(
                model_input("first-model", "updated-key"),
                || panic!("Settings are already cached."),
                |config| {
                    writing.send(()).unwrap();
                    released.recv_timeout(Duration::from_secs(5)).unwrap();
                    *first_stored.lock().unwrap() = config.clone();
                    Ok(())
                },
            )
            .unwrap();
    });
    started.recv_timeout(Duration::from_secs(5)).unwrap();
    let second_state = Arc::clone(&state);
    let second_stored = Arc::clone(&stored);
    let second = thread::spawn(move || {
        second_state
            .save_with(
                model_input("second-model", ""),
                || panic!("Settings are already cached."),
                |config| {
                    assert_eq!(config.api_key, "updated-key");
                    *second_stored.lock().unwrap() = config.clone();
                    Ok(())
                },
            )
            .unwrap();
    });
    release.send(()).unwrap();
    first.join().unwrap();
    second.join().unwrap();
    let current = state
        .load_with(|| panic!("Settings are already cached."))
        .unwrap()
        .unwrap();
    let persisted = stored.lock().unwrap();
    assert_eq!(current.config.model, "second-model");
    assert_eq!(current.config.model, persisted.model);
    assert_eq!(current.config.api_key, persisted.api_key);
}

#[test]
fn endpoint_changes_never_reuse_a_saved_key() {
    let previous = Some(ModelConfig {
        api_format: ApiFormat::OpenaiResponses,
        base_url: "https://first.example/v1".into(),
        model: "one".into(),
        api_key: "test-secret".into(),
    });
    let result = prepare_config(
        ModelInput {
            api_format: ApiFormat::OpenaiResponses,
            base_url: "https://other.example/v1".into(),
            model: "two".into(),
            api_key: String::new(),
        },
        previous,
    );
    assert!(result.is_err());
}

#[test]
fn settings_expose_the_protocol_without_returning_the_saved_key() {
    let config = stored_config();
    let encoded = serde_json::to_value(&config).unwrap();
    assert_eq!(encoded["apiFormat"], "openai_responses");
    let mut saved_before_format = encoded.clone();
    saved_before_format
        .as_object_mut()
        .unwrap()
        .remove("apiFormat");
    assert_eq!(
        serde_json::from_value::<ModelConfig>(saved_before_format)
            .unwrap()
            .api_format,
        ApiFormat::OpenaiResponses
    );
    let restored: ModelConfig = serde_json::from_value(encoded).unwrap();
    assert_eq!(restored.api_format, ApiFormat::OpenaiResponses);
    assert_eq!(restored.api_key, "saved-key");

    let settings = serde_json::to_value(ModelSettings::from(&restored)).unwrap();
    assert_eq!(settings["apiFormat"], "openai_responses");
    assert_eq!(settings["hasApiKey"], true);
    assert!(settings.get("apiKey").is_none());
    assert!(!settings.to_string().contains("saved-key"));

    let mut input = json!({
        "apiFormat": "anthropic",
        "baseUrl": "https://provider.example/v1",
        "model": "test-model",
        "apiKey": "test-key"
    });
    assert!(serde_json::from_value::<ModelInput>(input.clone()).is_err());
    input["apiFormat"] = json!("openai_responses");
    assert!(serde_json::from_value::<ModelInput>(input).is_ok());
}
