use std::{
    collections::HashSet,
    fs,
    io::{ErrorKind, Write},
    path::PathBuf,
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
};

use super::data::{
    LibraryChange, LibraryData, LibrarySection, LibrarySnapshot, PlanNode, Project, ProjectDetail,
};
static LIBRARY_WRITE: Mutex<()> = Mutex::new(());
static NEXT_WRITE: AtomicU64 = AtomicU64::new(0);

/// 兼容旧数组格式；首次修改时保存分区和项目的完整文档。
pub(super) struct ProjectStore {
    path: PathBuf,
}

impl ProjectStore {
    pub(super) fn new(path: PathBuf) -> Self {
        Self { path }
    }

    fn read(&self) -> Result<LibraryData, String> {
        let bytes = match fs::read(&self.path) {
            Ok(bytes) => bytes,
            // 首次启动没有项目是正常状态，读取不能顺手创建示例或空文件。
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(LibraryData::default()),
            Err(_) => {
                return Err(
                    "Could not read the project library. Existing data was not changed.".into(),
                );
            }
        };
        let value: serde_json::Value =
            serde_json::from_slice(&bytes).map_err(|_| invalid_library())?;
        let data = if value.is_array() {
            LibraryData {
                sections: Vec::new(),
                projects: serde_json::from_value(value).map_err(|_| invalid_library())?,
            }
        } else {
            serde_json::from_value(value).map_err(|_| invalid_library())?
        };
        validate_library(&data)?;
        Ok(data)
    }

    pub(super) fn list(&self) -> Result<Vec<Project>, String> {
        Ok(self
            .read()?
            .projects
            .into_iter()
            .map(|detail| detail.project)
            .collect())
    }

    pub(super) fn get(&self, project_id: &str) -> Result<ProjectDetail, String> {
        if !valid_id(project_id) {
            return Err("Enter a valid project ID.".into());
        }
        self.read()?
            .projects
            .into_iter()
            .find(|detail| detail.project.id == project_id)
            .ok_or_else(|| "This project could not be found.".into())
    }
    pub(super) fn library(&self) -> Result<LibrarySnapshot, String> {
        Ok(snapshot(self.read()?))
    }

    pub(super) fn update(&self, change: LibraryChange) -> Result<LibrarySnapshot, String> {
        // 整个读取—修改—写入串行执行，避免并行命令丢失彼此的变更。
        let _guard = LIBRARY_WRITE
            .lock()
            .map_err(|_| "Could not lock the library.")?;
        let mut data = self.read()?;
        match change {
            LibraryChange::CreateSection { id, name } => {
                if !valid_id(&id) || data.sections.iter().any(|s| s.id == id) {
                    return Err("Enter a unique section ID.".into());
                }
                data.sections.push(LibrarySection {
                    id,
                    name: section_name(&name)?,
                });
            }
            LibraryChange::RenameSection { id, name } => {
                let name = section_name(&name)?;
                let section = data
                    .sections
                    .iter_mut()
                    .find(|s| s.id == id)
                    .ok_or("This section could not be found.")?;
                section.name = name;
            }
            LibraryChange::DeleteSection { id } => {
                if !data.sections.iter().any(|s| s.id == id) {
                    return Err("This section could not be found.".into());
                }
                for detail in &mut data.projects {
                    if detail.project.library_section_id.as_deref() == Some(&id) {
                        detail.project.library_section_id = None;
                    }
                }
                data.sections.retain(|s| s.id != id);
            }
            LibraryChange::MoveProject {
                project_id,
                section_id,
            } => {
                if let Some(id) = &section_id {
                    if !data.sections.iter().any(|s| &s.id == id) {
                        return Err("This section could not be found.".into());
                    }
                }
                let detail = data
                    .projects
                    .iter_mut()
                    .find(|d| d.project.id == project_id)
                    .ok_or("This project could not be found.")?;
                detail.project.library_section_id = section_id;
            }
        }
        validate_library(&data)?;
        self.write(&data)?;
        Ok(snapshot(data))
    }

    fn write(&self, data: &LibraryData) -> Result<(), String> {
        let bytes = serde_json::to_vec_pretty(data).map_err(|_| invalid_library())?;
        let parent = self
            .path
            .parent()
            .ok_or("Could not locate the library directory.")?;
        fs::create_dir_all(parent).map_err(|_| "Could not create the library directory.")?;
        let temporary = parent.join(format!(
            ".library-{}-{}.tmp",
            std::process::id(),
            NEXT_WRITE.fetch_add(1, Ordering::Relaxed)
        ));
        // 同目录临时文件写完并刷盘后原子替换；失败不覆盖原有文件。
        let result = (|| -> std::io::Result<()> {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            drop(file);
            fs::rename(&temporary, &self.path)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temporary);
            return Err("Could not save the library. Existing data was not changed.".into());
        }
        Ok(())
    }
}

fn invalid_library() -> String {
    "The saved project library is invalid. Existing data was not changed.".into()
}

fn valid_id(id: &str) -> bool {
    !id.trim().is_empty() && id.len() <= 256 && !id.chars().any(char::is_control)
}

fn validate(projects: &[ProjectDetail]) -> Result<(), String> {
    let mut project_ids = HashSet::new();
    for detail in projects {
        let id = &detail.project.id;
        if !valid_id(id)
            || !project_ids.insert(id)
            || detail.project.title.trim().is_empty()
            || detail.goal.project_id != *id
            || detail.plan.project_id != *id
            || detail.goal.version == 0
            || detail.plan.version == 0
        {
            return Err(invalid_library());
        }

        // children 已经表达树；只校验跨分支 ID 唯一，不引入图或父子双份关系。
        let mut node_ids = HashSet::new();
        validate_nodes(&detail.plan.nodes, &mut node_ids)?;

        if let Some(book) = &detail.textbook {
            if !valid_id(&book.id)
                || book.project_id != *id
                || book.version == 0
                || book.title.trim().is_empty()
            {
                return Err(invalid_library());
            }
            let mut chapter_ids = HashSet::new();
            let mut section_ids = HashSet::new();
            let mut paragraph_ids = HashSet::new();
            for chapter in &book.chapters {
                if !valid_id(&chapter.id) || !chapter_ids.insert(&chapter.id) {
                    return Err(invalid_library());
                }
                for section in &chapter.sections {
                    if !valid_id(&section.id) || !section_ids.insert(&section.id) {
                        return Err(invalid_library());
                    }
                    for paragraph in &section.paragraphs {
                        if !valid_id(&paragraph.id) || !paragraph_ids.insert(&paragraph.id) {
                            return Err(invalid_library());
                        }
                    }
                }
            }
        }

        let mut activity_ids = HashSet::new();
        for activity in &detail.activities {
            if !valid_id(&activity.id)
                || !activity_ids.insert(&activity.id)
                || activity.project_id != *id
                || !valid_id(&activity.session_id)
                || !valid_id(&activity.tool_call_id)
                || activity.description.trim().is_empty()
                || activity.occurred_at.trim().is_empty()
            {
                return Err(invalid_library());
            }
        }
    }
    Ok(())
}

fn validate_nodes<'a>(nodes: &'a [PlanNode], ids: &mut HashSet<&'a str>) -> Result<(), String> {
    for node in nodes {
        if !valid_id(&node.id) || !ids.insert(&node.id) || node.title.trim().is_empty() {
            return Err(invalid_library());
        }
        validate_nodes(&node.children, ids)?;
    }
    Ok(())
}

fn snapshot(data: LibraryData) -> LibrarySnapshot {
    LibrarySnapshot {
        sections: data.sections,
        projects: data.projects.into_iter().map(|d| d.project).collect(),
    }
}
fn section_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 80 || name.chars().any(char::is_control) {
        return Err("Use a section name of 1–80 characters.".into());
    }
    Ok(name.to_string())
}
fn validate_library(data: &LibraryData) -> Result<(), String> {
    let mut ids = HashSet::new();
    for section in &data.sections {
        if !valid_id(&section.id)
            || !ids.insert(&section.id)
            || section_name(&section.name).is_err()
        {
            return Err(invalid_library());
        }
    }
    for detail in &data.projects {
        if let Some(id) = &detail.project.library_section_id {
            if !ids.contains(id) {
                return Err(invalid_library());
            }
        }
    }
    validate(&data.projects)
}
