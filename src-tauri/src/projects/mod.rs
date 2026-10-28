mod data;
mod store;

use tauri::Manager;

pub use data::{LibraryChange, LibrarySnapshot, Project, ProjectDetail};
use store::ProjectStore;

#[cfg(test)]
mod tests;

fn project_store(app: &tauri::AppHandle) -> Result<ProjectStore, String> {
    // 开发测试使用独立文件，仍经过相同的 Rust 读取和校验；正式构建忽略此变量。
    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("SWARTZ_PROJECTS_FILE") {
        return Ok(ProjectStore::new(path.into()));
    }
    // 项目数据由 Rust 读取应用数据目录，不接受前端传入的文件路径。
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Could not locate the project data directory.".to_string())?;
    Ok(ProjectStore::new(directory.join("projects.json")))
}

/// Library 只返回元数据，不把正文传给列表。
#[tauri::command]
pub async fn get_library(app: tauri::AppHandle) -> Result<LibrarySnapshot, String> {
    let store = project_store(&app)?;
    tauri::async_runtime::spawn_blocking(move || store.library())
        .await
        .map_err(|_| "Could not read the library.".to_string())?
}

/// 整理书架不生成业务 Activity。
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

/// Library 只需要项目基本信息，不把教材正文、计划或活动日志传给列表页。
#[tauri::command]
pub async fn list_projects(app: tauri::AppHandle) -> Result<Vec<Project>, String> {
    let store = project_store(&app)?;
    tauri::async_runtime::spawn_blocking(move || store.list())
        .await
        .map_err(|_| "Could not finish reading the project library.".to_string())?
}

/// 详情页汇集当前业务状态与 Activity，不复制或解析 Agent 的原生 session log。
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
