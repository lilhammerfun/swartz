//! Coordinates a Tutor operation using Rig's AgentRunner.
//!
//! Dependencies are injected at startup. Commands own IPC; ActiveRuns owns only
//! reservations and cancellation. Rig owns model/tool execution and per-run history.
//!
//! TODO: Move authoritative conversation persistence behind an agreed storage API.
//! For now the caller supplies history and saves the final reply. Runs belong to
//! their submitting window and cannot resume after reload or app restart.

mod context;
mod pedagogy;
mod runs;

use std::{
    collections::HashSet,
    sync::{Arc, Mutex},
};

use rig::{Agent, AgentBuilder};
use serde::{Deserialize, Serialize};

use crate::{
    clients::model::{ModelConnection, public_error},
    models::{
        conversations::{ConversationMessage, ConversationTarget, MessageRole},
        model::ModelRequestOptions,
        projects::ProjectDetail,
    },
    services::model::ModelService,
    storage::projects::ProjectStore,
};

use self::{
    pedagogy::{EXECUTION_BOUNDARIES, PEDAGOGY, ROLE},
    runs::ActiveRuns,
};

pub(crate) struct TutorService {
    model: Arc<ModelService>,
    projects: Arc<ProjectStore>,
    agent: Mutex<Option<CachedAgent>>,
    runs: ActiveRuns,
}

struct CachedAgent {
    connection: Arc<ModelConnection>,
    agent: Arc<Agent>,
}

impl TutorService {
    pub(crate) fn new(model: Arc<ModelService>, projects: Arc<ProjectStore>) -> Self {
        Self {
            model,
            projects,
            agent: Mutex::new(None),
            runs: ActiveRuns::default(),
        }
    }

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
        if let Some(cached) = &*cached
            && Arc::ptr_eq(&cached.connection, &connection)
        {
            return Ok(cached.agent.clone());
        }
        let agent = Arc::new(
            AgentBuilder::new(connection.completion_model(None)?)
                .preamble(format!("{ROLE}\n\n{PEDAGOGY}\n\n{EXECUTION_BOUNDARIES}"))
                .build(),
        );
        *cached = Some(CachedAgent {
            connection,
            agent: agent.clone(),
        });
        Ok(agent)
    }

    /// Register before notifying the caller so an early Stop can find this operation.
    pub(crate) async fn run(
        &self,
        owner: &str,
        request: TutorRequest,
        started: impl FnOnce(&str) -> Result<(), String>,
    ) -> Result<TutorResult, String> {
        request.validate().map_err(str::to_owned)?;
        let mut lease = self
            .runs
            .register(owner, &request.request_id, &request.target)?;
        started(&request.request_id)?;
        let outcome = lease.resolve(self.execute(&request)).await;
        Ok(TutorResult {
            outcome: lease.finish(outcome)?,
        })
    }

    /// Acknowledges Stop; the running future releases its reservation when it exits.
    pub(crate) fn cancel(&self, owner: &str, request_id: &str) -> Result<bool, String> {
        self.runs.cancel(owner, request_id)
    }

    pub(crate) fn cancel_owner(&self, owner: &str) {
        self.runs.cancel_owner(owner);
    }

    async fn execute(&self, request: &TutorRequest) -> Result<String, String> {
        let connection = self.model.connection().await?;
        let project = match &request.target {
            ConversationTarget::Project { project_id } => {
                let store = self.projects.clone();
                let id = project_id.clone();
                Some(
                    tokio::task::spawn_blocking(move || store.get(&id))
                        .await
                        .map_err(|_| "Could not finish reading the project details.")??,
                )
            }
            ConversationTarget::Unassigned { .. } => None,
        };
        self.respond(connection, request, project.as_ref()).await
    }

    async fn respond(
        &self,
        connection: Arc<ModelConnection>,
        request: &TutorRequest,
        project: Option<&ProjectDetail>,
    ) -> Result<String, String> {
        let input = context::prepare(request, project)?;
        let agent = self.agent(connection.clone())?;
        let mut runner = agent
            .prompt(input.prompt)
            .history(input.history)
            .replace_additional_params(connection.additional_params(&request.options));
        if request.options.model().is_some() {
            runner =
                runner.using_model_value(connection.completion_model(request.options.model())?);
        }
        // No tools are registered yet: one model call completes this operation.
        // Rig drives the loop in this future; no separate worker or executor is needed.
        let response = runner.max_turns(1).run().await.map_err(public_error)?;
        connection.response_text(response)
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TutorRequest {
    pub target: ConversationTarget,
    /// Identifies one execution attempt; retrying the same question replaces this ID.
    pub request_id: String,
    pub input: TutorInput,
    /// Prior exchanges supplied by the frontend, excluding the current question.
    pub history: Vec<ConversationMessage>,
    pub options: ModelRequestOptions,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum TutorInput {
    Question { message: Box<ConversationMessage> },
    StartLearning,
}

impl TutorRequest {
    /// Validates business relationships; the execution boundary applies size and model limits.
    pub fn validate(&self) -> Result<(), &'static str> {
        let target_id = match &self.target {
            ConversationTarget::Project { project_id } => project_id,
            ConversationTarget::Unassigned { conversation_id } => conversation_id,
        };
        if target_id.trim().is_empty() || self.request_id.trim().is_empty() {
            return Err("The conversation and attempt must have an identity.");
        }
        if matches!(self.input, TutorInput::StartLearning)
            && !matches!(self.target, ConversationTarget::Project { .. })
        {
            return Err("Start learning requires a project.");
        }

        let mut ids = HashSet::new();
        let question = match &self.input {
            TutorInput::Question { message } => {
                if message.role != MessageRole::User {
                    return Err("A question must be a user message.");
                }
                Some(message.as_ref())
            }
            TutorInput::StartLearning => None,
        };
        for message in self.history.iter().chain(question) {
            if message.id.trim().is_empty() || !ids.insert(&message.id) {
                return Err("History and the current question must have distinct message IDs.");
            }
            if message.role == MessageRole::Assistant
                && (!message.attachments.is_empty() || message.passage.is_some())
            {
                return Err("Attachments and quoted passages belong to user messages.");
            }
            if let Some(passage) = &message.passage {
                if !matches!(&self.target, ConversationTarget::Project { project_id } if project_id == &passage.book_id)
                {
                    return Err("The quoted passage belongs to a different project.");
                }
                if passage.version == 0 || passage.quote.trim().is_empty() {
                    return Err("The quoted passage needs its original text and version.");
                }
            }
        }
        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TutorResult {
    pub outcome: TutorOutcome,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case", deny_unknown_fields)]
pub enum TutorOutcome {
    Completed { text: String },
    Failed { error: String },
    Cancelled,
}

#[cfg(test)]
mod tests;
