//! Immutable model settings snapshots and configured Rig completion models.

use reqwest::{Client, Url, redirect::Policy};
use rig::{DynModel, http_client::ReqwestClient, operation::Completion};
use serde_json::{Value, json};
use std::time::Duration;

use crate::models::model::{ApiFormat, ModelConfig, ModelRequestOptions};
use rig::{agent::PromptResponse, completion::PromptError};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(90);

pub(crate) struct ModelConnection {
    pub(crate) config: ModelConfig,
    client: ReqwestClient,
}

impl ModelConnection {
    /// Reuses this settings snapshot and its configured HTTP connection pool.
    pub(crate) fn completion_model(
        &self,
        model: Option<&str>,
    ) -> Result<DynModel<Completion>, String> {
        let model = model.unwrap_or(&self.config.model).trim();
        if model.is_empty() || model.len() > 256 {
            return Err("Enter a model ID.".into());
        }
        match self.config.api_format {
            ApiFormat::OpenaiResponses => {
                let provider =
                    rig::providers::openai::OpenAIConfig::new(self.config.api_key.clone())
                        .with_base_url(self.config.base_url.clone());
                Ok(provider
                    .connect(self.client.clone())
                    .responses(model)
                    .erase())
            }
        }
    }

    pub(crate) fn additional_params(&self, options: &ModelRequestOptions) -> Value {
        let mut params = json!({"store": false});
        if let Some(effort) = &options.reasoning_effort {
            params["reasoning"] = json!({"effort": effort, "summary": "auto"});
        }
        params
    }
    /// Validate provider completion before the application accepts its text.
    pub(crate) fn response_text(&self, response: PromptResponse) -> Result<String, String> {
        if response.completion_calls.iter().any(|call| {
            call.raw
                .get("status")
                .and_then(Value::as_str)
                .is_some_and(|status| status != "completed")
        }) {
            return Err("The model response was incomplete.".into());
        }
        let text = response.output().trim().to_owned();
        if text.is_empty() {
            return Err("The model returned no text.".into());
        }
        Ok(text)
    }

    pub(crate) fn new(mut config: ModelConfig) -> Result<Self, String> {
        config.base_url = normalize_base(&config.base_url)?;
        let client = Client::builder()
            .redirect(Policy::none())
            .connect_timeout(Duration::from_secs(15))
            .timeout(REQUEST_TIMEOUT)
            .build()
            .map_err(|_| "Unable to initialize the model connection.".to_string())?;
        Ok(Self {
            config,
            client: ReqwestClient::from(client),
        })
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
                api_format: ApiFormat::OpenaiResponses,
                base_url,
                model: "test-model".into(),
                api_key: "test-key".into(),
            })
            .unwrap(),
        )
    }
}

/// Explain model failures in terms the learner can act on, such as checking Settings
/// or retrying later, without exposing provider response bodies or request details.
pub(crate) fn public_error(error: PromptError) -> String {
    if let Some(status) = error.provider_response_status() {
        return match status.as_u16() {
            401 | 403 => "The provider rejected the API key. Check Model settings.",
            404 => "Responses API endpoint or model not found. Check Model settings.",
            429 => "The provider is rate limiting requests or the account has no quota. Try again later.",
            500..=599 => "The model provider is temporarily unavailable. Try again later.",
            _ => "The model request failed. Check Model settings.",
        }.into();
    }
    // Provider bodies and Display strings may contain sensitive request details.
    "The model request could not be completed. Check the model connection and retry.".into()
}

#[cfg(test)]
mod tests;
