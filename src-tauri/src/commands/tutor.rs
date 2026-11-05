//! Tauri IPC entry points. Runtime ownership and execution stay in TutorService.

use tauri::{Manager, ipc::Channel};

use crate::services::tutor::{TutorEvent, TutorRequest, TutorResult, TutorService};

#[tauri::command]
pub(crate) async fn run_tutor(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    request: TutorRequest,
    events: Channel<TutorEvent>,
) -> Result<TutorResult, String> {
    app.state::<TutorService>()
        .run(&app, window.label(), request, events)
        .await
}

#[tauri::command]
pub(crate) fn cancel_tutor(
    service: tauri::State<'_, TutorService>,
    window: tauri::WebviewWindow,
    request_id: String,
) -> Result<bool, String> {
    service.cancel(window.label(), &request_id)
}
