//! Alle Commands aus CONTRACT.md.

// Parameternamen gehören zum Vertrag (Tauri leitet die JS-Namen daraus ab),
// deshalb kein `_`-Präfix. Entfernen, sobald die Stubs implementiert sind.
#![allow(unused_variables)]

use tauri::{AppHandle, Emitter, State};

use crate::db::Db;
use crate::embedder::SemanticIndex;
use crate::models::{
    AiCommand, EVENT_NOTES_CHANGED, Filter, Note, NoteCounts, NotesChanged, Range, SearchResult,
    Settings, SettingsPatch, Source,
};
use crate::notes;

type CommandResult<T> = Result<T, String>;

fn not_implemented<T>() -> CommandResult<T> {
    Err("not implemented".into())
}

#[tauri::command(async)]
pub fn notes_list(db: State<Db>, filter: Filter) -> CommandResult<Vec<Note>> {
    notes::list(&db.lock(), filter)
}

#[tauri::command(async)]
pub fn notes_counts(db: State<Db>) -> CommandResult<NoteCounts> {
    notes::counts(&db.lock())
}

#[tauri::command(async)]
pub fn note_get(db: State<Db>, id: String) -> CommandResult<Note> {
    notes::get(&db.lock(), &id)
}

#[tauri::command(async)]
pub fn note_create(
    app: AppHandle,
    db: State<Db>,
    index: State<SemanticIndex>,
    text: String,
    source: Source,
) -> CommandResult<Note> {
    let note = notes::create(&db.lock(), &text, source)?;
    index.notify_changed();
    // Quick Capture läuft in einem eigenen Fenster, das Hauptfenster weiss nichts davon.
    if source == Source::Quick {
        let payload = NotesChanged {
            id: note.id.clone(),
        };
        if let Err(error) = app.emit(EVENT_NOTES_CHANGED, payload) {
            log::warn!("{EVENT_NOTES_CHANGED}: {error}");
        }
    }
    Ok(note)
}

#[tauri::command(async)]
pub fn note_update(
    db: State<Db>,
    index: State<SemanticIndex>,
    id: String,
    text: String,
) -> CommandResult<Note> {
    let note = notes::update(&db.lock(), &id, &text)?;
    index.notify_changed();
    Ok(note)
}

#[tauri::command(async)]
pub fn note_set_pinned(db: State<Db>, id: String, pinned: bool) -> CommandResult<Note> {
    notes::set_pinned(&db.lock(), &id, pinned)
}

#[tauri::command(async)]
pub fn note_delete(db: State<Db>, id: String) -> CommandResult<()> {
    notes::delete(&db.lock(), &id)
}

#[tauri::command(async)]
pub fn note_restore(db: State<Db>, id: String) -> CommandResult<()> {
    notes::restore(&db.lock(), &id)
}

#[tauri::command(async)]
pub fn note_delete_forever(db: State<Db>, id: String) -> CommandResult<()> {
    notes::delete_forever(&db.lock(), &id)
}

#[tauri::command(async)]
pub fn search(
    db: State<Db>,
    index: State<SemanticIndex>,
    request_id: String,
    query: String,
    range: Range,
) -> CommandResult<SearchResult> {
    // Erst den Vektor berechnen, dann die Datenbank sperren.
    let vector = index.query_vector(&query);
    let hits = crate::search::search(&db.lock(), &query, range, vector.as_deref())?;
    Ok(SearchResult {
        hits,
        answer_request_id: None,
    })
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
