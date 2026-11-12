//! Converts application data into model input at the Rust boundary.

use rig::message::Message;
use serde_json::json;

use super::{
    TutorInput, TutorRequest,
    pedagogy::{EXECUTION_BOUNDARIES, PEDAGOGY, ROLE},
};

use crate::models::{
    conversations::{ConversationMessage, ConversationTarget, MessageRole},
    projects::ProjectDetail,
};

pub(super) struct PreparedInput {
    pub prompt: Message,
    pub history: Vec<Message>,
}

/// The execution entry point validates request relationships before loading context.
pub(super) fn prepare(
    request: &TutorRequest,
    project: Option<&ProjectDetail>,
) -> Result<PreparedInput, String> {
    if !match (&request.target, project) {
        (ConversationTarget::Unassigned { .. }, None) => true,
        (ConversationTarget::Project { project_id }, Some(project)) => {
            &project.project.id == project_id
        }
        _ => false,
    } {
        return Err("The project context does not match this conversation.".into());
    }
    // Preserve the existing text budget while context selection is developed.
    // TODO: Replace whole-project context with budgeted selection and compaction.
    let mut content = Vec::new();
    if let Some(project) = project {
        content.push((
            MessageRole::User,
            json!({"projectContext": {
                "project": project.project,
                "goal": project.goal,
                "plan": project.plan,
                "textbook": project.textbook,
            }})
            .to_string(),
        ));
    }
    for message in &request.history {
        content.push((message.role, message_text(message)?));
    }
    let prompt = match &request.input {
        TutorInput::Question { message } => message_text(message)?,
        TutorInput::StartLearning => json!({"event": "start_learning", "instruction": "The learner has explicitly started learning. Offer guidance using the supplied project context and prior exchanges."}).to_string(),
    };
    if content.len() + 2 > 64
        || ROLE.len()
            + PEDAGOGY.len()
            + EXECUTION_BOUNDARIES.len()
            + prompt.len()
            + content.iter().map(|(_, text)| text.len()).sum::<usize>()
            > 120_000
    {
        return Err(
            "This conversation exceeds the current context limit. Your messages were kept.".into(),
        );
    }
    Ok(PreparedInput {
        prompt: Message::user(prompt),
        history: content
            .into_iter()
            .map(|(role, text)| match role {
                MessageRole::User => Message::user(text),
                MessageRole::Assistant => Message::assistant(text),
            })
            .collect(),
    })
}

fn message_text(message: &ConversationMessage) -> Result<String, String> {
    if message.text.trim().is_empty()
        || message.attachments.len() > 4
        || message
            .attachments
            .iter()
            .any(|file| file.text.trim().is_empty() || file.text.len() > 20_000)
        || message
            .attachments
            .iter()
            .map(|file| file.text.len())
            .sum::<usize>()
            > 60_000
    {
        return Err("The conversation contains an empty message or invalid attachments.".into());
    }
    if message.attachments.is_empty() && message.passage.is_none() {
        return Ok(message.text.clone());
    }
    Ok(json!({"message": message.text, "attachments": message.attachments, "selectedPassage": message.passage}).to_string())
}
