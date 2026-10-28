use serde::{Deserialize, Serialize};

/// 接口中的 ID 是不透明字符串；项目与节点的 ID 不能通过标题推导。
pub type ProjectId = String;
pub type PlanNodeId = String;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub id: ProjectId,
    pub title: String,
    /// 列表中的简短介绍，不替代用户的 Goal。
    pub description: String,
    /// Library 的组织位置；不属于教材内容，也不生成业务 Activity。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub library_section_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LibrarySection {
    pub id: String,
    pub name: String,
}

/// 分区和项目归属同文件提交，删除分区时不会留下悬空引用。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct LibraryData {
    pub sections: Vec<LibrarySection>,
    pub projects: Vec<ProjectDetail>,
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
    /// 当前状态的写入版本；不承诺存在可查询的历史快照。
    pub version: u64,
    /// 当前目标正文，可使用 Markdown；尚未形成目标时为空。
    pub content: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Plan {
    pub project_id: ProjectId,
    /// 整份计划的状态版本，节点暂不单独维护版本。
    pub version: u64,
    pub overview: String,
    /// 有序的根节点列表；直接嵌套 children，不额外保存 parent_id 或 links。
    pub nodes: Vec<PlanNode>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanNode {
    /// 在本 Plan 内唯一，改名和移动时保持不变。
    pub id: PlanNodeId,
    pub title: String,
    /// 说明准备探究什么，不作为用户必须审定的完成标准。
    pub description: String,
    /// 显式记录的探索状态；None 表示尚未设置。
    /// 本轮读取接口不推导父节点状态，也不强制“仅叶子能有状态”。
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

/// 本轮沿用现有阅读器的章节、段落形状，仅映射到 Rust。
/// 这里返回当前教材；历史版本管理不在此次读取接口中实现。
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
    /// 成功发生的业务事实，不是工具执行的中间状态。
    pub kind: ActivityKind,
    pub description: String,
    /// RFC 3339 时间；读取时保留原始时间与记录顺序。
    pub occurred_at: String,
    /// 只保存追溯标识，不把原生会话消息和工具日志复制到 Activity。
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

/// 页面读取结果：汇集项目已有数据，不意味着把所有对象合并为一个业务实体。
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectDetail {
    pub project: Project,
    pub goal: Goal,
    pub plan: Plan,
    /// 尚未开始编撰时为 None，不伪造教材和章节。
    pub textbook: Option<Textbook>,
    /// 业务操作产生的项目历史；没有操作时返回空列表。
    pub activities: Vec<Activity>,
}
