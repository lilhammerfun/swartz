//! Adapts Tutor operation inputs and registration notifications to Tauri IPC.

use serde::Serialize;
use tauri::ipc::Channel;

use crate::services::tutor::{TutorRequest, TutorResult, TutorService};

#[derive(Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub(crate) enum TutorEvent {
    Started { request_id: String },
}

#[tauri::command]
pub(crate) async fn run_tutor(
    service: tauri::State<'_, TutorService>,
    window: tauri::WebviewWindow,
    request: TutorRequest,
    events: Channel<TutorEvent>,
) -> Result<TutorResult, String> {
    service
        .run(window.label(), request, |request_id| {
            events
                .send(TutorEvent::Started {
                    request_id: request_id.to_owned(),
                })
                .map_err(|_| "The conversation window is no longer available.".to_string())
        })
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

#[cfg(test)]
mod tests {
    use super::TutorEvent;
    use serde_json::json;

    #[test]
    fn started_event_matches_the_frontend_channel_contract() {
        let event = serde_json::to_value(TutorEvent::Started {
            request_id: "run-1".into(),
        })
        .unwrap();
        assert_eq!(event, json!({"kind": "started", "requestId": "run-1"}));
    }
}
