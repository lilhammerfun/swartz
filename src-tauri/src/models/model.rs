//! Model settings and per-operation choices, independent of provider wire formats.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ApiFormat {
    #[default]
    OpenaiResponses,
}

/// User-owned model settings. The storage adapter keeps the complete configuration secret.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModelConfig {
    // Settings saved before the format was explicit also used Responses.
    #[serde(default)]
    pub(crate) api_format: ApiFormat,
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) api_key: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ReasoningEffort {
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
    pub(crate) reasoning_effort: Option<ReasoningEffort>,
}

impl ModelRequestOptions {
    pub(crate) fn model(&self) -> Option<&str> {
        self.model.as_deref()
    }
}

#[cfg(test)]
mod tests {
    use super::ModelRequestOptions;
    use serde_json::json;

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
}
