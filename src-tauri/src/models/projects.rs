//! Learning projects, their materials, and library organization.

use serde::{Deserialize, Serialize};

/// IDs are opaque strings; project and node IDs must not be derived from titles.
pub type ProjectId = String;
pub type PlanNodeId = String;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub id: ProjectId,
    pub title: String,
    /// A short listing description, not a replacement for the learner's Goal.
    pub description: String,
    /// Library placement is separate from textbook content and does not produce an Activity.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub library_section_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LibrarySection {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySnapshot {
    pub sections: Vec<LibrarySection>,
    pub projects: Vec<Project>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum LibraryChange {
    CreateSection {
        id: String,
        name: String,
    },
    RenameSection {
        id: String,
        name: String,
    },
    DeleteSection {
        id: String,
    },
    /// Move the entire batch in one write; any invalid project prevents all changes.
    MoveProjects {
        #[serde(rename = "projectIds")]
        project_ids: Vec<String>,
        #[serde(rename = "sectionId")]
        section_id: Option<String>,
    },
    MoveProject {
        #[serde(rename = "projectId")]
        project_id: String,
        #[serde(rename = "sectionId")]
        section_id: Option<String>,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Goal {
    pub project_id: ProjectId,
    /// Version of the current state; this does not imply that historical snapshots can be queried.
    pub version: u64,
    /// Current goal content, optionally in Markdown; empty until a goal has been established.
    pub content: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Plan {
    pub project_id: ProjectId,
    /// Version of the whole plan; nodes do not currently have separate versions.
    pub version: u64,
    pub overview: String,
    /// Ordered root nodes with nested children; no separate parent_id or links are stored.
    pub nodes: Vec<PlanNode>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanNode {
    /// Unique within this Plan and stable across renaming or moving the node.
    pub id: PlanNodeId,
    pub title: String,
    /// Describes what to explore, not completion criteria the learner must approve.
    pub description: String,
    /// Explicit exploration status; None means no status has been set.
    /// This read API neither derives parent status nor restricts status to leaf nodes.
    pub status: Option<ExplorationStatus>,
    pub children: Vec<PlanNode>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ExplorationStatus {
    Pending,
    InProgress,
    Completed,
}

/// Preserves the existing reader's chapter and paragraph shapes in Rust.
/// Returns the current textbook; historical version management is outside this read API.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Textbook {
    pub id: String,
    pub project_id: ProjectId,
    pub title: String,
    pub subtitle: String,
    pub version: u64,
    pub chapters: Vec<TextbookChapter>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TextbookChapter {
    pub id: String,
    pub title: String,
    pub purpose: String,
    pub sections: Vec<TextbookSection>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TextbookSection {
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub paragraphs: Vec<TextbookParagraph>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TextbookParagraph {
    pub id: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<ParagraphKind>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ParagraphKind {
    Prose,
    Code,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Activity {
    pub id: String,
    pub project_id: ProjectId,
    /// A successful business change, not an intermediate tool execution state.
    pub kind: ActivityKind,
    pub description: String,
    /// RFC 3339 timestamp; reads preserve the original time and record order.
    pub occurred_at: String,
    /// Traceability IDs only; native session messages and tool logs are not copied into Activity.
    pub session_id: String,
    pub tool_call_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ActivityKind {
    GoalUpdated,
    PlanUpdated,
    TextbookRevised,
}

/// A page-level read result that assembles existing data without merging its business entities.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectDetail {
    pub project: Project,
    pub goal: Goal,
    pub plan: Plan,
    /// None until writing starts; no textbook or chapters are fabricated.
    pub textbook: Option<Textbook>,
    /// Project history from business operations; empty until such operations occur.
    pub activities: Vec<Activity>,
}
