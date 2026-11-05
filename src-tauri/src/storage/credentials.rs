//! Persist model configuration in the native credential store.

use keyring::{Entry, Error as KeyringError};

use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModelConfig {
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) api_key: String,
}

const SERVICE: &str = "dev.tukdam.desktop";
const ACCOUNT: &str = "model-settings";

fn keyring_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|_| {
        "System credential storage is unavailable. Unlock your keyring and try again.".into()
    })
}

pub(crate) fn read_config() -> Result<Option<ModelConfig>, String> {
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

pub(crate) fn write_config(config: &ModelConfig) -> Result<(), String> {
    let serialized =
        serde_json::to_string(config).map_err(|_| "Could not save model settings.".to_string())?;
    keyring_entry()?.set_password(&serialized).map_err(|_| {
        "Could not save the API key. Unlock your system keyring and try again.".to_string()
    })
}
