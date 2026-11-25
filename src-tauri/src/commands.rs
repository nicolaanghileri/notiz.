//! Alle Commands aus CONTRACT.md. Phase 0: nur Stubs, Agent A füllt sie.

// Parameternamen gehören zum Vertrag (Tauri leitet die JS-Namen daraus ab),
// deshalb kein `_`-Präfix. Entfernen, sobald die Stubs implementiert sind.
#![allow(unused_variables)]

use crate::models::{
    AiCommand, Filter, Note, NoteCounts, Range, SearchResult, Settings, SettingsPatch, Source,
};

type CommandResult<T> = Result<T, String>;

fn not_implemented<T>() -> CommandResult<T> {
    Err("not implemented".into())
}

#[tauri::command]
pub fn notes_list(filter: Filter) -> CommandResult<Vec<Note>> {
    not_implemented()
}

#[tauri::command]
pub fn notes_counts() -> CommandResult<NoteCounts> {
    not_implemented()
}

#[tauri::command]
pub fn note_get(id: String) -> CommandResult<Note> {
    not_implemented()
}

#[tauri::command]
pub fn note_create(text: String, source: Source) -> CommandResult<Note> {
    not_implemented()
}

#[tauri::command]
pub fn note_update(id: String, text: String) -> CommandResult<Note> {
    not_implemented()
}

#[tauri::command]
pub fn note_set_pinned(id: String, pinned: bool) -> CommandResult<Note> {
    not_implemented()
}

#[tauri::command]
pub fn note_delete(id: String) -> CommandResult<()> {
    not_implemented()
}

#[tauri::command]
pub fn note_restore(id: String) -> CommandResult<()> {
    not_implemented()
}

#[tauri::command]
pub fn note_delete_forever(id: String) -> CommandResult<()> {
    not_implemented()
}

#[tauri::command]
pub fn search(request_id: String, query: String, range: Range) -> CommandResult<SearchResult> {
    not_implemented()
}

#[tauri::command]
pub fn ai_transform(
    request_id: String,
    command: AiCommand,
    text: String,
    instruction: Option<String>,
) -> CommandResult<()> {
    not_implemented()
}

#[tauri::command]
pub fn ai_summarize_notes(request_id: String, ids: Vec<String>) -> CommandResult<()> {
    not_implemented()
}

#[tauri::command]
pub fn ai_cancel(request_id: String) -> CommandResult<()> {
    not_implemented()
}

#[tauri::command]
pub fn settings_get() -> CommandResult<Settings> {
    not_implemented()
}

#[tauri::command]
pub fn settings_set(partial: SettingsPatch) -> CommandResult<()> {
    not_implemented()
}

#[tauri::command]
pub fn api_key_set(key: String) -> CommandResult<()> {
    not_implemented()
}
