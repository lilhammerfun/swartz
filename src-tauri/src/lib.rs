mod commands;
mod services;
mod storage;
mod utils;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(services::model::ModelState::default())
        .manage(services::tutor::TutorService::default())
        .on_page_load(|webview, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Started) {
                // A reload replaces the JS owner even when the native window stays open.
                webview
                    .state::<services::tutor::TutorService>()
                    .cancel_owner(webview.window().label());
            }
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                window
                    .state::<services::tutor::TutorService>()
                    .cancel_owner(window.label());
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
