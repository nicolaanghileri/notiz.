//! Einstellungen in SQLite. Der API-Key liegt nicht hier, sondern im Keychain.

use rusqlite::{Connection, OptionalExtension, params};

use crate::models::{Settings, SettingsPatch, Theme};
use crate::notes::db_error;

/// Unter Windows ist Alt+Leertaste vom System belegt.
pub const DEFAULT_SHORTCUT: &str = if cfg!(target_os = "macos") {
    "Alt+Space"
} else {
    "Ctrl+Shift+Space"
};

const THEME: &str = "theme";
const CAPTURE_SHORTCUT: &str = "captureShortcut";

fn read(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
        row.get(0)
    })
    .optional()
    .map_err(db_error)
}

fn write(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map(drop)
    .map_err(db_error)
}

pub fn theme(conn: &Connection) -> Result<Theme, String> {
    Ok(read(conn, THEME)?
        .and_then(|value| serde_json::from_value(serde_json::Value::String(value)).ok())
        .unwrap_or(Theme::System))
}

pub fn capture_shortcut(conn: &Connection) -> Result<String, String> {
    Ok(read(conn, CAPTURE_SHORTCUT)?.unwrap_or_else(|| DEFAULT_SHORTCUT.to_string()))
}

pub fn get(conn: &Connection, has_api_key: bool) -> Result<Settings, String> {
    Ok(Settings {
        theme: theme(conn)?,
        capture_shortcut: capture_shortcut(conn)?,
        has_api_key,
    })
}

/// Speichert nur die gesetzten Felder. Den Shortcut vorher prüfen/registrieren.
pub fn set(conn: &Connection, patch: &SettingsPatch) -> Result<(), String> {
    if let Some(theme) = patch.theme {
        let value = serde_json::to_value(theme).map_err(|e| e.to_string())?;
        write(conn, THEME, value.as_str().unwrap_or("system"))?;
    }
    if let Some(shortcut) = &patch.capture_shortcut {
        write(conn, CAPTURE_SHORTCUT, shortcut)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    #[test]
    fn defaults_and_partial_updates() {
        let db = Db::in_memory();
        let conn = db.lock();
        let settings = get(&conn, false).unwrap();
        assert_eq!(settings.theme, Theme::System);
        assert_eq!(settings.capture_shortcut, DEFAULT_SHORTCUT);

        set(
            &conn,
            &SettingsPatch {
                theme: Some(Theme::Dark),
                capture_shortcut: None,
            },
        )
        .unwrap();
        set(
            &conn,
            &SettingsPatch {
                theme: None,
                capture_shortcut: Some("Ctrl+Alt+N".into()),
            },
        )
        .unwrap();
        let settings = get(&conn, true).unwrap();
        assert_eq!(settings.theme, Theme::Dark);
        assert_eq!(settings.capture_shortcut, "Ctrl+Alt+N");
        assert!(settings.has_api_key);
        let raw: String = conn
            .query_row("SELECT value FROM settings WHERE key = 'theme'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(raw, "dark");
    }
}
