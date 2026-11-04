use keyring::{Entry, Error as KeyringError};
use reqwest::{Client, Url, redirect::Policy};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::Manager;

const SERVICE: &str = "dev.tukdam.desktop";
const ACCOUNT: &str = "model-settings";
const MAX_RESPONSE: usize = 2 * 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(90);

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelConfig {
    base_url: String,
    model: String,
    api_key: String,
}

struct ModelConnection {
    config: ModelConfig,
    client: Client,
}

impl ModelConnection {
    fn new(config: ModelConfig) -> Result<Self, String> {
        normalize_base(&config.base_url)?;
        let client = Client::builder()
            .redirect(Policy::none())
            .connect_timeout(Duration::from_secs(15))
            .timeout(REQUEST_TIMEOUT)
            .build()
            .map_err(|_| "Unable to initialize the model connection.".to_string())?;
        Ok(Self { config, client })
    }
}

#[derive(Default)]
enum ConfigCache {
    #[default]
    Unloaded,
    Loaded(Option<Arc<ModelConnection>>),
}

impl ConfigCache {
    fn load_with(
        &mut self,
        read: impl FnOnce() -> Result<Option<ModelConfig>, String>,
    ) -> Result<Option<Arc<ModelConnection>>, String> {
        match self {
            Self::Loaded(config) => Ok(config.clone()),
            Self::Unloaded => {
                let connection = read()?.map(ModelConnection::new).transpose()?.map(Arc::new);
                *self = Self::Loaded(connection.clone());
                Ok(connection)
            }
        }
    }
}

#[derive(Default)]
pub struct ModelState {
    config: Mutex<ConfigCache>,
}

impl ModelState {
    fn load_with(
        &self,
        read: impl FnOnce() -> Result<Option<ModelConfig>, String>,
    ) -> Result<Option<Arc<ModelConnection>>, String> {
        self.config
            .lock()
            .map_err(|_| "Could not access model settings.".to_string())?
            .load_with(read)
    }

    fn save_with(
        &self,
        input: ModelInput,
        read: impl FnOnce() -> Result<Option<ModelConfig>, String>,
        write: impl FnOnce(&ModelConfig) -> Result<(), String>,
    ) -> Result<ModelSettings, String> {
        let mut cache = self
            .config
            .lock()
            .map_err(|_| "Could not access model settings.".to_string())?;
        let previous = cache
            .load_with(read)?
            .map(|connection| connection.config.clone());
        let config = prepare_config(input, previous)?;
        let connection = Arc::new(ModelConnection::new(config)?);
        // Serialize persistence and cache replacement so concurrent saves stay consistent.
        write(&connection.config)?;
        let settings = ModelSettings::from(&connection.config);
        *cache = ConfigCache::Loaded(Some(connection));
        Ok(settings)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSettings {
    base_url: String,
    model: String,
    has_api_key: bool,
}

impl From<&ModelConfig> for ModelSettings {
    fn from(config: &ModelConfig) -> Self {
        Self {
            base_url: config.base_url.clone(),
            model: config.model.clone(),
            has_api_key: !config.api_key.is_empty(),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInput {
    base_url: String,
    model: String,
    api_key: String,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum ReasoningEffort {
    None,
    Low,
    Medium,
    High,
    Max,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelRequestOptions {
    model: Option<String>,
    reasoning_effort: Option<ReasoningEffort>,
}

fn keyring_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|_| {
        "System credential storage is unavailable. Unlock your keyring and try again.".into()
    })
}

fn read_config() -> Result<Option<ModelConfig>, String> {
    match keyring_entry()?.get_password() {
        Ok(raw) => serde_json::from_str(&raw).map(Some).map_err(|_| {
            "Saved model settings could not be read. Save them again in Settings.".into()
        }),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(_) => {
            Err("Unable to access model settings. Unlock your system keyring and try again.".into())
        }
    }
}

fn write_config(config: &ModelConfig) -> Result<(), String> {
    let serialized =
        serde_json::to_string(config).map_err(|_| "Could not save model settings.".to_string())?;
    keyring_entry()?.set_password(&serialized).map_err(|_| {
        "Could not save the API key. Unlock your system keyring and try again.".to_string()
    })
}

fn normalize_base(base: &str) -> Result<String, String> {
    let url = Url::parse(base.trim()).map_err(|_| "Enter a valid API base URL.".to_string())?;
    let local = matches!(
        url.host_str(),
        Some("localhost" | "127.0.0.1" | "[::1]" | "::1")
    );
    if (url.scheme() != "https" && !(url.scheme() == "http" && local))
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(
            "Use an HTTPS base URL, or HTTP for a local model. Keep credentials out of the URL."
                .into(),
        );
    }
    Ok(url.as_str().trim_end_matches('/').to_string())
}

fn is_local(base: &str) -> bool {
    Url::parse(base)
        .ok()
        .and_then(|u| u.host_str().map(str::to_owned))
        .is_some_and(|host| matches!(host.as_str(), "localhost" | "127.0.0.1" | "[::1]" | "::1"))
}

fn prepare_config(input: ModelInput, previous: Option<ModelConfig>) -> Result<ModelConfig, String> {
    let base_url = normalize_base(&input.base_url)?;
    let model = input.model.trim().to_string();
    if model.is_empty() || model.len() > 256 {
        return Err("Enter a model ID.".into());
    }
    let mut api_key = input.api_key.trim().to_string();
    if api_key.is_empty()
        && let Some(previous) = previous.filter(|old| old.base_url == base_url)
    {
        api_key = previous.api_key;
    }
    if api_key.is_empty() && !is_local(&base_url) {
        return Err("Enter an API key for this endpoint.".into());
    }
    if api_key.contains(['\r', '\n']) || api_key.len() > 16384 {
        return Err("Enter a valid API key.".into());
    }
    Ok(ModelConfig {
        base_url,
        model,
        api_key,
    })
}

#[tauri::command]
pub async fn load_model_settings(app: tauri::AppHandle) -> Result<ModelSettings, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<ModelState>()
            .load_with(read_config)
            .map(|config| {
                config
                    .as_ref()
                    .map(|connection| ModelSettings::from(&connection.config))
                    .unwrap_or(ModelSettings {
                        base_url: String::new(),
                        model: String::new(),
                        has_api_key: false,
                    })
            })
    })
    .await
    .map_err(|_| "Could not load model settings.".to_string())?
}

#[tauri::command]
pub async fn save_model_settings(
    app: tauri::AppHandle,
    input: ModelInput,
) -> Result<ModelSettings, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<ModelState>()
            .save_with(input, read_config, write_config)
    })
    .await
    .map_err(|_| "Could not save model settings.".to_string())?
}

fn status_error(status: u16) -> String {
    match status {
        401 | 403 => "The provider rejected the API key. Check Model settings.".into(),
        404 => "Responses API endpoint or model not found. Check Model settings.".into(),
        429 => {
            "The provider is rate limiting requests or the account has no quota. Try again later."
                .into()
        }
        500..=599 => "The model provider is temporarily unavailable. Try again later.".into(),
        _ => format!("The model request failed (HTTP {status}). Check Model settings."),
    }
}

fn request_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "The model request timed out. Your question is still here.".into()
    } else {
        "Unable to reach the model provider. Check the API URL and your connection.".into()
    }
}

async fn complete(
    connection: &ModelConnection,
    messages: Vec<ChatMessage>,
    options: ModelRequestOptions,
) -> Result<String, String> {
    let config = &connection.config;
    let base = normalize_base(&config.base_url)?;
    let model = options.model.as_deref().unwrap_or(&config.model).trim();
    if model.is_empty() || model.len() > 256 {
        return Err("Enter a model ID.".into());
    }
    if messages.is_empty()
        || messages.len() > 64
        || messages.iter().map(|m| m.content.len()).sum::<usize>() > 120_000
        || messages.iter().any(|m| {
            !matches!(m.role.as_str(), "system" | "user" | "assistant")
                || m.content.trim().is_empty()
        })
    {
        return Err("This discussion is too long or contains invalid messages.".into());
    }
    let input: Vec<Value> = messages
        .into_iter()
        .map(|message| {
            json!({
                "type": "message",
                "role": message.role,
                "content": [{
                    "type": if message.role == "assistant" { "output_text" } else { "input_text" },
                    "text": message.content,
                }],
            })
        })
        .collect();
    let mut payload = json!({"model": model, "input": input, "store": false, "stream": false});
    if let Some(effort) = options.reasoning_effort {
        payload["reasoning"] = json!({"effort": effort, "summary": "auto"});
    }
    let mut request = connection
        .client
        .post(format!("{base}/responses"))
        .json(&payload);
    if !config.api_key.is_empty() {
        request = request.bearer_auth(&config.api_key);
    }
    let mut response = request.send().await.map_err(request_error)?;
    if !response.status().is_success() {
        return Err(status_error(response.status().as_u16()));
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(request_error)? {
        if body.len() + chunk.len() > MAX_RESPONSE {
            return Err("The model response was too large.".into());
        }
        body.extend_from_slice(&chunk);
    }
    let data: Value = serde_json::from_slice(&body)
        .map_err(|_| "The provider returned an invalid response.".to_string())?;
    parse_model_answer(&data)
}

fn parse_model_answer(data: &Value) -> Result<String, String> {
    match data.get("status").and_then(Value::as_str) {
        Some("completed") => {}
        Some("failed" | "incomplete" | "cancelled") => {
            return Err("The model response was incomplete. Your question is still here.".into());
        }
        _ => return Err("The provider returned an invalid response.".into()),
    }
    let output = data
        .get("output")
        .and_then(Value::as_array)
        .ok_or("The provider returned an invalid response.")?;
    let mut answer = String::new();
    for item in output {
        if item.get("type").and_then(Value::as_str) != Some("message")
            || item.get("role").and_then(Value::as_str) != Some("assistant")
        {
            continue;
        }
        let content = item
            .get("content")
            .and_then(Value::as_array)
            .ok_or("The provider returned an invalid response.")?;
        for block in content {
            match block.get("type").and_then(Value::as_str) {
                Some("refusal") => return Err("The model declined to answer this request.".into()),
                Some("output_text") => answer.push_str(
                    block
                        .get("text")
                        .and_then(Value::as_str)
                        .ok_or("The provider returned an invalid response.")?,
                ),
                _ => {}
            }
        }
    }
    let answer = answer.trim();
    if answer.is_empty() {
        return Err("The model returned no text. Your question is still here.".into());
    }
    Ok(answer.into())
}

#[tauri::command]
pub async fn ask_model(
    app: tauri::AppHandle,
    messages: Vec<ChatMessage>,
    options: Option<ModelRequestOptions>,
) -> Result<String, String> {
    let connection = tauri::async_runtime::spawn_blocking(move || {
        app.state::<ModelState>().load_with(read_config)
    })
    .await
    .map_err(|_| "Could not load model settings.".to_string())??
    .ok_or("Configure a model in Settings first.".to_string())?;
    complete(&connection, messages, options.unwrap_or_default()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        cell::Cell,
        io::{Read, Write},
        net::TcpListener,
        sync::mpsc,
        thread,
    };

    fn stored_config() -> ModelConfig {
        ModelConfig {
            base_url: "https://provider.example/v1".into(),
            model: "saved-model".into(),
            api_key: "saved-key".into(),
        }
    }

    fn model_input(model: &str, api_key: &str) -> ModelInput {
        ModelInput {
            base_url: "https://provider.example/v1".into(),
            model: model.into(),
            api_key: api_key.into(),
        }
    }

    #[test]
    fn configured_and_missing_settings_are_each_loaded_only_once() {
        for stored in [Some(stored_config()), None] {
            let state = ModelState::default();
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
        let state = ModelState::default();
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
        let state = ModelState::default();
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
        let state = ModelState::default();
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
        let state = Arc::new(ModelState::default());
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
            base_url: "https://first.example/v1".into(),
            model: "one".into(),
            api_key: "test-secret".into(),
        });
        let result = prepare_config(
            ModelInput {
                base_url: "https://other.example/v1".into(),
                model: "two".into(),
                api_key: String::new(),
            },
            previous,
        );
        assert!(result.is_err());
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

    #[test]
    fn native_transport_sends_context_and_reads_answer() {
        let payload = request_fixture(ModelRequestOptions::default());
        assert_eq!(payload["model"], "test-model");
        assert_eq!(payload["input"][0]["role"], "system");
        assert_eq!(
            payload["input"][0]["content"][0]["text"],
            "Learning instructions."
        );
        assert_eq!(payload["input"][1]["role"], "user");
        assert_eq!(
            payload["input"][1]["content"][0]["text"],
            "Previous question."
        );
        assert_eq!(payload["input"][2]["role"], "assistant");
        assert_eq!(payload["input"][0]["content"][0]["type"], "input_text");
        assert_eq!(payload["input"][2]["content"][0]["type"], "output_text");
        assert_eq!(
            payload["input"][2]["content"][0]["text"],
            "Previous answer."
        );
        assert_eq!(
            payload["input"][3]["content"][0]["text"],
            "Why exclusive access?"
        );
        assert_eq!(payload["stream"], false);
        assert_eq!(payload["store"], false);
        assert!(payload.get("messages").is_none());
        assert!(payload.get("reasoning_effort").is_none());
    }

    #[test]
    fn native_transport_applies_model_and_explicit_effort_without_changing_credentials() {
        for effort in ["none", "low", "medium", "high", "max"] {
            let options = serde_json::from_value(json!({
                "model": "  another-model  ",
                "reasoningEffort": effort,
            }))
            .unwrap();
            let payload = request_fixture(options);
            assert_eq!(payload["model"], "another-model");
            assert_eq!(payload["reasoning"]["effort"], effort);
            assert!(payload.get("reasoning_effort").is_none());
        }
    }

    #[test]
    fn responses_preserve_model_ids_that_look_like_effort_aliases() {
        let payload = request_fixture(ModelRequestOptions {
            model: Some("gateway-model-high".into()),
            reasoning_effort: None,
        });
        assert_eq!(payload["model"], "gateway-model-high");
    }

    #[test]
    fn responses_keep_custom_base_paths() {
        let (answer, payload) = response_fixture(
            ModelRequestOptions::default(),
            "/gateway/v1",
            responses_body("A custom endpoint answer."),
            200,
        );
        assert_eq!(answer.unwrap(), "A custom endpoint answer.");
        assert_eq!(payload["model"], "test-model");
    }

    #[test]
    fn responses_failures_and_incomplete_output_are_not_returned_as_answers() {
        for (status, expected) in [(401, "API key"), (404, "Responses API endpoint")] {
            let (answer, _) = response_fixture(
                ModelRequestOptions::default(),
                "/v1",
                json!({"error": {"message": "private-provider-detail"}}),
                status,
            );
            let error = answer.unwrap_err();
            assert!(error.contains(expected), "{error}");
            assert!(!error.contains("private-provider-detail"));
        }
        let mut incomplete = responses_body("Partial text must not become a final answer.");
        incomplete["status"] = json!("incomplete");
        let (answer, _) = response_fixture(ModelRequestOptions::default(), "/v1", incomplete, 200);
        assert!(answer.unwrap_err().contains("incomplete"));
        let (answer, _) = response_fixture(
            ModelRequestOptions::default(),
            "/v1",
            responses_body(""),
            200,
        );
        assert!(answer.unwrap_err().contains("returned no text"));
    }

    #[test]
    fn responses_reject_refusals_and_malformed_assistant_content() {
        for (content, expected) in [
            (
                json!([{"type": "refusal", "refusal": "private-provider-detail"}]),
                "declined",
            ),
            (
                json!([{"type": "output_text", "text": null}]),
                "invalid response",
            ),
            (json!("not content blocks"), "invalid response"),
        ] {
            let mut response = responses_body("Must not be returned.");
            response["output"][1]["content"] = content;
            let error = parse_model_answer(&response).unwrap_err();
            assert!(error.contains(expected), "{error}");
            assert!(!error.contains("private-provider-detail"));
        }
    }

    #[test]
    fn native_options_reject_invalid_effort_and_unrecognized_fields() {
        for invalid in [
            json!({"reasoningEffort": "extreme"}),
            json!({"reasoningEffort": 1}),
            json!({"model": "allowed", "baseUrl": "https://other.example"}),
            json!({"attachments": []}),
        ] {
            assert!(serde_json::from_value::<ModelRequestOptions>(invalid).is_err());
        }
    }

    #[test]
    fn native_options_reject_empty_or_oversized_model_before_requesting() {
        let connection = ModelConnection::new(ModelConfig {
            base_url: "http://127.0.0.1:1/v1".into(),
            model: "saved-model".into(),
            api_key: "test-key".into(),
        })
        .unwrap();
        for model in ["   ".to_string(), "a".repeat(257)] {
            let result = tauri::async_runtime::block_on(complete(
                &connection,
                vec![ChatMessage {
                    role: "user".into(),
                    content: "Question".into(),
                }],
                ModelRequestOptions {
                    model: Some(model),
                    reasoning_effort: None,
                },
            ));
            assert_eq!(result.unwrap_err(), "Enter a model ID.");
        }
    }

    fn request_fixture(options: ModelRequestOptions) -> Value {
        let (answer, payload) = response_fixture(
            options,
            "/v1",
            responses_body("A test fixture explanation."),
            200,
        );
        assert_eq!(answer.unwrap(), "A test fixture explanation.");
        payload
    }

    fn response_fixture(
        options: ModelRequestOptions,
        base_path: &'static str,
        response: Value,
        status: u16,
    ) -> (Result<String, String>, Value) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let address = listener.local_addr().unwrap();
        let (stop, stopped) = mpsc::channel::<()>();
        let server = thread::spawn(move || {
            let mut payload = None;
            loop {
                if !matches!(stopped.try_recv(), Err(mpsc::TryRecvError::Empty)) {
                    break;
                }
                let (mut socket, _) = match listener.accept() {
                    Ok(connection) => connection,
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(5));
                        continue;
                    }
                    Err(error) => panic!("Could not accept fixture request: {error}"),
                };
                socket.set_nonblocking(false).unwrap();
                socket
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut bytes = Vec::new();
                let mut buffer = [0; 4096];
                loop {
                    let n = socket.read(&mut buffer).unwrap();
                    if n == 0 {
                        break;
                    }
                    bytes.extend_from_slice(&buffer[..n]);
                    if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                        let headers = String::from_utf8_lossy(&bytes[..end]);
                        let length = headers
                            .lines()
                            .find_map(|line| {
                                line.to_lowercase()
                                    .strip_prefix("content-length:")
                                    .map(str::trim)
                                    .and_then(|s| s.parse::<usize>().ok())
                            })
                            .unwrap_or(0);
                        if bytes.len() >= end + 4 + length {
                            break;
                        }
                    }
                }
                let request = String::from_utf8(bytes).unwrap();
                assert!(request.starts_with(&format!("POST {base_path}/responses HTTP/1.1")));
                assert!(
                    request
                        .to_lowercase()
                        .contains("authorization: bearer test-key")
                );
                payload =
                    Some(serde_json::from_str(request.split("\r\n\r\n").nth(1).unwrap()).unwrap());
                let body = response.to_string();
                write!(socket,"HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
            }
            payload.expect("The provider must send a fixture request.")
        });
        let connection = ModelConnection::new(ModelConfig {
            base_url: format!("http://{address}{base_path}"),
            model: "test-model".into(),
            api_key: "test-key".into(),
        })
        .unwrap();
        let answer = tauri::async_runtime::block_on(complete(
            &connection,
            vec![
                ChatMessage {
                    role: "system".into(),
                    content: "Learning instructions.".into(),
                },
                ChatMessage {
                    role: "user".into(),
                    content: "Previous question.".into(),
                },
                ChatMessage {
                    role: "assistant".into(),
                    content: "Previous answer.".into(),
                },
                ChatMessage {
                    role: "user".into(),
                    content: "Why exclusive access?".into(),
                },
            ],
            options,
        ));
        let _ = stop.send(());
        assert_eq!(connection.config.model, "test-model");
        (answer, server.join().unwrap())
    }

    fn responses_body(text: &str) -> Value {
        json!({
            "id": "resp_fixture",
            "object": "response",
            "model": "test-model",
            "status": "completed",
            "output": [
                {"type": "reasoning", "id": "reason_fixture", "summary": [{"type": "summary_text", "text": "Not assistant text."}]},
                {"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": text}]}
            ]
        })
    }
}
