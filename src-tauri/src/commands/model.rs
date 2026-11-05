//! Tauri adapters for loading and saving model settings.

use crate::services::model::{self, ModelInput, ModelSettings};

#[tauri::command]
pub(crate) async fn load_model_settings(app: tauri::AppHandle) -> Result<ModelSettings, String> {
    model::load_model_settings(app).await
}

#[tauri::command]
pub(crate) async fn save_model_settings(
    app: tauri::AppHandle,
    input: ModelInput,
) -> Result<ModelSettings, String> {
    model::save_model_settings(app, input).await
}
