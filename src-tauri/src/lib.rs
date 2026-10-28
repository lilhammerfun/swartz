mod model;
mod projects;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            model::load_model_settings,
            model::save_model_settings,
            model::ask_model,
            projects::list_projects,
            projects::get_project_detail,
            projects::get_library,
            projects::update_library
        ])
        .run(tauri::generate_context!())
        .expect("error while running Swartz");
}
