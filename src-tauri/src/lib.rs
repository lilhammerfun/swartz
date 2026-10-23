mod model;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            model::load_model_settings,
            model::save_model_settings,
            model::ask_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running Swartz");
}
