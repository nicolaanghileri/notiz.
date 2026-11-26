//! Alle Commands aus CONTRACT.md.

use tauri::{AppHandle, Emitter, Manager, State};

use crate::ai::{self, AiEvent, PromptNote};
use crate::ai_runner::{self, AiState};
use crate::db::Db;
use crate::embedder::SemanticIndex;
use crate::models::{
    AiCommand, EVENT_NOTES_CHANGED, Filter, Note, NoteCounts, NotesChanged, Range, SearchHit,
    SearchResult, Settings, SettingsPatch, Source, Tier,
};
use crate::notes;
use crate::secrets::Secrets;
use crate::settings;

type CommandResult<T> = Result<T, String>;

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
    app: AppHandle,
    db: State<Db>,
    index: State<SemanticIndex>,
    request_id: String,
    query: String,
    range: Range,
) -> CommandResult<SearchResult> {
    // Erst den Vektor berechnen, dann die Datenbank sperren.
    let vector = index.query_vector(&query);
    let hits = crate::search::search(&db.lock(), &query, range, vector.as_deref())?;
    let answer_request_id = start_answer(&app, &request_id, &query, &hits)?;
    Ok(SearchResult {
        hits,
        answer_request_id,
    })
}

/// Höchstens so viele Notizen fliessen in die Kurzantwort ein.
const MAX_ANSWER_SOURCES: usize = 5;

/// Kurzantwort nur bei einer Frage und nur aus „passenden“ Treffern.
/// Die Quellen `[n]` zählen in der Reihenfolge von `hits`.
fn start_answer(
    app: &AppHandle,
    request_id: &str,
    query: &str,
    hits: &[SearchHit],
) -> CommandResult<Option<String>> {
    let sources: Vec<&SearchHit> = hits
        .iter()
        .take_while(|hit| hit.tier == Tier::Match)
        .take(MAX_ANSWER_SOURCES)
        .collect();
    if !crate::search::text::is_question(query) || sources.is_empty() {
        return Ok(None);
    }
    let notes: Vec<PromptNote> = sources
        .iter()
        .map(|hit| PromptNote {
            date: ai_runner::german_datetime(&hit.note.created_at),
            text: &hit.note.text,
        })
        .collect();
    let today = ai_runner::german_date(&chrono::Local::now());
    let prompt = ai::answer_prompt(query, &notes, &today);
    let ids: Vec<String> = sources.iter().map(|hit| hit.note.id.clone()).collect();
    app.state::<AiState>().requests.replace_answer(request_id);
    let started = ai_runner::spawn(app, request_id, prompt, move |text| {
        let (text, cited) = ai::check_citations(&text, ids.len());
        AiEvent::Done {
            text,
            sources: Some(cited.into_iter().map(|n| ids[n - 1].clone()).collect()),
        }
    })?;
    Ok(started.then(|| request_id.to_string()))
}

#[tauri::command(async)]
pub fn ai_transform(
    app: AppHandle,
    request_id: String,
    command: AiCommand,
    text: String,
    instruction: Option<String>,
) -> CommandResult<()> {
    let prompt = ai::transform_prompt(command, &text, instruction.as_deref())?;
    ai_runner::spawn(&app, &request_id, prompt, move |result| AiEvent::Done {
        text: ai::keep_outer_whitespace(&text, &result),
        sources: None,
    })?;
    Ok(())
}

#[tauri::command(async)]
pub fn ai_summarize_notes(
    app: AppHandle,
    db: State<Db>,
    request_id: String,
    ids: Vec<String>,
) -> CommandResult<()> {
    if ids.is_empty() {
        return Err("Keine Notizen ausgewählt".into());
    }
    let found: Vec<Note> = {
        let conn = db.lock();
        ids.iter()
            .map(|id| notes::get(&conn, id))
            .collect::<CommandResult<_>>()?
    };
    let prompt_notes: Vec<PromptNote> = found
        .iter()
        .map(|note| PromptNote {
            date: ai_runner::german_datetime(&note.created_at),
            text: &note.text,
        })
        .collect();
    let prompt = ai::summarize_notes_prompt(&prompt_notes);
    ai_runner::spawn(&app, &request_id, prompt, |text| AiEvent::Done {
        text: text.trim().to_string(),
        sources: None,
    })?;
    Ok(())
}

#[tauri::command(async)]
pub fn ai_cancel(state: State<AiState>, request_id: String) -> CommandResult<()> {
    state.requests.cancel(&request_id);
    Ok(())
}

#[tauri::command(async)]
pub fn settings_get(db: State<Db>, secrets: State<Secrets>) -> CommandResult<Settings> {
    // Ist der Keychain nicht lesbar, gilt das als „kein Key“; die KI meldet den Fehler.
    let has_api_key = secrets.api_key().map(|key| key.is_some()).unwrap_or(false);
    settings::get(&db.lock(), has_api_key)
}

#[tauri::command(async)]
pub fn settings_set(app: AppHandle, db: State<Db>, partial: SettingsPatch) -> CommandResult<()> {
    // Erst registrieren: ist das Kürzel belegt, bleibt alles beim Alten.
    if let Some(shortcut) = &partial.capture_shortcut {
        crate::capture::set_shortcut(&app, shortcut)?;
    }
    settings::set(&db.lock(), &partial)
}

#[tauri::command(async)]
pub fn api_key_set(secrets: State<Secrets>, key: String) -> CommandResult<()> {
    secrets.set_api_key(&key)
}
