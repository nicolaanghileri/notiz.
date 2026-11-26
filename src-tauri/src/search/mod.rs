//! Suche: Volltext (FTS5) und Bedeutung (Embeddings), zusammengeführt.

pub mod semantic;
pub mod text;

use std::collections::{HashMap, HashSet};

use chrono::Local;
use rusqlite::{Connection, params};

use crate::models::{Note, Range, SearchHit, Tier};
use crate::notes::{self, db_error};
use crate::timerange::{Bounds, range_bounds};
use semantic::SemanticHit;
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
    // Pro Notiz: gefundene Begriffe und Bereiche
    type Matched = (Vec<bool>, Vec<(usize, usize)>);
    let matched: Vec<Matched> = candidates
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

/// Schwellen für die Cosine-Ähnlichkeit, abhängig vom Modell.
/// NOCH NICHT KALIBRIERT: Schätzwerte für multilingual-e5-small (typisch
/// 0.75–0.80 ohne Bezug, 0.85+ bei klarem Bezug). Prüfen mit
/// `embedder::tests::calibrate`. Darunter zählt Bedeutung nicht.
pub const SEM_FLOOR: f32 = 0.80;
/// Ab hier gilt Bedeutung als voll getroffen.
const SEM_CEIL: f32 = 0.90;
/// Ab hier ist eine Notiz auch ohne gemeinsame Wörter „passend“ (Frage).
const SEM_MATCH: f32 = 0.86;
/// Bei reinen Stichwörtern braucht es mehr, damit Wort-Treffer vorne bleiben.
const SEM_MATCH_KEYWORDS: f32 = 0.88;
/// Ab hier erscheint eine Notiz unter „Weniger passend“.
const SEM_WEAK: f32 = 0.83;
/// Höchstens so viele Treffer nur aus Bedeutung bzw. unter „Weniger passend“.
const MAX_SEMANTIC_MATCHES: usize = 8;
const MAX_WEAK: usize = 8;
const MAX_MATCHES: usize = 100;

fn semantic_strength(similarity: f32) -> f64 {
    (((similarity - SEM_FLOOR) / (SEM_CEIL - SEM_FLOOR)).clamp(0.0, 1.0)) as f64
}

/// Ergebnis der Suche: `match` vor `weak`, je nach Score sortiert.
/// `query_vector` fehlt, solange das Modell nicht bereit ist → nur Volltext.
pub fn search(
    conn: &Connection,
    query: &str,
    range: Range,
    query_vector: Option<&[f32]>,
) -> Result<Vec<SearchHit>, String> {
    let bounds = range_bounds(range, &Local::now());
    let terms = query_terms(query);
    let words = word_hits(conn, &terms, &bounds)?;
    let semantic = match query_vector {
        Some(vector) if !query.trim().is_empty() => semantic::rank(conn, vector, &bounds)?,
        _ => Vec::new(),
    };
    let sem_match = if text::is_question(query) {
        SEM_MATCH
    } else {
        SEM_MATCH_KEYWORDS
    };

    let similarity_of: HashMap<i64, &SemanticHit> =
        semantic.iter().map(|hit| (hit.seq, hit)).collect();
    let mut matches = Vec::new();
    let mut weak = Vec::new();
    let mut seen = HashSet::new();

    for hit in words {
        seen.insert(hit.seq);
        let sem = similarity_of.get(&hit.seq);
        let similarity = sem.map_or(0.0, |s| s.similarity);
        let score = combine(hit.coverage, semantic_strength(similarity));
        let tier = if hit.coverage >= MATCH_COVERAGE || similarity >= sem_match {
            Tier::Match
        } else {
            Tier::Weak
        };
        let found = SearchHit {
            note: hit.note,
            highlights: hit.highlights,
            score,
            tier,
        };
        match tier {
            Tier::Match => matches.push(found),
            Tier::Weak => weak.push(found),
        }
    }

    // Nur über die Bedeutung gefunden
    let mut semantic_matches = 0;
    let only_semantic: Vec<&SemanticHit> = semantic
        .iter()
        .filter(|hit| !seen.contains(&hit.seq) && hit.similarity >= SEM_WEAK)
        .take(MAX_SEMANTIC_MATCHES + MAX_WEAK)
        .collect();
    for hit in only_semantic {
        let tier = if hit.similarity >= sem_match && semantic_matches < MAX_SEMANTIC_MATCHES {
            semantic_matches += 1;
            Tier::Match
        } else {
            Tier::Weak
        };
        let note = notes::get_by_seq(conn, hit.seq)?;
        let highlights = match tier {
            Tier::Match => hit.best_sentence.into_iter().collect(),
            Tier::Weak => Vec::new(),
        };
        let found = SearchHit {
            note,
            highlights,
            score: combine(0.0, semantic_strength(hit.similarity)),
            tier,
        };
        match tier {
            Tier::Match => matches.push(found),
            Tier::Weak => weak.push(found),
        }
    }

    let by_score = |a: &SearchHit, b: &SearchHit| {
        b.score
            .total_cmp(&a.score)
            .then_with(|| b.note.created_at.cmp(&a.note.created_at))
    };
    matches.sort_by(by_score);
    weak.sort_by(by_score);
    matches.truncate(MAX_MATCHES);
    weak.truncate(MAX_WEAK);
    matches.extend(weak);
    Ok(matches)
}

/// Gesamtscore 0..1: Wörter und Bedeutung ergänzen sich, keins allein ergibt 1.
/// Bedeutung allein (max. 0.8) bleibt unter einem vollen Wort-Treffer (0.9).
fn combine(coverage: f64, semantic: f64) -> f64 {
    let score = 1.0 - (1.0 - 0.9 * coverage) * (1.0 - 0.8 * semantic);
    (score * 1000.0).round() / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;
    use crate::models::Source;
    use semantic::Embedder;

    fn slice(text: &str, (start, end): (usize, usize)) -> String {
        String::from_utf16(&text.encode_utf16().collect::<Vec<_>>()[start..end]).unwrap()
    }

    fn sample(conn: &Connection) {
        for text in [
            "Heizung Bad klackert wieder. Hr. Brunner anrufen – nur vormittags",
            "Risotto: erst Zwiebeln glasig, dann Reis 🍚 anrösten",
            "Velo-Service bei Müller, Bremsen prüfen",
            "Nebenkosten für Velo und Keller. Heizkosten fast 30% höher",
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
        let hits = search(&conn, "Heizung im Bad", Range::All, None).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].tier, Tier::Match);
        assert_eq!(
            slice(&hits[0].note.text, hits[0].highlights[0]),
            "Heizung Bad"
        );

        // Umlaute, Präfix, Emoji vor dem Treffer
        let hits = search(&conn, "anrosten", Range::All, None).unwrap();
        assert_eq!(slice(&hits[0].note.text, hits[0].highlights[0]), "anrösten");
        let hits = search(&conn, "Mül", Range::All, None).unwrap();
        assert_eq!(slice(&hits[0].note.text, hits[0].highlights[0]), "Müller");
    }

    #[test]
    fn partial_matches_are_weak_and_come_last() {
        let db = Db::in_memory();
        let conn = db.lock();
        sample(&conn);
        let hits = search(&conn, "Brunner Zahnarzt", Range::All, None).unwrap();
        assert_eq!(hits.len(), 2);
        // Beide Begriffe gleich selten → je die Hälfte
        assert!(hits.iter().all(|hit| hit.tier == Tier::Match));

        let hits = search(&conn, "Bremsen Heizung Bad", Range::All, None).unwrap();
        assert!(hits[0].score > hits[1].score);
        let tiers: Vec<_> = hits.iter().map(|hit| hit.tier).collect();
        assert_eq!(tiers, [Tier::Match, Tier::Weak]);
    }

    #[test]
    fn ignores_trash_updates_index_and_respects_range() {
        let db = Db::in_memory();
        let conn = db.lock();
        let note = notes::create(&conn, "Risotto", Source::App).unwrap();
        assert_eq!(
            search(&conn, "risotto", Range::ThisYear, None)
                .unwrap()
                .len(),
            1
        );

        notes::update(&conn, &note.id, "Pasta").unwrap();
        assert!(
            search(&conn, "risotto", Range::All, None)
                .unwrap()
                .is_empty()
        );
        assert_eq!(search(&conn, "pasta", Range::All, None).unwrap().len(), 1);

        notes::delete(&conn, &note.id).unwrap();
        assert!(search(&conn, "pasta", Range::All, None).unwrap().is_empty());
        notes::restore(&conn, &note.id).unwrap();
        conn.execute(
            "UPDATE notes SET created_at = '2020-01-01T00:00:00.000Z'",
            [],
        )
        .unwrap();
        assert!(
            search(&conn, "pasta", Range::LastMonth, None)
                .unwrap()
                .is_empty()
        );
        assert_eq!(search(&conn, "pasta", Range::All, None).unwrap().len(), 1);

        notes::delete_forever(&conn, &note.id).unwrap();
        assert!(search(&conn, "pasta", Range::All, None).unwrap().is_empty());
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
            search(&conn, query, Range::All, None).unwrap();
        }
    }

    #[test]
    fn hybrid_finds_meaning_and_highlights_best_sentence() {
        let db = Db::in_memory();
        sample(&db.lock());
        let mut embedder = semantic::tests::FakeEmbedder;
        while semantic::process_pending(&db, &mut embedder, 2).unwrap() > 0 {}
        let conn = db.lock();
        // „Heizkosten“ teilt kein Wort mit „Heizung“, aber die Bedeutung (Fake: „heiz“)
        let vector = embedder.embed_query("Heizung").unwrap();
        let hits = search(&conn, "wann war die Heizung", Range::All, Some(&vector)).unwrap();
        let texts: Vec<_> = hits
            .iter()
            .map(|h| (h.note.text.as_str(), h.tier))
            .collect();
        assert_eq!(texts.len(), 2, "{texts:?}");
        assert_eq!(hits[0].tier, Tier::Match);
        assert!(hits[0].note.text.starts_with("Heizung Bad"));
        let costs = &hits[1];
        assert!(costs.note.text.starts_with("Nebenkosten"));
        assert_eq!(costs.tier, Tier::Match);
        assert_eq!(
            slice(&costs.note.text, costs.highlights[0]),
            "Heizkosten fast 30% höher"
        );

        // Ohne Vektor: nur Volltext
        assert_eq!(
            search(&conn, "wann war die Heizung", Range::All, None)
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn vectors_follow_text_changes() {
        let db = Db::in_memory();
        let mut embedder = semantic::tests::FakeEmbedder;
        let note = notes::create(&db.lock(), "Risotto kochen", Source::App).unwrap();
        notes::create(&db.lock(), "   ", Source::App).unwrap();
        assert_eq!(
            semantic::process_pending(&db, &mut embedder, 10).unwrap(),
            1
        );
        assert_eq!(
            semantic::process_pending(&db, &mut embedder, 10).unwrap(),
            0
        );
        notes::update(&db.lock(), &note.id, "Velo flicken. Risotto.").unwrap();
        assert_eq!(semantic::pending(&db.lock(), 10).unwrap().len(), 1);
        assert_eq!(
            semantic::process_pending(&db, &mut embedder, 10).unwrap(),
            1
        );
        let count = |sql: &str| -> i64 { db.lock().query_row(sql, [], |r| r.get(0)).unwrap() };
        assert_eq!(count("SELECT count(*) FROM note_vectors"), 3);

        // Text während der Berechnung geändert → nicht speichern
        let seq: i64 = count("SELECT seq FROM notes WHERE trim(text) != ''");
        let parts = semantic::chunks("alt");
        let vectors = embedder.embed_passages(&["alt".into()]).unwrap();
        assert!(!semantic::store(&mut db.lock(), seq, "alt", "fake", &parts, &vectors).unwrap());

        assert_eq!(semantic::drop_other_models(&db.lock(), "neu").unwrap(), 3);
        notes::delete_forever(&db.lock(), &note.id).unwrap();
        assert_eq!(count("SELECT count(*) FROM note_vectors"), 0);
    }
}
