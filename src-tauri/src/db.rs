//! SQLite-Verbindung und Migrationen.

use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

/// Reihenfolge = Schema-Version (`PRAGMA user_version`).
/// Bestehende Einträge nie ändern, nur neue anhängen.
const MIGRATIONS: &[&str] = &[
    // 1: Notizen
    "CREATE TABLE notes (
        -- Feste rowid: FTS-Index und Vektoren verweisen darauf.
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        id         TEXT NOT NULL UNIQUE,
        text       TEXT NOT NULL,
        -- ISO-8601 UTC in fester Länge, also als Text vergleichbar.
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        pinned     INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
        source     TEXT NOT NULL CHECK (source IN ('app', 'quick')),
        deleted_at TEXT
    );
    CREATE INDEX notes_created_at ON notes (created_at DESC);",
    // 2: Volltextindex, synchron per Trigger
    "CREATE VIRTUAL TABLE notes_fts USING fts5(
        text,
        content = 'notes',
        content_rowid = 'seq',
        tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts (rowid, text) VALUES (new.seq, new.text);
    END;
    CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts (notes_fts, rowid, text) VALUES ('delete', old.seq, old.text);
    END;
    CREATE TRIGGER notes_fts_update AFTER UPDATE OF text ON notes BEGIN
        INSERT INTO notes_fts (notes_fts, rowid, text) VALUES ('delete', old.seq, old.text);
        INSERT INTO notes_fts (rowid, text) VALUES (new.seq, new.text);
    END;
    INSERT INTO notes_fts (notes_fts) VALUES ('rebuild');",
];

pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)
                .map_err(|e| format!("Datenordner kann nicht angelegt werden: {e}"))?;
        }
        Connection::open(path)
            .and_then(Self::init)
            .map_err(|e| format!("Datenbank kann nicht geöffnet werden: {e}"))
    }

    #[cfg(test)]
    pub fn in_memory() -> Self {
        Connection::open_in_memory().and_then(Self::init).unwrap()
    }

    fn init(mut conn: Connection) -> rusqlite::Result<Self> {
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", true)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        migrate(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Kurz halten: nie während KI-Aufrufen oder Embedding-Berechnung.
    pub fn lock(&self) -> MutexGuard<'_, Connection> {
        // Ein Panic in einem anderen Thread macht die Verbindung nicht unbrauchbar
        // (offene Transaktionen werden beim Drop zurückgerollt).
        self.conn.lock().unwrap_or_else(|e| e.into_inner())
    }
}

fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    for (target, sql) in (1i64..).zip(MIGRATIONS) {
        if target <= version {
            continue;
        }
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", target)?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path() -> std::path::PathBuf {
        std::env::temp_dir()
            .join(format!("notiz-test-{}", uuid::Uuid::new_v4()))
            .join("notiz.db")
    }

    #[test]
    fn migrates_and_reopens() {
        let path = temp_path();
        {
            let db = Db::open(&path).unwrap();
            db.lock()
                .execute(
                    "INSERT INTO notes (id, text, created_at, updated_at, source)
                     VALUES ('a', 'x', 't', 't', 'app')",
                    [],
                )
                .unwrap();
        }
        let db = Db::open(&path).unwrap();
        let conn = db.lock();
        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        let count: i64 = conn
            .query_row("SELECT count(*) FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!((version, count), (MIGRATIONS.len() as i64, 1));
        drop(conn);
        drop(db);
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn upgrades_every_older_version_without_data_loss() {
        for start in 1..=MIGRATIONS.len() {
            let mut conn = Connection::open_in_memory().unwrap();
            for sql in &MIGRATIONS[..start] {
                conn.execute_batch(sql).unwrap();
            }
            conn.pragma_update(None, "user_version", start as i64)
                .unwrap();
            conn.execute(
                "INSERT INTO notes (id, text, created_at, updated_at, source)
                 VALUES ('a', 'Heizung', 't', 't', 'app')",
                [],
            )
            .unwrap();
            migrate(&mut conn).unwrap();
            let text: String = conn
                .query_row("SELECT text FROM notes", [], |row| row.get(0))
                .unwrap();
            assert_eq!(text, "Heizung");
        }
    }
}
