mod clients;
mod commands;
mod models;
mod services;
mod storage;

use std::{path::PathBuf, sync::Arc};

use tauri::Manager;

use services::{model::ModelService, tutor::TutorService};
use storage::projects::ProjectStore;

fn project_file(app: &tauri::AppHandle) -> tauri::Result<PathBuf> {
    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("SWARTZ_PROJECTS_FILE") {
        return Ok(path.into());
    }
    Ok(app.path().app_local_data_dir()?.join("projects.json"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let model = Arc::new(ModelService::default());
            let projects = Arc::new(ProjectStore::new(project_file(app.handle())?));
            app.manage(TutorService::new(model.clone(), projects.clone()));
            app.manage(model);
            app.manage(projects);
            Ok(())
        })
        .on_page_load(|webview, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Started)
                // Tauri can start loading configured windows before setup registers services.
                && let Some(tutor) = webview.try_state::<TutorService>()
            {
                // A reload replaces the JS owner even when the native window stays open.
                tutor.cancel_owner(webview.window().label());
            }
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed)
                && let Some(tutor) = window.try_state::<TutorService>()
            {
                tutor.cancel_owner(window.label());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::model::load_model_settings,
            commands::model::save_model_settings,
            commands::tutor::run_tutor,
            commands::tutor::cancel_tutor,
            commands::projects::list_projects,
            commands::projects::get_project_detail,
            commands::projects::get_library,
            commands::projects::update_library
        ])
        .run(tauri::generate_context!())
        .expect("error while running Swartz");
}
