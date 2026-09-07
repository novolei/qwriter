use super::{assets, cards};
use crate::error::AppError;
use std::fs;

#[test]
fn assets_survive_source_removal_and_deduplicate() {
    let root = std::env::temp_dir().join(format!("qwriter-capture-test-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let image = image::RgbaImage::from_pixel(6, 8, image::Rgba([60, 90, 50, 255]));
    let first = assets::png(&root, image.clone(), "idea.png").unwrap();
    let second = assets::png(&root, image, "same-content.png").unwrap();
    assert_eq!(first.id, second.id);
    assert_eq!(assets::get(&root, &first.id).unwrap().width, Some(6));
    assert!(assets::path(&root, "../credentials.json").is_err());
    assert!(assets::import_bytes(&root, b"<svg>unsafe</svg>", "fake.png").is_err());
    assert_eq!(fs::read_dir(root.join("assets")).unwrap().count(), 1);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn card_revisions_prevent_lost_updates_and_archives_are_reversible() {
    let root = std::env::temp_dir().join(format!("qwriter-card-test-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let original = cards::Card {
        id: uuid::Uuid::new_v4().to_string(),
        title: "灵感".into(),
        body: "A fleeting idea".into(),
        asset_ids: vec![],
        source_url: String::new(),
        pinned: false,
        archived: false,
        created_at: 0,
        updated_at: 0,
        revision: 0,
    };
    let first = cards::save(&root, original).unwrap();
    let mut changed = first.clone();
    changed.archived = true;
    let second = cards::save(&root, changed).unwrap();
    assert!(matches!(
        cards::save(&root, first.clone()),
        Err(AppError::Conflict(_))
    ));
    assert_eq!(cards::list(&root).unwrap()[0].body, first.body);
    let mut restored = second;
    restored.archived = false;
    let restored = cards::save(&root, restored).unwrap();
    assert_eq!(restored.created_at, first.created_at);
    let mut missing = restored;
    missing.asset_ids.push(format!("{}.png", "a".repeat(64)));
    assert!(cards::save(&root, missing).is_err());
    fs::remove_dir_all(root).unwrap();
}
