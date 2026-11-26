//! Startet KI-Anfragen im Hintergrund und übersetzt sie in `ai://`-Events.

use std::sync::Arc;

use chrono::{DateTime, Datelike, Local, Timelike};
use tauri::{AppHandle, Emitter, Manager};

use crate::ai::{self, AiEvent, Prompt, Requests, Sink};
use crate::models::{AiChunk, AiDone, AiError, EVENT_AI_CHUNK, EVENT_AI_DONE, EVENT_AI_ERROR};
use crate::secrets::Secrets;

pub struct AiState {
    pub requests: Requests,
    client: reqwest::Client,
    url: String,
}

impl AiState {
    pub fn new() -> Self {
        Self {
            requests: Requests::default(),
            client: ai::http_client(),
            url: ai::API_URL.into(),
        }
    }
}

fn sink(app: &AppHandle) -> Sink {
    let app = app.clone();
    Arc::new(move |id: &str, event: AiEvent| {
        let request_id = id.to_string();
        let result = match event {
            AiEvent::Chunk(delta) => app.emit(EVENT_AI_CHUNK, AiChunk { request_id, delta }),
            AiEvent::Done { text, sources } => app.emit(
                EVENT_AI_DONE,
                AiDone {
                    request_id,
                    text,
                    sources,
                },
            ),
            AiEvent::Error(message) => app.emit(
                EVENT_AI_ERROR,
                AiError {
                    request_id,
                    message,
                },
            ),
        };
        if let Err(error) = result {
            log::warn!("ai-Event nicht gesendet: {error}");
        }
    })
}

/// Startet die Anfrage. `finish` macht aus dem fertigen Text das `ai://done`.
/// Rückgabe `false`: wurde vor dem Start abgebrochen.
pub fn spawn(
    app: &AppHandle,
    request_id: &str,
    prompt: Prompt,
    finish: impl FnOnce(String) -> AiEvent + Send + 'static,
) -> Result<bool, String> {
    let state = app.state::<AiState>();
    let Some(token) = state.requests.begin(request_id)? else {
        return Ok(false);
    };
    let key = app.state::<Secrets>().api_key();
    let app = app.clone();
    let id = request_id.to_string();
    tauri::async_runtime::spawn(async move {
        let state = app.state::<AiState>();
        let sink = sink(&app);
        let key = match key {
            Ok(Some(key)) => key,
            Ok(None) => {
                let message = "Kein API-Key hinterlegt. Bitte in den Einstellungen eintragen.";
                state
                    .requests
                    .finish(&sink, &id, AiEvent::Error(message.into()));
                return;
            }
            Err(message) => {
                state.requests.finish(&sink, &id, AiEvent::Error(message));
                return;
            }
        };
        let on_text = |delta: &str| {
            state
                .requests
                .emit(&sink, &id, AiEvent::Chunk(delta.to_string()));
        };
        tokio::select! {
            _ = token.cancelled() => {}
            result = ai::stream(&state.client, &state.url, &key, &prompt, on_text) => {
                let event = match result {
                    Ok(text) => finish(text),
                    Err(message) => AiEvent::Error(message),
                };
                state.requests.finish(&sink, &id, event);
            }
        }
    });
    Ok(true)
}

const WEEKDAYS: [&str; 7] = [
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
    "Sonntag",
];
const MONTHS: [&str; 12] = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
];

/// „Dienstag, 24. November 2026“
pub fn german_date(time: &DateTime<Local>) -> String {
    format!(
        "{}, {}. {} {}",
        WEEKDAYS[time.weekday().num_days_from_monday() as usize],
        time.day(),
        MONTHS[time.month0() as usize],
        time.year()
    )
}

/// „Dienstag, 24. November 2026, 17:20“ aus einem ISO-Zeitstempel.
pub fn german_datetime(iso: &str) -> String {
    match DateTime::parse_from_rfc3339(iso) {
        Ok(time) => {
            let local = time.with_timezone(&Local);
            format!(
                "{}, {:02}:{:02}",
                german_date(&local),
                local.hour(),
                local.minute()
            )
        }
        Err(_) => iso.to_string(),
    }
}
