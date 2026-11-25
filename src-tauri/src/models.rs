//! Typen aus CONTRACT.md. Gegenstück: src/lib/types.ts.
//! Nicht eigenmächtig ändern, siehe AGENTS.md.

// Phase 0: Felder und Events werden erst von Agent A benutzt. Danach entfernen.
#![allow(dead_code)]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    App,
    Quick,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub text: String,
    /// ISO-8601, UTC
    pub created_at: String,
    /// ISO-8601, UTC
    pub updated_at: String,
    pub pinned: bool,
    pub source: Source,
    /// `Some` → im Papierkorb
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Filter {
    All,
    Today,
    Last7,
    Quick,
    Pinned,
    Trash,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Range {
    All,
    LastMonth,
    ThisYear,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AiCommand {
    Improve,
    Correct,
    Summarize,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Tier {
    Match,
    /// Abschnitt „Weniger passend“
    Weak,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub note: Note,
    /// Zeichen-Bereiche [start, end) in `note.text`
    pub highlights: Vec<(usize, usize)>,
    pub score: f64,
    pub tier: Tier,
}

/// Rückgabe von `search`
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub hits: Vec<SearchHit>,
    /// Die übergebene `request_id`, wenn eine Kurzantwort folgt (nur bei einer Frage), sonst `None`
    pub answer_request_id: Option<String>,
}

/// Rückgabe von `notes_counts` (`Record<Filter, number>`)
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteCounts {
    pub all: u32,
    pub today: u32,
    pub last7: u32,
    pub quick: u32,
    pub pinned: u32,
    pub trash: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: Theme,
    /// z. B. "Alt+Space" / "Ctrl+Shift+Space"
    pub capture_shortcut: String,
    pub has_api_key: bool,
}

/// Parameter von `settings_set` (`Partial<Settings>` ohne `hasApiKey`)
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub theme: Option<Theme>,
    pub capture_shortcut: Option<String>,
}

// Events (Backend → Frontend)

pub const EVENT_AI_CHUNK: &str = "ai://chunk";
pub const EVENT_AI_DONE: &str = "ai://done";
pub const EVENT_AI_ERROR: &str = "ai://error";
pub const EVENT_NOTES_CHANGED: &str = "notes://changed";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChunk {
    pub request_id: String,
    pub delta: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDone {
    pub request_id: String,
    pub text: String,
    /// Note-IDs, auf die sich eine Kurzantwort stützt
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiError {
    pub request_id: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesChanged {
    pub id: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{from_value, json, to_value};

    #[test]
    fn json_matches_contract() {
        let hit = SearchHit {
            note: Note {
                id: "1".into(),
                text: "Heizung".into(),
                created_at: "2026-11-25T08:14:00Z".into(),
                updated_at: "2026-11-25T08:14:00Z".into(),
                pinned: false,
                source: Source::Quick,
                deleted_at: None,
            },
            highlights: vec![(0, 7)],
            score: 0.5,
            tier: Tier::Weak,
        };
        let result = SearchResult {
            hits: vec![hit],
            answer_request_id: None,
        };
        assert_eq!(
            to_value(result).unwrap(),
            json!({
                "hits": [{
                    "note": {
                        "id": "1",
                        "text": "Heizung",
                        "createdAt": "2026-11-25T08:14:00Z",
                        "updatedAt": "2026-11-25T08:14:00Z",
                        "pinned": false,
                        "source": "quick",
                        "deletedAt": null
                    },
                    "highlights": [[0, 7]],
                    "score": 0.5,
                    "tier": "weak"
                }],
                "answerRequestId": null
            })
        );
    }

    #[test]
    fn enums_match_contract() {
        for name in ["all", "today", "last7", "quick", "pinned", "trash"] {
            from_value::<Filter>(json!(name)).unwrap();
        }
        for name in ["all", "lastMonth", "thisYear"] {
            from_value::<Range>(json!(name)).unwrap();
        }
        for name in ["improve", "correct", "summarize", "custom"] {
            from_value::<AiCommand>(json!(name)).unwrap();
        }
        assert!(
            to_value(NoteCounts::default())
                .unwrap()
                .get("last7")
                .is_some()
        );
    }

    #[test]
    fn settings_patch_is_partial() {
        let patch: SettingsPatch = from_value(json!({ "theme": "dark" })).unwrap();
        assert_eq!(patch.theme, Some(Theme::Dark));
        assert_eq!(patch.capture_shortcut, None);
    }
}
