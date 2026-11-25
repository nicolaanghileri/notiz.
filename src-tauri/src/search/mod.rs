//! Suche: Volltext (FTS5) und Bedeutung (Embeddings), zusammengeführt.

pub mod text;

use chrono::Local;
use rusqlite::{Connection, params};

use crate::models::{Note, Range, SearchHit, Tier};
use crate::notes::{self, db_error};
use crate::timerange::{Bounds, range_bounds};
use text::{Term, merge_ranges, query_terms, tokens};

/// Höchstens so viele Volltext-Kandidaten (nach bm25) werden genauer bewertet.
const MAX_CANDIDATES: usize = 500;
/// Ab diesem Anteil gefundener Begriffe gilt ein Treffer als „passend“.
const MATCH_COVERAGE: f64 = 0.5;

/// Eine Notiz mit ihren Volltext-Werten.
#[derive(Debug, Clone)]
pub struct WordHit {
    pub seq: i64,
    pub note: Note,
    /// Gewichteter Anteil der Suchbegriffe, die vorkommen (0..=1)
    pub coverage: f64,
    pub highlights: Vec<(usize, usize)>,
}

/// Volltextsuche über nicht gelöschte Notizen im Zeitraum.
pub fn word_hits(
    conn: &Connection,
    terms: &[Term],
    bounds: &Bounds,
) -> Result<Vec<WordHit>, String> {
    if terms.is_empty() {
        return Ok(Vec::new());
    }
    let fts_query = terms.iter().map(Term::fts).collect::<Vec<_>>().join(" OR ");
    let sql = format!(
        "SELECT n.seq, {} FROM notes_fts f JOIN notes n ON n.seq = f.rowid
         WHERE notes_fts MATCH ?1 AND n.deleted_at IS NULL
           AND (?2 IS NULL OR n.created_at >= ?2) AND (?3 IS NULL OR n.created_at < ?3)
         ORDER BY bm25(notes_fts) LIMIT ?4",
        prefixed_columns("n")
    );
    let candidates: Vec<(i64, Note)> = conn
        .prepare_cached(&sql)
        .and_then(|mut stmt| {
            stmt.query_map(
                params![fts_query, bounds.from, bounds.to, MAX_CANDIDATES as i64],
                |row| Ok((row.get(0)?, notes::from_row_at(row, 1)?)),
            )?
            .collect()
        })
        .map_err(db_error)?;

    // Pro Notiz: welche Begriffe kommen vor, wo?
    let matched: Vec<(Vec<bool>, Vec<(usize, usize)>)> = candidates
        .iter()
        .map(|(_, note)| {
            let mut found = vec![false; terms.len()];
            let mut ranges = Vec::new();
            for token in tokens(&note.text) {
                let mut hit = false;
                for (index, term) in terms.iter().enumerate() {
                    if term.matches(&token.folded) {
                        found[index] = true;
                        hit = true;
                    }
                }
                if hit {
                    ranges.push((token.start, token.end));
                }
            }
            (found, merge_ranges(&note.text, ranges))
        })
        .collect();

    // Seltene Begriffe zählen mehr (IDF über alle Notizen im Zeitraum).
    let total: f64 = conn
        .query_row(
            "SELECT count(*) FROM notes WHERE deleted_at IS NULL
               AND (?1 IS NULL OR created_at >= ?1) AND (?2 IS NULL OR created_at < ?2)",
            params![bounds.from, bounds.to],
            |row| row.get::<_, i64>(0),
        )
        .map_err(db_error)? as f64;
    let weights: Vec<f64> = (0..terms.len())
        .map(|index| {
            let df = matched.iter().filter(|(found, _)| found[index]).count() as f64;
            (1.0 + total / df.max(1.0)).ln()
        })
        .collect();
    let weight_sum: f64 = weights.iter().sum();

    let mut hits: Vec<WordHit> = candidates
        .into_iter()
        .zip(matched)
        .filter(|(_, (found, _))| found.contains(&true))
        .map(|((seq, note), (found, highlights))| {
            let covered: f64 = weights
                .iter()
                .zip(&found)
                .filter(|(_, found)| **found)
                .map(|(weight, _)| weight)
                .sum();
            WordHit {
                seq,
                note,
                coverage: covered / weight_sum,
                highlights,
            }
        })
        .collect();
    hits.sort_by(|a, b| {
        b.coverage
            .total_cmp(&a.coverage)
            .then_with(|| b.note.created_at.cmp(&a.note.created_at))
    });
    Ok(hits)
}

fn prefixed_columns(table: &str) -> String {
    notes::COLUMNS
        .split(", ")
        .map(|column| format!("{table}.{column}"))
        .collect::<Vec<_>>()
        .join(", ")
}

/// Ergebnis der Suche, `match` vor `weak`, je nach Score sortiert.
pub fn search(conn: &Connection, query: &str, range: Range) -> Result<Vec<SearchHit>, String> {
    let bounds = range_bounds(range, &Local::now());
    let terms = query_terms(query);
    let hits = word_hits(conn, &terms, &bounds)?;
    let mut result: Vec<SearchHit> = hits
        .into_iter()
        .map(|hit| SearchHit {
            tier: if hit.coverage >= MATCH_COVERAGE {
                Tier::Match
            } else {
                Tier::Weak
            },
            score: hit.coverage,
            note: hit.note,
            highlights: hit.highlights,
        })
        .collect();
    result.sort_by_key(|hit| hit.tier == Tier::Weak);
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;
    use crate::models::Source;

    fn slice(text: &str, (start, end): (usize, usize)) -> String {
        String::from_utf16(&text.encode_utf16().collect::<Vec<_>>()[start..end]).unwrap()
    }

    fn sample(conn: &Connection) {
        for text in [
            "Heizung Bad klackert wieder. Hr. Brunner anrufen – nur vormittags",
            "Risotto: erst Zwiebeln glasig, dann Reis 🍚 anrösten",
            "Velo-Service bei Müller, Bremsen prüfen",
            "Nebenkosten-Abrechnung: Heizkosten fast 30% höher",
            "Dr. Keller, Zahnarzt verschoben auf Do 14:30",
        ] {
            notes::create(conn, text, Source::App).unwrap();
        }
    }

    #[test]
    fn finds_words_with_prefix_and_highlights_them() {
        let db = Db::in_memory();
        let conn = db.lock();
        sample(&conn);
        let hits = search(&conn, "Heizung im Bad", Range::All).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].tier, Tier::Match);
        assert_eq!(
            slice(&hits[0].note.text, hits[0].highlights[0]),
            "Heizung Bad"
        );

        // Umlaute, Präfix, Emoji vor dem Treffer
        let hits = search(&conn, "anrosten", Range::All).unwrap();
        assert_eq!(slice(&hits[0].note.text, hits[0].highlights[0]), "anrösten");
        let hits = search(&conn, "Mül", Range::All).unwrap();
        assert_eq!(slice(&hits[0].note.text, hits[0].highlights[0]), "Müller");
    }

    #[test]
    fn partial_matches_are_weak_and_come_last() {
        let db = Db::in_memory();
        let conn = db.lock();
        sample(&conn);
        let hits = search(&conn, "Brunner Zahnarzt", Range::All).unwrap();
        assert_eq!(hits.len(), 2);
        // Beide Begriffe gleich selten → je die Hälfte
        assert!(hits.iter().all(|hit| hit.tier == Tier::Match));

        let hits = search(&conn, "Bremsen Heizung Bad", Range::All).unwrap();
        let tiers: Vec<_> = hits.iter().map(|hit| hit.tier).collect();
        assert_eq!(tiers, [Tier::Match, Tier::Weak]);
    }

    #[test]
    fn ignores_trash_updates_index_and_respects_range() {
        let db = Db::in_memory();
        let conn = db.lock();
        let note = notes::create(&conn, "Risotto", Source::App).unwrap();
        assert_eq!(search(&conn, "risotto", Range::ThisYear).unwrap().len(), 1);

        notes::update(&conn, &note.id, "Pasta").unwrap();
        assert!(search(&conn, "risotto", Range::All).unwrap().is_empty());
        assert_eq!(search(&conn, "pasta", Range::All).unwrap().len(), 1);

        notes::delete(&conn, &note.id).unwrap();
        assert!(search(&conn, "pasta", Range::All).unwrap().is_empty());
        notes::restore(&conn, &note.id).unwrap();
        conn.execute(
            "UPDATE notes SET created_at = '2020-01-01T00:00:00.000Z'",
            [],
        )
        .unwrap();
        assert!(search(&conn, "pasta", Range::LastMonth).unwrap().is_empty());
        assert_eq!(search(&conn, "pasta", Range::All).unwrap().len(), 1);

        notes::delete_forever(&conn, &note.id).unwrap();
        assert!(search(&conn, "pasta", Range::All).unwrap().is_empty());
    }

    #[test]
    fn odd_queries_do_not_break_fts() {
        let db = Db::in_memory();
        let conn = db.lock();
        sample(&conn);
        for query in [
            "",
            "   ",
            "\"",
            "AND OR NOT",
            "*",
            "a\"b",
            "(Bad",
            "NEAR(x y)",
            "🍚",
        ] {
            search(&conn, query, Range::All).unwrap();
        }
    }
}
