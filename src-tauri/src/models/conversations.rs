//! Conversation identities, messages, attachments, and original quotation snapshots.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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

#[derive(Clone, Copy, PartialEq, Serialize, Deserialize)]
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
