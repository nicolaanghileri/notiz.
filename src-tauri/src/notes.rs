//! Lesen und Schreiben von Notizen.

use chrono::{DateTime, Local, TimeZone};
use rusqlite::{Connection, Row, params, types::Type};
use uuid::Uuid;

use crate::models::{Filter, Note, NoteCounts, Source};
use crate::timerange::{Bounds, filter_bounds, now_iso};

pub const COLUMNS: &str = "id, text, created_at, updated_at, pinned, source, deleted_at";

const NOT_FOUND: &str = "Notiz nicht gefunden";

pub fn db_error(error: rusqlite::Error) -> String {
    match error {
        rusqlite::Error::QueryReturnedNoRows => NOT_FOUND.into(),
        other => format!("Datenbankfehler: {other}"),
    }
}

fn source_to_sql(source: Source) -> &'static str {
    match source {
        Source::App => "app",
        Source::Quick => "quick",
    }
}

/// Erwartet die Spalten aus `COLUMNS` ab Index 0.
pub fn from_row(row: &Row) -> rusqlite::Result<Note> {
    from_row_at(row, 0)
}

/// Erwartet die Spalten aus `COLUMNS` ab Index `at`.
pub fn from_row_at(row: &Row, at: usize) -> rusqlite::Result<Note> {
    let source: String = row.get(at + 5)?;
    Ok(Note {
        id: row.get(at)?,
        text: row.get(at + 1)?,
        created_at: row.get(at + 2)?,
        updated_at: row.get(at + 3)?,
        pinned: row.get(at + 4)?,
        source: match source.as_str() {
            "app" => Source::App,
            "quick" => Source::Quick,
            other => {
                return Err(rusqlite::Error::FromSqlConversionFailure(
                    at + 5,
                    Type::Text,
                    format!("unbekannte Quelle: {other}").into(),
                ));
            }
        },
        deleted_at: row.get(at + 6)?,
    })
}

/// SQL-Bedingung eines Filters. `?1` ist die untere Zeitgrenze.
fn condition(filter: Filter) -> &'static str {
    match filter {
        Filter::Trash => "deleted_at IS NOT NULL",
        Filter::All => "deleted_at IS NULL",
        Filter::Today | Filter::Last7 => "deleted_at IS NULL AND created_at >= ?1",
        Filter::Quick => "deleted_at IS NULL AND source = 'quick'",
        Filter::Pinned => "deleted_at IS NULL AND pinned = 1",
    }
}

fn list_at<Tz: TimeZone>(
    conn: &Connection,
    filter: Filter,
    now: &DateTime<Tz>,
) -> Result<Vec<Note>, String> {
    let Bounds { from, .. } = filter_bounds(filter, now);
    let sql = format!(
        // `?1 IS ?1` ist immer wahr und bindet den Parameter auch ohne Zeitfilter.
        "SELECT {COLUMNS} FROM notes WHERE ?1 IS ?1 AND {} ORDER BY created_at DESC, seq DESC",
        condition(filter)
    );
    conn.prepare_cached(&sql)
        .and_then(|mut stmt| stmt.query_map([from], from_row)?.collect())
        .map_err(db_error)
}

pub fn list(conn: &Connection, filter: Filter) -> Result<Vec<Note>, String> {
    list_at(conn, filter, &Local::now())
}

fn counts_at<Tz: TimeZone>(conn: &Connection, now: &DateTime<Tz>) -> Result<NoteCounts, String> {
    let today = filter_bounds(Filter::Today, now).from;
    let last7 = filter_bounds(Filter::Last7, now).from;
    conn.query_row(
        "SELECT
            count(*) FILTER (WHERE deleted_at IS NULL),
            count(*) FILTER (WHERE deleted_at IS NULL AND created_at >= ?1),
            count(*) FILTER (WHERE deleted_at IS NULL AND created_at >= ?2),
            count(*) FILTER (WHERE deleted_at IS NULL AND source = 'quick'),
            count(*) FILTER (WHERE deleted_at IS NULL AND pinned = 1),
            count(*) FILTER (WHERE deleted_at IS NOT NULL)
         FROM notes",
        [today, last7],
        |row| {
            Ok(NoteCounts {
                all: row.get(0)?,
                today: row.get(1)?,
                last7: row.get(2)?,
                quick: row.get(3)?,
                pinned: row.get(4)?,
                trash: row.get(5)?,
            })
        },
    )
    .map_err(db_error)
}

pub fn counts(conn: &Connection) -> Result<NoteCounts, String> {
    counts_at(conn, &Local::now())
}

pub fn get(conn: &Connection, id: &str) -> Result<Note, String> {
    conn.prepare_cached(&format!("SELECT {COLUMNS} FROM notes WHERE id = ?1"))
        .and_then(|mut stmt| stmt.query_row([id], from_row))
        .map_err(db_error)
}

pub fn create(conn: &Connection, text: &str, source: Source) -> Result<Note, String> {
    let now = now_iso();
    conn.query_row(
        &format!(
            "INSERT INTO notes (id, text, created_at, updated_at, source)
             VALUES (?1, ?2, ?3, ?3, ?4) RETURNING {COLUMNS}"
        ),
        params![Uuid::new_v4().to_string(), text, now, source_to_sql(source)],
        from_row,
    )
    .map_err(db_error)
}

pub fn update(conn: &Connection, id: &str, text: &str) -> Result<Note, String> {
    conn.query_row(
        &format!("UPDATE notes SET text = ?2, updated_at = ?3 WHERE id = ?1 RETURNING {COLUMNS}"),
        params![id, text, now_iso()],
        from_row,
    )
    .map_err(db_error)
}

/// Anheften ist keine Textänderung, `updated_at` bleibt.
pub fn set_pinned(conn: &Connection, id: &str, pinned: bool) -> Result<Note, String> {
    conn.query_row(
        &format!("UPDATE notes SET pinned = ?2 WHERE id = ?1 RETURNING {COLUMNS}"),
        params![id, pinned],
        from_row,
    )
    .map_err(db_error)
}

fn require_one(changed: rusqlite::Result<usize>) -> Result<(), String> {
    match changed.map_err(db_error)? {
        0 => Err(NOT_FOUND.into()),
        _ => Ok(()),
    }
}

/// Verschiebt in den Papierkorb. Nochmaliges Löschen ändert das Datum nicht.
pub fn delete(conn: &Connection, id: &str) -> Result<(), String> {
    require_one(conn.execute(
        "UPDATE notes SET deleted_at = coalesce(deleted_at, ?2) WHERE id = ?1",
        params![id, now_iso()],
    ))
}

pub fn restore(conn: &Connection, id: &str) -> Result<(), String> {
    require_one(conn.execute("UPDATE notes SET deleted_at = NULL WHERE id = ?1", [id]))
}

pub fn delete_forever(conn: &Connection, id: &str) -> Result<(), String> {
    require_one(conn.execute("DELETE FROM notes WHERE id = ?1", [id]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    fn insert(conn: &Connection, id: &str, created_at: &str) {
        conn.execute(
            "INSERT INTO notes (id, text, created_at, updated_at, source)
             VALUES (?1, ?1, ?2, ?2, 'app')",
            [id, created_at],
        )
        .unwrap();
    }

    fn ids(notes: Vec<Note>) -> Vec<String> {
        notes.into_iter().map(|note| note.id).collect()
    }

    #[test]
    fn create_get_update() {
        let db = Db::in_memory();
        let conn = db.lock();
        let note = create(&conn, "Heizung 🔥", Source::Quick).unwrap();
        assert_eq!(note.created_at, note.updated_at);
        assert_eq!(note.source, Source::Quick);
        assert_eq!(get(&conn, &note.id).unwrap(), note);

        std::thread::sleep(std::time::Duration::from_millis(3));
        let updated = update(&conn, &note.id, "Neu").unwrap();
        assert_eq!(updated.text, "Neu");
        assert_eq!(updated.created_at, note.created_at);
        assert!(updated.updated_at > note.updated_at);

        let pinned = set_pinned(&conn, &note.id, true).unwrap();
        assert!(pinned.pinned);
        assert_eq!(pinned.updated_at, updated.updated_at);
    }

    #[test]
    fn list_is_sorted_by_creation_and_filtered_by_local_day() {
        let db = Db::in_memory();
        let conn = db.lock();
        insert(&conn, "gestern", "2026-11-24T22:59:59.999Z");
        insert(&conn, "heute", "2026-11-24T23:00:00.000Z");
        insert(&conn, "vor6", "2026-11-18T23:00:00.000Z");
        insert(&conn, "vor7", "2026-11-18T22:59:59.999Z");
        let now = DateTime::parse_from_rfc3339("2026-11-25T09:00:00+01:00").unwrap();

        let list = |filter| ids(list_at(&conn, filter, &now).unwrap());
        assert_eq!(list(Filter::All), ["heute", "gestern", "vor6", "vor7"]);
        assert_eq!(list(Filter::Today), ["heute"]);
        assert_eq!(list(Filter::Last7), ["heute", "gestern", "vor6"]);

        let counts = counts_at(&conn, &now).unwrap();
        assert_eq!((counts.all, counts.today, counts.last7), (4, 1, 3));
    }

    #[test]
    fn counts_match_lists_for_every_filter() {
        let db = Db::in_memory();
        let conn = db.lock();
        let a = create(&conn, "a", Source::App).unwrap();
        create(&conn, "b", Source::Quick).unwrap();
        let c = create(&conn, "c", Source::Quick).unwrap();
        set_pinned(&conn, &a.id, true).unwrap();
        delete(&conn, &c.id).unwrap();

        let counts = counts(&conn).unwrap();
        let len = |filter| list(&conn, filter).unwrap().len() as u32;
        assert_eq!(counts.all, len(Filter::All));
        assert_eq!(counts.today, len(Filter::Today));
        assert_eq!(counts.last7, len(Filter::Last7));
        assert_eq!(counts.quick, len(Filter::Quick));
        assert_eq!(counts.pinned, len(Filter::Pinned));
        assert_eq!(counts.trash, len(Filter::Trash));
        assert_eq!((counts.all, counts.quick, counts.trash), (2, 1, 1));
    }

    #[test]
    fn trash_roundtrip() {
        let db = Db::in_memory();
        let conn = db.lock();
        let note = create(&conn, "x", Source::App).unwrap();
        delete(&conn, &note.id).unwrap();
        let deleted_at = get(&conn, &note.id).unwrap().deleted_at;
        assert!(deleted_at.is_some());
        delete(&conn, &note.id).unwrap();
        assert_eq!(get(&conn, &note.id).unwrap().deleted_at, deleted_at);

        restore(&conn, &note.id).unwrap();
        assert_eq!(get(&conn, &note.id).unwrap(), note);

        delete_forever(&conn, &note.id).unwrap();
        for result in [
            get(&conn, &note.id).map(drop),
            update(&conn, &note.id, "x").map(drop),
            set_pinned(&conn, &note.id, true).map(drop),
            delete(&conn, &note.id),
            restore(&conn, &note.id),
            delete_forever(&conn, &note.id),
        ] {
            assert_eq!(result, Err(NOT_FOUND.into()));
        }
    }
}
