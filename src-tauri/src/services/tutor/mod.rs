//! Long-lived Tutor execution service embedded in the Tauri application.
//!
//! The service reuses a Rig Agent for one model-settings snapshot. Every request
//! supplies its own history and ToolContext; the shared Agent owns no chat history.
//! LIMITATION: this first stage enables buffered text only. AskUser and project
//! creation tools are not registered yet. Run state is in memory and cannot be
//! resumed after an application restart; frontend chat persistence is unchanged.

mod context;
mod pedagogy;
mod types;

pub(crate) use types::{TutorEvent, TutorRequest, TutorResult};

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use rig::{Agent, AgentBuilder, completion::PromptError, tool::ToolContext};
use tauri::ipc::Channel;
use tokio::sync::watch;

use crate::{
    services::model::{self, ModelConnection},
    storage::projects,
};

use self::{
    pedagogy::{EXECUTION_BOUNDARIES, PEDAGOGY},
    types::{ConversationTarget, TutorOutcome},
};

#[derive(Default)]
pub(crate) struct TutorService {
    agent: Mutex<Option<CachedAgent>>,
    runs: Mutex<HashMap<(String, String), Arc<RunState>>>,
}

struct CachedAgent {
    connection: Arc<ModelConnection>,
    agent: Arc<Agent>,
}

/// Host-owned execution scope, supplied through ToolContext rather than model arguments.
struct RunState {
    target: ConversationTarget,
    cancelled: watch::Sender<bool>,
}

impl TutorService {
    fn agent(&self, connection: Arc<ModelConnection>) -> Result<Arc<Agent>, String> {
        let mut cached = self
            .agent
            .lock()
            .map_err(|_| "Could not access the Tutor.")?;
        if let Some(cached) = &*cached {
            if Arc::ptr_eq(&cached.connection, &connection) {
                return Ok(cached.agent.clone());
            }
        }
        let agent = Arc::new(
            AgentBuilder::new(connection.responses_model(None)?)
                .preamble(format!("{PEDAGOGY}\n\n{EXECUTION_BOUNDARIES}"))
                .build(),
        );
        *cached = Some(CachedAgent {
            connection,
            agent: agent.clone(),
        });
        Ok(agent)
    }

    fn register(&self, owner: &str, request: &TutorRequest) -> Result<RunLease<'_>, String> {
        let mut runs = self
            .runs
            .lock()
            .map_err(|_| "Could not access active Tutor runs.")?;
        let key = (owner.to_owned(), request.request_id.clone());
        if runs.contains_key(&key) || runs.values().any(|run| run.target == request.target) {
            return Err("This conversation already has an active Tutor run.".into());
        }
        let run = Arc::new(RunState {
            target: request.target.clone(),
            cancelled: watch::channel(false).0,
        });
        runs.insert(key.clone(), run.clone());
        Ok(RunLease {
            service: self,
            key,
            run,
        })
    }

    pub(crate) fn cancel(&self, owner: &str, request_id: &str) -> Result<bool, String> {
        let runs = self
            .runs
            .lock()
            .map_err(|_| "Could not access active Tutor runs.")?;
        let Some(run) = runs.get(&(owner.to_owned(), request_id.to_owned())) else {
            return Ok(false);
        };
        run.cancelled.send_replace(true);
        Ok(true)
    }

    pub(crate) fn cancel_owner(&self, owner: &str) {
        if let Ok(runs) = self.runs.lock() {
            for ((window, _), run) in runs.iter() {
                if window == owner {
                    run.cancelled.send_replace(true);
                }
            }
        }
    }

    pub(crate) async fn run(
        &self,
        app: &tauri::AppHandle,
        owner: &str,
        request: TutorRequest,
        events: Channel<TutorEvent>,
    ) -> Result<TutorResult, String> {
        request.validate().map_err(str::to_owned)?;
        let lease = self.register(owner, &request)?;
        events
            .send(TutorEvent::Started {
                request_id: request.request_id.clone(),
            })
            .map_err(|_| "The conversation window is no longer available.")?;
        let outcome = lease
            .resolve(self.execute(app, &request, lease.run.clone()))
            .await;
        // Finish and cancellation share the registry lock: an acknowledged cancel
        // cannot race with returning a successful completion for this request.
        let outcome = lease.finish(outcome)?;
        Ok(TutorResult { outcome })
    }

    async fn execute(
        &self,
        app: &tauri::AppHandle,
        request: &TutorRequest,
        run: Arc<RunState>,
    ) -> Result<String, String> {
        let connection = model::load_connection(app.clone()).await?;
        let project = match &request.target {
            ConversationTarget::Project { project_id } => {
                Some(projects::load_detail(app, project_id.clone()).await?)
            }
            ConversationTarget::Unassigned { .. } => None,
        };
        self.respond(connection, request, project.as_ref(), run)
            .await
    }

    async fn respond(
        &self,
        connection: Arc<ModelConnection>,
        request: &TutorRequest,
        project: Option<&projects::ProjectDetail>,
        run: Arc<RunState>,
    ) -> Result<String, String> {
        let agent = self.agent(connection.clone())?;
        let input = context::prepare(request, project)?;
        let mut runner = agent
            .prompt(input.prompt)
            .history(input.history)
            .tool_context(ToolContext::default().with_scope(run))
            .replace_additional_params(request.options.additional_params());
        if request.options.model().is_some() {
            runner = runner.using_model_value(connection.responses_model(request.options.model())?);
        }
        // No tools or automatic retries are enabled in this stage: one model call
        // is the complete text operation. Revisit this budget when tools are registered.
        let response = runner.max_turns(1).await.map_err(public_error)?;
        if response.completion_calls.iter().any(|call| {
            call.raw
                .get("status")
                .and_then(serde_json::Value::as_str)
                .is_some_and(|status| status != "completed")
        }) {
            return Err("The model response was incomplete. Your question is still here.".into());
        }
        let text = response.output().trim().to_owned();
        if text.is_empty() {
            return Err("The model returned no text. Your question is still here.".into());
        }
        Ok(text)
    }
}

/// Removes the registration even if the command future is dropped or preparation fails.
struct RunLease<'a> {
    service: &'a TutorService,
    key: (String, String),
    run: Arc<RunState>,
}

impl RunLease<'_> {
    async fn resolve(
        &self,
        operation: impl Future<Output = Result<String, String>>,
    ) -> TutorOutcome {
        let mut cancellation = self.run.cancelled.subscribe();
        tokio::select! {
            biased;
            _ = cancellation.wait_for(|cancelled| *cancelled) => TutorOutcome::Cancelled,
            answer = operation => match answer {
                Ok(text) => TutorOutcome::Completed { text },
                Err(error) => TutorOutcome::Failed { error },
            },
        }
    }

    fn finish(self, outcome: TutorOutcome) -> Result<TutorOutcome, String> {
        let mut runs = self
            .service
            .runs
            .lock()
            .map_err(|_| "Could not finish the Tutor run.")?;
        let cancelled = *self.run.cancelled.borrow();
        runs.remove(&self.key);
        Ok(if cancelled {
            TutorOutcome::Cancelled
        } else {
            outcome
        })
    }
}

impl Drop for RunLease<'_> {
    fn drop(&mut self) {
        if let Ok(mut runs) = self.service.runs.lock() {
            if runs
                .get(&self.key)
                .is_some_and(|run| Arc::ptr_eq(run, &self.run))
            {
                runs.remove(&self.key);
            }
        }
    }
}

fn public_error(error: PromptError) -> String {
    if let Some(status) = error.provider_response_status() {
        return match status.as_u16() {
            401 | 403 => "The provider rejected the API key. Check Model settings.",
            404 => "Responses API endpoint or model not found. Check Model settings.",
            429 => "The provider is rate limiting requests or the account has no quota. Try again later.",
            500..=599 => "The model provider is temporarily unavailable. Try again later.",
            _ => "The model request failed. Check Model settings.",
        }.into();
    }
    // Provider bodies and Display strings may contain sensitive request details.
    "The Tutor could not complete this request. Check the model connection and retry; your question was kept.".into()
}

#[cfg(test)]
mod tests;
