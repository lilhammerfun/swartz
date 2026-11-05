//! Application contracts for learning conversations, independent of Rig and provider protocols.
//!
//! Projects retain learning context across learning days; day boundaries do not reset model context.
//! Questions and learning starts are separate inputs, allowing proactive guidance without fake user messages.
//! The frontend currently supplies chat history snapshots. Rust already stores Goal, Plan, and the current
//! Textbook; the conversation service will load them by project. Quotes retain their original text and
//! version. Drafts belong to the UI; execution attempts are not successful learning or textbook changes.
//!
//! This module only defines and validates contracts; commands, model calls, and storage migration come later.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::model::ModelRequestOptions;

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ConversationTarget {
    Project { project_id: String },
    Unassigned { conversation_id: String },
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConversationRequest {
    pub target: ConversationTarget,
    /// Identifies one execution attempt; retrying the same question replaces this ID.
    pub request_id: String,
    pub input: ConversationInput,
    /// Prior exchanges, excluding the current question; the service will load these after storage migration.
    pub history: Vec<ConversationMessage>,
    pub options: ModelRequestOptions,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum ConversationInput {
    Question { message: ConversationMessage },
    StartLearning,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConversationMessage {
    pub id: String,
    pub role: MessageRole,
    pub text: String,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passage: Option<PassageReference>,
}

#[derive(PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attachment {
    pub id: String,
    pub name: String,
    pub text: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PassageReference {
    /// Matches AnnotationAnchor.bookId in the reader; its current value is project.id.
    pub book_id: String,
    pub chapter_id: String,
    pub section_id: String,
    pub paragraph_id: String,
    pub version: u64,
    pub quote: String,
}

impl ConversationRequest {
    /// Validates business relationships only; the execution boundary will check sizes, dates, and model limits.
    pub fn validate(&self) -> Result<(), &'static str> {
        let target_id = match &self.target {
            ConversationTarget::Project { project_id } => project_id,
            ConversationTarget::Unassigned { conversation_id } => conversation_id,
        };
        if target_id.trim().is_empty() || self.request_id.trim().is_empty() {
            return Err("The conversation and attempt must have an identity.");
        }
        if matches!(self.input, ConversationInput::StartLearning)
            && !matches!(self.target, ConversationTarget::Project { .. })
        {
            return Err("Start learning requires a project.");
        }

        let mut ids = HashSet::new();
        let question = match &self.input {
            ConversationInput::Question { message } => {
                if message.role != MessageRole::User {
                    return Err("A question must be a user message.");
                }
                Some(message)
            }
            ConversationInput::StartLearning => None,
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
pub struct ConversationResult {
    pub target: ConversationTarget,
    pub request_id: String,
    /// Proactive guidance has no user message; stale results must still be rejected by request_id.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_message_id: Option<String>,
    pub outcome: ConversationOutcome,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case", deny_unknown_fields)]
pub enum ConversationOutcome {
    Completed { text: String },
    Failed { error: String },
    Cancelled,
}

#[cfg(test)]
mod tests;
