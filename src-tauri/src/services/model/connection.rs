//! Immutable model settings snapshots and configured Rig Responses models.

use reqwest::{Client, Url, redirect::Policy};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::time::Duration;

use super::ModelConfig;
use crate::utils::http::RigTransport;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(90);

pub(crate) struct ModelConnection {
    pub(crate) config: ModelConfig,
    client: Client,
}

impl ModelConnection {
    /// Reuses this settings snapshot and its configured HTTP connection pool.
    pub(crate) fn responses_model(
        &self,
        model: Option<&str>,
    ) -> Result<rig::driver::Model<rig::providers::openai::responses_api::wire::Responses>, String>
    {
        let model = model.unwrap_or(&self.config.model).trim();
        if model.is_empty() || model.len() > 256 {
            return Err("Enter a model ID.".into());
        }
        let mut provider = rig::providers::openai::OpenAIConfig::new(self.config.api_key.clone());
        provider.base_url = normalize_base(&self.config.base_url)?;
        Ok(provider
            .connect(RigTransport(self.client.clone()))
            .responses(model))
    }

    pub(crate) fn new(config: ModelConfig) -> Result<Self, String> {
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

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum ReasoningEffort {
    None,
    Low,
    Medium,
    High,
    Max,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelRequestOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reasoning_effort: Option<ReasoningEffort>,
}

impl ModelRequestOptions {
    pub(crate) fn model(&self) -> Option<&str> {
        self.model.as_deref()
    }

    pub(crate) fn additional_params(&self) -> Value {
        let mut params = json!({"store": false});
        if let Some(effort) = &self.reasoning_effort {
            params["reasoning"] = json!({"effort": effort, "summary": "auto"});
        }
        params
    }
}

pub(crate) fn normalize_base(base: &str) -> Result<String, String> {
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

pub(crate) fn is_local(base: &str) -> bool {
    Url::parse(base)
        .ok()
        .and_then(|u| u.host_str().map(str::to_owned))
        .is_some_and(|host| matches!(host.as_str(), "localhost" | "127.0.0.1" | "[::1]" | "::1"))
}

#[cfg(test)]
impl ModelConnection {
    pub(crate) fn for_test(base_url: String) -> std::sync::Arc<Self> {
        std::sync::Arc::new(
            Self::new(ModelConfig {
                base_url,
                model: "test-model".into(),
                api_key: "test-key".into(),
            })
            .unwrap(),
        )
    }
}
