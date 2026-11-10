//! Produces Tutor replies grounded in the learner's conversation and learning project.
//!
//! A learner can ask a first question from Home without creating a project, or
//! continue a discussion inside an existing project. For example, after discussing
//! ownership, they may ask "How does borrowing differ?" The reply should build on
//! the earlier exchange and, when there is a project, its current Goal, Plan, and Textbook.
//!
//! The UI saves the question first, then sends it with the preceding conversation
//! and a target identifying either the project or an unassigned conversation.
//! The service handles that learning interaction through these cooperating steps:
//!
//! - `run` accepts the attempt and prevents another reply from being generated for
//!   the same target at the same time. Started tells the UI the attempt is registered.
//! - `execute` obtains the configured model connection and loads the current project
//!   materials when the question belongs to a project. Home questions need no project.
//! - `respond` uses `context::prepare` to combine the question, earlier exchanges,
//!   attachments, quoted passages, and optional project materials into Rig messages.
//!   `agent` supplies the teaching guidance from `pedagogy` and the model configuration;
//!   Rig then generates the reply.
//! - `RunLease::finish` ends the attempt and releases its target. The UI displays and
//!   saves a completed reply, or retains the question for retry after failure or cancellation.
//!
//! On a follow-up, the UI supplies the preceding exchanges again. Tauri keeps one
//! TutorService for the app, and its Agent configuration is reusable. Reusing that
//! Agent does not carry another project's discussion into the request: the supplied
//! history determines the prior exchanges. Project materials are loaded again so
//! the reply uses current facts.
//!
//! The learner can stop a pending reply through `cancel`; `cancel_owner` handles a
//! reloaded or closed window. `RunLease::resolve` watches for those signals while
//! the reply is being prepared. `finish` ensures an accepted stop wins over a late
//! answer. The lease also cleans up on early failure or a dropped command so the
//! conversation can be retried rather than remaining permanently busy.
//!
//! LIMITATION: the service currently returns a complete text reply, without streaming
//! or tools to create or update projects, goals, plans, or textbooks. An interrupted
//! attempt cannot resume after an app restart; the UI retains the question for retry.
//! Stopping locally does not guarantee that the provider stops processing remotely.

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

/// Coordinates answering learner questions, sharing Tutor configuration while keeping
/// each conversation's supplied history and each pending reply separate.
#[derive(Default)]
pub(crate) struct TutorService {
    // Shared teaching instructions and model setup; no learner's chat history is cached here.
    agent: Mutex<Option<CachedAgent>>,
    // Pending replies, keyed by (window label, attempt ID), so Stop reaches the right attempt.
    // A project or unassigned conversation can have only one active reply across all windows.
    runs: Mutex<HashMap<(String, String), Arc<RunState>>>,
}

/// Pairs the reusable Tutor setup with the model settings used to build it.
struct CachedAgent {
    connection: Arc<ModelConnection>,
    agent: Arc<Agent>,
}

/// Tracks which learning context is receiving a reply and whether the learner stopped it.
///
/// This belongs to one attempt, not the saved conversation. Its cancellation signal
/// retains an early Stop until the execution starts watching. It is also passed as
/// host-owned ToolContext scope, although no tool currently consumes it.
struct RunState {
    target: ConversationTarget,
    cancelled: watch::Sender<bool>,
}

impl TutorService {
    /// Supply the teaching guidance and model setup used to answer this question.
    ///
    /// Questions using the same settings reuse this setup, but provide their own history.
    /// Saving model settings creates a new connection snapshot and replaces the cached
    /// Agent on demand; a reply already in progress continues with its original settings.
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

    /// Mark this learning context as busy before preparing a reply.
    /// Reject overlapping attempts for the same project or unassigned conversation,
    /// including attempts from another window. The lease releases that reservation.
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

    /// Handle the learner's Stop action for a pending reply in this window.
    /// True acknowledges the stop request, not completed cleanup: resolve/finish end
    /// the attempt. False means that this window has no matching active attempt.
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

    /// Stop pending replies when their window reloads or closes, losing its original UI.
    /// Their leases release the busy targets once execution ends or is dropped.
    pub(crate) fn cancel_owner(&self, owner: &str) {
        if let Ok(runs) = self.runs.lock() {
            for ((window, _), run) in runs.iter() {
                if window == owner {
                    run.cancelled.send_replace(true);
                }
            }
        }
    }

    /// Handle one learner input received through the run_tutor command.
    ///
    /// The UI has already saved a question. Check its conversation relationships,
    /// reserve the target with register, then acknowledge Started so Stop can find it.
    /// execute prepares the reply while the lease watches for cancellation; finish
    /// decides what the UI should receive and makes the target available again.
    ///
    /// A reply-generation failure is returned as TutorOutcome::Failed for the UI to
    /// show beside the saved question. Failures accepting the request, delivering
    /// Started, or finalizing the attempt instead return Err to the command caller.
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

    /// Obtain the learning background needed to answer this input.
    /// Use the configured model connection. Inside a project, reload its current Goal,
    /// Plan, and Textbook; from Home, continue without project materials. Pass these
    /// facts to respond. Loading failures reach the UI without calling the model.
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

    /// Generate a reply that connects the current question to the earlier discussion.
    ///
    /// agent supplies the teaching instructions; context::prepare supplies the learner's
    /// question, history, source material, and optional project background. For a
    /// learning-start input, it instead prepares a request for project-based guidance.
    /// Rig receives that input and explicit history; it does not remember other runs.
    ///
    /// Apply this attempt's model/effort choices, then accept only a nonempty, completed
    /// answer. Return it for the UI to save; this function does not update learning
    /// materials or conversation storage. Provider failures go through public_error.
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

/// Keeps one pending reply registered until it completes, fails, or is stopped.
///
/// run normally calls resolve and then finish. If preparation, UI notification, or
/// the command itself ends early, Drop releases the reservation instead. This lets
/// the learner retry rather than being told that an abandoned reply is still running.
struct RunLease<'a> {
    service: &'a TutorService,
    key: (String, String),
    run: Arc<RunState>,
}

impl RunLease<'_> {
    /// Wait for a reply while allowing the learner to stop preparation or generation.
    /// Stop takes priority when both branches are ready and drops the operation future.
    /// finish performs the final stop check before the result is returned to the UI.
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

    /// End this attempt so the learner can continue or retry in the same learning context.
    /// A stop accepted before finalization replaces even a ready answer with Cancelled.
    /// Checking the stop and releasing the target under one lock makes that promise atomic.
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
            // A late guard must not remove a replacement that reused the same request key.
            if runs
                .get(&self.key)
                .is_some_and(|run| Arc::ptr_eq(run, &self.run))
            {
                runs.remove(&self.key);
            }
        }
    }
}

/// Explain model failures in terms the learner can act on, such as checking Settings
/// or retrying later, without exposing provider response bodies or request details.
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
