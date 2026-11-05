mod data;
mod store;

use tauri::Manager;

pub use data::{LibraryChange, LibrarySnapshot, Project, ProjectDetail};
use store::ProjectStore;

#[cfg(test)]
mod tests;

fn project_store(app: &tauri::AppHandle) -> Result<ProjectStore, String> {
    // Development tests use an isolated file with the same Rust reads and validation; release builds ignore it.
    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("SWARTZ_PROJECTS_FILE") {
        return Ok(ProjectStore::new(path.into()));
    }
    // Rust resolves project storage in the app data directory; the frontend cannot supply a file path.
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Could not locate the project data directory.".to_string())?;
    Ok(ProjectStore::new(directory.join("projects.json")))
}

/// Returns Library metadata without sending textbook content to the list.
#[tauri::command]
pub async fn get_library(app: tauri::AppHandle) -> Result<LibrarySnapshot, String> {
    let store = project_store(&app)?;
    tauri::async_runtime::spawn_blocking(move || store.library())
        .await
        .map_err(|_| "Could not read the library.".to_string())?
}

/// Organizing the library does not generate a business Activity.
#[tauri::command]
pub async fn update_library(
    app: tauri::AppHandle,
    change: LibraryChange,
) -> Result<LibrarySnapshot, String> {
    let store = project_store(&app)?;
    tauri::async_runtime::spawn_blocking(move || store.update(change))
        .await
        .map_err(|_| "Could not update the library.".to_string())?
}

/// Returns basic project information without textbook content, plans, or activity logs.
#[tauri::command]
pub async fn list_projects(app: tauri::AppHandle) -> Result<Vec<Project>, String> {
    let store = project_store(&app)?;
    tauri::async_runtime::spawn_blocking(move || store.list())
        .await
        .map_err(|_| "Could not finish reading the project library.".to_string())?
}

/// Assembles current business state and Activity without copying or parsing native Agent session logs.
#[tauri::command]
pub async fn get_project_detail(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<ProjectDetail, String> {
    let store = project_store(&app)?;
    tauri::async_runtime::spawn_blocking(move || store.get(&project_id))
        .await
        .map_err(|_| "Could not finish reading the project details.".to_string())?
}
