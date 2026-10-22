use keyring::{Entry, Error as KeyringError};
use reqwest::{Client, Url, redirect::Policy};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{sync::OnceLock, time::Duration};

const SERVICE: &str = "dev.tukdam.desktop";
const ACCOUNT: &str = "model-settings";
const MAX_RESPONSE: usize = 2 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelConfig {
    base_url: String,
    model: String,
    api_key: String,
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
pub async fn load_model_settings() -> Result<ModelSettings, String> {
    tauri::async_runtime::spawn_blocking(|| {
        read_config().map(|config| {
            config
                .as_ref()
                .map(ModelSettings::from)
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
pub async fn save_model_settings(input: ModelInput) -> Result<ModelSettings, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let config = prepare_config(input, read_config()?)?;
        let serialized = serde_json::to_string(&config)
            .map_err(|_| "Could not save model settings.".to_string())?;
        keyring_entry()?.set_password(&serialized).map_err(|_| {
            "Could not save the API key. Unlock your system keyring and try again.".to_string()
        })?;
        Ok(ModelSettings::from(&config))
    })
    .await
    .map_err(|_| "Could not save model settings.".to_string())?
}

fn client() -> Result<&'static Client, String> {
    static CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            Client::builder()
                .redirect(Policy::none())
                .connect_timeout(Duration::from_secs(15))
                .timeout(Duration::from_secs(90))
                .build()
                .map_err(|_| "Unable to initialize the model connection.".into())
        })
        .as_ref()
        .map_err(Clone::clone)
}

fn status_error(status: u16) -> String {
    match status {
        401 | 403 => "The provider rejected the API key. Check Model settings.".into(),
        404 => "Model or API endpoint not found. Check Model settings.".into(),
        429 => {
            "The provider is rate limiting requests or the account has no quota. Try again later."
                .into()
        }
        500..=599 => "The model provider is temporarily unavailable. Try again later.".into(),
        _ => format!("The model request failed (HTTP {status}). Check Model settings."),
    }
}

async fn complete(
    client: &Client,
    config: &ModelConfig,
    messages: Vec<ChatMessage>,
    options: ModelRequestOptions,
) -> Result<String, String> {
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
    let mut payload = json!({"model":model,"messages":messages,"stream":false});
    if let Some(effort) = options.reasoning_effort {
        payload["reasoning_effort"] = json!(effort);
    }
    let mut request = client
        .post(format!("{base}/chat/completions"))
        .json(&payload);
    if !config.api_key.is_empty() {
        request = request.bearer_auth(&config.api_key);
    }
    let mut response = request.send().await.map_err(|error| {
        if error.is_timeout() {
            "The model request timed out. Your question is still here.".to_string()
        } else {
            "Unable to reach the model provider. Check the API URL and your connection.".to_string()
        }
    })?;
    if !response.status().is_success() {
        return Err(status_error(response.status().as_u16()));
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Unable to read the model response.".to_string())?
    {
        if body.len() + chunk.len() > MAX_RESPONSE {
            return Err("The model response was too large.".into());
        }
        body.extend_from_slice(&chunk);
    }
    let data: Value = serde_json::from_slice(&body)
        .map_err(|_| "The provider returned an invalid response.".to_string())?;
    let answer = data
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if answer.is_empty() {
        return Err("The model returned no text. Your question is still here.".into());
    }
    Ok(answer.into())
}

#[tauri::command]
pub async fn ask_model(
    messages: Vec<ChatMessage>,
    options: Option<ModelRequestOptions>,
) -> Result<String, String> {
    let config = tauri::async_runtime::spawn_blocking(read_config)
        .await
        .map_err(|_| "Could not load model settings.".to_string())??
        .ok_or("Configure a model in Settings first.".to_string())?;
    complete(client()?, &config, messages, options.unwrap_or_default()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };

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
        assert_eq!(payload["messages"][0]["content"], "Why exclusive access?");
        assert_eq!(payload["stream"], false);
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
            assert_eq!(payload["reasoning_effort"], effort);
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
        let config = ModelConfig {
            base_url: "http://127.0.0.1:1/v1".into(),
            model: "saved-model".into(),
            api_key: "test-key".into(),
        };
        for model in ["   ".to_string(), "a".repeat(257)] {
            let result = tauri::async_runtime::block_on(complete(
                client().unwrap(),
                &config,
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
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
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
            assert!(request.starts_with("POST /v1/chat/completions HTTP/1.1"));
            assert!(
                request
                    .to_lowercase()
                    .contains("authorization: bearer test-key")
            );
            let payload: Value =
                serde_json::from_str(request.split("\r\n\r\n").nth(1).unwrap()).unwrap();
            let body = r#"{"choices":[{"message":{"content":"A test fixture explanation."}}]}"#;
            write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
            payload
        });
        let config = ModelConfig {
            base_url: format!("http://{address}/v1"),
            model: "test-model".into(),
            api_key: "test-key".into(),
        };
        let answer = tauri::async_runtime::block_on(complete(
            client().unwrap(),
            &config,
            vec![ChatMessage {
                role: "user".into(),
                content: "Why exclusive access?".into(),
            }],
            options,
        ))
        .unwrap();
        assert_eq!(answer, "A test fixture explanation.");
        assert_eq!(config.model, "test-model");
        server.join().unwrap()
    }
}
