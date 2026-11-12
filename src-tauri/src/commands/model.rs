//! Tauri adapters for loading and saving model settings.

use std::sync::Arc;

use crate::services::model::{ModelInput, ModelService, ModelSettings};

#[tauri::command]
pub(crate) async fn load_model_settings(
    service: tauri::State<'_, Arc<ModelService>>,
) -> Result<ModelSettings, String> {
    service.settings().await
}

#[tauri::command]
pub(crate) async fn save_model_settings(
    service: tauri::State<'_, Arc<ModelService>>,
    input: ModelInput,
) -> Result<ModelSettings, String> {
    service.save(input).await
}
