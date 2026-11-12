//! Coordinate model settings and reusable connections.

use crate::{
    clients::model::{ModelConnection, is_local, normalize_base},
    models::model::{ApiFormat, ModelConfig},
    storage::credentials::{read_config, write_config},
};

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

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
pub struct ModelService {
    config: Mutex<ConfigCache>,
}

impl ModelService {
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
    api_format: ApiFormat,
    base_url: String,
    model: String,
    has_api_key: bool,
}

impl From<&ModelConfig> for ModelSettings {
    fn from(config: &ModelConfig) -> Self {
        Self {
            api_format: config.api_format,
            base_url: config.base_url.clone(),
            model: config.model.clone(),
            has_api_key: !config.api_key.is_empty(),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInput {
    api_format: ApiFormat,
    base_url: String,
    model: String,
    api_key: String,
}

impl ModelService {
    pub(crate) async fn connection(self: &Arc<Self>) -> Result<Arc<ModelConnection>, String> {
        let service = self.clone();
        tokio::task::spawn_blocking(move || service.load_with(read_config))
            .await
            .map_err(|_| "Could not load model settings.".to_string())??
            .ok_or_else(|| "Configure a model in Settings first.".to_string())
    }

    pub(crate) async fn settings(self: &Arc<Self>) -> Result<ModelSettings, String> {
        let service = self.clone();
        tokio::task::spawn_blocking(move || {
            service.load_with(read_config).map(|connection| {
                connection
                    .as_ref()
                    .map(|connection| ModelSettings::from(&connection.config))
                    .unwrap_or(ModelSettings {
                        api_format: ApiFormat::default(),
                        base_url: String::new(),
                        model: String::new(),
                        has_api_key: false,
                    })
            })
        })
        .await
        .map_err(|_| "Could not load model settings.".to_string())?
    }

    pub(crate) async fn save(self: &Arc<Self>, input: ModelInput) -> Result<ModelSettings, String> {
        let service = self.clone();
        tokio::task::spawn_blocking(move || service.save_with(input, read_config, write_config))
            .await
            .map_err(|_| "Could not save model settings.".to_string())?
    }
}

fn prepare_config(input: ModelInput, previous: Option<ModelConfig>) -> Result<ModelConfig, String> {
    let base_url = normalize_base(&input.base_url)?;
    let model = input.model.trim().to_string();
    if model.is_empty() || model.len() > 256 {
        return Err("Enter a model ID.".into());
    }
    let mut api_key = input.api_key.trim().to_string();
    if api_key.is_empty()
        && let Some(previous) =
            previous.filter(|old| old.api_format == input.api_format && old.base_url == base_url)
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
        api_format: input.api_format,
        base_url,
        model,
        api_key,
    })
}

#[cfg(test)]
impl ModelService {
    pub(crate) fn for_test(connection: Arc<ModelConnection>) -> Self {
        Self {
            config: Mutex::new(ConfigCache::Loaded(Some(connection))),
        }
    }
}

#[cfg(test)]
mod tests;
