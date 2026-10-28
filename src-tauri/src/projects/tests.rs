use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};

use serde_json::{Value, json};

use super::{
    data::{ExplorationStatus, ProjectDetail},
    store::ProjectStore,
};

const FIXTURE: &str = include_str!("fixtures/backend-interview.json");
static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(0);

#[test]
fn development_projects_use_the_same_native_read_contract() {
    let library = TestLibrary::new();
    library.write(include_str!("../../../src/mock-data/projects.json"));
    let projects = library.store().list().unwrap();
    assert_eq!(projects.len(), 6);
    for project in projects {
        let detail = library.store().get(&project.id).unwrap();
        assert_eq!(detail.project.id, project.id);
        assert!(!detail.plan.nodes.is_empty());
    }
}

// 每个测试使用独立临时目录，不读取或覆盖用户的实际项目文件。
struct TestLibrary {
    directory: PathBuf,
    path: PathBuf,
}

impl TestLibrary {
    fn new() -> Self {
        let directory = std::env::temp_dir().join(format!(
            "swartz-projects-{}-{}",
            std::process::id(),
            NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&directory).unwrap();
        let path = directory.join("projects.json");
        Self { directory, path }
    }

    fn store(&self) -> ProjectStore {
        ProjectStore::new(self.path.clone())
    }

    fn write(&self, data: &str) {
        fs::write(&self.path, data).unwrap();
    }
}

impl Drop for TestLibrary {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
        let _ = fs::remove_dir(&self.directory);
    }
}

#[test]
fn first_launch_is_empty_without_creating_or_seeding_a_library() {
    let library = TestLibrary::new();
    assert!(library.store().list().unwrap().is_empty());
    assert!(!library.path.exists());
    assert_eq!(
        library.store().get("missing").unwrap_err(),
        "This project could not be found."
    );
    assert!(!library.path.exists());
}

#[test]
fn list_returns_only_metadata_and_detail_restores_tree_textbook_and_activities() {
    let library = TestLibrary::new();
    library.write(FIXTURE);
    let list = serde_json::to_value(library.store().list().unwrap()).unwrap();
    let source: Value = serde_json::from_str(FIXTURE).unwrap();
    assert_eq!(list, json!([source[0]["project"]]));

    let detail = library.store().get("project-backend-interview").unwrap();
    assert_eq!(detail.goal.version, 1);
    assert_eq!(detail.plan.version, 3);
    assert_eq!(detail.plan.nodes[0].children[1].id, "transaction");
    assert!(matches!(
        detail.plan.nodes[0].children[1].status,
        Some(ExplorationStatus::InProgress)
    ));
    assert_eq!(
        detail.textbook.as_ref().unwrap().chapters[0].sections[0]
            .paragraphs
            .len(),
        1
    );
    assert_eq!(detail.activities.len(), 3);
    assert_eq!(detail.activities[2].session_id, "session-backend-1");
    assert_eq!(detail.activities[2].tool_call_id, "call-update-textbook");

    // 同一份数据重新打开仍可读取；接口采用 camelCase，正文与状态无损往返。
    assert_eq!(serde_json::to_value(detail).unwrap(), source[0]);
    assert_eq!(
        library
            .store()
            .get("project-backend-interview")
            .unwrap()
            .activities
            .len(),
        3
    );
    assert_eq!(fs::read_to_string(&library.path).unwrap(), FIXTURE);
}

#[test]
fn projects_are_selected_by_id_and_do_not_mix_goals_or_activity_logs() {
    let library = TestLibrary::new();
    let mut first: Value = serde_json::from_str(FIXTURE).unwrap();
    let mut second: Value =
        serde_json::from_str(&FIXTURE.replace("project-backend-interview", "project-rust"))
            .unwrap();
    second[0]["project"]["title"] = json!("Rust 探索");
    second[0]["goal"]["content"] = json!("理解所有权");
    second[0]["activities"] = json!([]);
    first.as_array_mut().unwrap().push(second[0].clone());
    library.write(&first.to_string());

    assert_eq!(library.store().list().unwrap().len(), 2);
    let detail = library.store().get("project-rust").unwrap();
    assert_eq!(detail.project.title, "Rust 探索");
    assert_eq!(detail.goal.content, "理解所有权");
    assert!(detail.activities.is_empty());
    assert_eq!(
        library
            .store()
            .get("project-backend-interview")
            .unwrap()
            .activities
            .len(),
        3
    );
}

#[test]
fn a_project_can_exist_before_a_goal_plan_or_textbook_has_content() {
    let library = TestLibrary::new();
    let mut data: Value = serde_json::from_str(FIXTURE).unwrap();
    data[0]["goal"]["content"] = json!("");
    data[0]["plan"]["overview"] = json!("");
    data[0]["plan"]["nodes"] = json!([]);
    data[0]["textbook"] = Value::Null;
    data[0]["activities"] = json!([]);
    library.write(&data.to_string());
    let detail = library.store().get("project-backend-interview").unwrap();
    assert!(detail.goal.content.is_empty());
    assert!(detail.plan.nodes.is_empty());
    assert!(detail.textbook.is_none());
    assert!(detail.activities.is_empty());
}

#[test]
fn invalid_files_and_cross_project_references_are_reported_without_rewriting_bytes() {
    let library = TestLibrary::new();
    for bytes in ["not JSON", "{}", "[", "[null]"] {
        library.write(bytes);
        assert!(library.store().list().is_err());
        assert_eq!(fs::read_to_string(&library.path).unwrap(), bytes);
    }
    for pointer in [
        "/0/goal/projectId",
        "/0/plan/projectId",
        "/0/textbook/projectId",
        "/0/activities/0/projectId",
    ] {
        let mut data: Value = serde_json::from_str(FIXTURE).unwrap();
        *data.pointer_mut(pointer).unwrap() = json!("another-project");
        let bytes = data.to_string();
        library.write(&bytes);
        assert!(
            library.store().get("project-backend-interview").is_err(),
            "{pointer}"
        );
        assert_eq!(fs::read_to_string(&library.path).unwrap(), bytes);
    }
}

#[test]
fn duplicate_identities_and_zero_versions_cannot_appear_as_valid_details() {
    let library = TestLibrary::new();
    let source: Value = serde_json::from_str(FIXTURE).unwrap();
    let mut cases = vec![json!([source[0], source[0]])];
    for pointer in ["/0/goal/version", "/0/plan/version", "/0/textbook/version"] {
        let mut data = source.clone();
        *data.pointer_mut(pointer).unwrap() = json!(0);
        cases.push(data);
    }
    let mut duplicate_node = source.clone();
    duplicate_node[0]["plan"]["nodes"][1]["children"][0]["id"] = json!("transaction");
    cases.push(duplicate_node);
    let mut duplicate_activity = source.clone();
    duplicate_activity[0]["activities"][1]["id"] = json!("activity-goal");
    cases.push(duplicate_activity);
    for data in cases {
        let bytes = data.to_string();
        library.write(&bytes);
        assert!(library.store().list().is_err());
        assert_eq!(fs::read_to_string(&library.path).unwrap(), bytes);
    }
}

#[test]
fn unknown_business_activity_kinds_are_not_silently_dropped() {
    let library = TestLibrary::new();
    let mut data: Value = serde_json::from_str(FIXTURE).unwrap();
    data[0]["activities"][0]["kind"] = json!("proposal_created");
    let bytes = data.to_string();
    library.write(&bytes);
    assert!(library.store().get("project-backend-interview").is_err());
    assert_eq!(fs::read_to_string(&library.path).unwrap(), bytes);
}

#[test]
fn empty_ids_are_rejected_and_project_ids_are_not_used_as_paths() {
    let library = TestLibrary::new();
    library.write(FIXTURE);
    assert_eq!(
        library.store().get(" ").unwrap_err(),
        "Enter a valid project ID."
    );
    assert_eq!(
        library.store().get("../projects.json").unwrap_err(),
        "This project could not be found."
    );
    let directory_store = ProjectStore::new(library.directory.clone());
    assert!(directory_store.list().is_err());
    assert_eq!(fs::read_to_string(&library.path).unwrap(), FIXTURE);
}

#[test]
fn no_status_or_branch_aggregation_is_invented_by_the_read_api() {
    let library = TestLibrary::new();
    let mut data: Value = serde_json::from_str(FIXTURE).unwrap();
    data[0]["plan"]["nodes"][0]["status"] = json!("in_progress");
    data[0]["plan"]["nodes"][0]["children"][0]["status"] = Value::Null;
    library.write(&data.to_string());
    let detail: ProjectDetail = library.store().get("project-backend-interview").unwrap();
    assert!(matches!(
        detail.plan.nodes[0].status,
        Some(ExplorationStatus::InProgress)
    ));
    assert!(detail.plan.nodes[0].children[0].status.is_none());
    assert_eq!(serde_json::to_value(detail).unwrap(), data[0]);
}

#[test]
fn section_lifecycle_persists_and_does_not_modify_business_state() {
    use super::data::LibraryChange::*;
    let library = TestLibrary::new();
    library.write(FIXTURE);
    let before =
        serde_json::to_value(library.store().get("project-backend-interview").unwrap()).unwrap();
    let result = library
        .store()
        .update(CreateSection {
            id: "systems".into(),
            name: " Systems ".into(),
        })
        .unwrap();
    assert_eq!(result.sections[0].name, "Systems");
    library
        .store()
        .update(MoveProject {
            project_id: "project-backend-interview".into(),
            section_id: Some("systems".into()),
        })
        .unwrap();
    assert_eq!(
        library
            .store()
            .get("project-backend-interview")
            .unwrap()
            .project
            .library_section_id
            .as_deref(),
        Some("systems")
    );
    library
        .store()
        .update(RenameSection {
            id: "systems".into(),
            name: "Backend".into(),
        })
        .unwrap();
    assert_eq!(
        library.store().library().unwrap().sections[0].name,
        "Backend"
    );
    library
        .store()
        .update(DeleteSection {
            id: "systems".into(),
        })
        .unwrap();
    assert!(library.store().library().unwrap().sections.is_empty());
    let after =
        serde_json::to_value(library.store().get("project-backend-interview").unwrap()).unwrap();
    assert_eq!(before, after);
    assert!(fs::read_to_string(&library.path).unwrap().starts_with('{'));
}

#[test]
fn invalid_section_operations_leave_saved_bytes_unchanged() {
    use super::data::LibraryChange::*;
    let library = TestLibrary::new();
    library.write(FIXTURE);
    let changes = vec![
        CreateSection {
            id: "x".into(),
            name: " ".into(),
        },
        RenameSection {
            id: "missing".into(),
            name: "Backend".into(),
        },
        DeleteSection {
            id: "missing".into(),
        },
        MoveProject {
            project_id: "project-backend-interview".into(),
            section_id: Some("missing".into()),
        },
        MoveProject {
            project_id: "missing".into(),
            section_id: None,
        },
    ];
    for change in changes {
        assert!(library.store().update(change).is_err());
        assert_eq!(fs::read_to_string(&library.path).unwrap(), FIXTURE);
    }
    library.write("invalid");
    assert!(
        library
            .store()
            .update(CreateSection {
                id: "x".into(),
                name: "Backend".into()
            })
            .is_err()
    );
    assert_eq!(fs::read_to_string(&library.path).unwrap(), "invalid");
}

#[test]
fn concurrent_section_writes_do_not_lose_updates() {
    let library = TestLibrary::new();
    std::thread::scope(|scope| {
        for n in 0..8 {
            let path = library.path.clone();
            scope.spawn(move || {
                ProjectStore::new(path)
                    .update(super::data::LibraryChange::CreateSection {
                        id: format!("section-{n}"),
                        name: format!("Section {n}"),
                    })
                    .unwrap();
            });
        }
    });
    assert_eq!(library.store().library().unwrap().sections.len(), 8);
}

#[test]
fn dangling_section_references_and_duplicate_sections_are_rejected() {
    let library = TestLibrary::new();
    let projects: Value = serde_json::from_str(FIXTURE).unwrap();
    let mut data = json!({"sections": [], "projects": projects});
    data["projects"][0]["project"]["librarySectionId"] = json!("missing");
    library.write(&data.to_string());
    assert!(library.store().library().is_err());
    data["sections"] = json!([{"id":"missing","name":"One"},{"id":"missing","name":"Two"}]);
    library.write(&data.to_string());
    assert!(library.store().library().is_err());
}

#[test]
fn batch_move_validates_every_project_before_saving() {
    use super::data::LibraryChange;
    let library = TestLibrary::new();
    library.write(include_str!("../../../src/mock-data/projects.json"));
    let store = library.store();
    store
        .update(LibraryChange::CreateSection {
            id: "systems".into(),
            name: "Systems".into(),
        })
        .unwrap();
    let before = fs::read(&library.path).unwrap();
    let ids: Vec<_> = store
        .list()
        .unwrap()
        .iter()
        .take(2)
        .map(|p| p.id.clone())
        .collect();
    for invalid in [
        vec![ids[0].clone(), "missing".into()],
        vec![],
        vec![ids[0].clone(), ids[0].clone()],
    ] {
        assert!(
            store
                .update(LibraryChange::MoveProjects {
                    project_ids: invalid,
                    section_id: Some("systems".into())
                })
                .is_err()
        );
        assert_eq!(fs::read(&library.path).unwrap(), before);
    }
    assert!(
        store
            .update(LibraryChange::MoveProjects {
                project_ids: ids.clone(),
                section_id: Some("missing".into())
            })
            .is_err()
    );
    assert_eq!(fs::read(&library.path).unwrap(), before);
    store
        .update(LibraryChange::MoveProjects {
            project_ids: ids.clone(),
            section_id: Some("systems".into()),
        })
        .unwrap();
    assert!(
        store
            .list()
            .unwrap()
            .iter()
            .filter(|p| ids.contains(&p.id))
            .all(|p| p.library_section_id.as_deref() == Some("systems"))
    );
    store
        .update(LibraryChange::DeleteSection {
            id: "systems".into(),
        })
        .unwrap();
    assert_eq!(store.list().unwrap().len(), 6);
    assert!(
        store
            .list()
            .unwrap()
            .iter()
            .all(|p| p.library_section_id.is_none())
    );
}
