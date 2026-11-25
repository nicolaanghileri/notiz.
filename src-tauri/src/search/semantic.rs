//! Semantische Suche: Notizen in Abschnitte zerlegen, Vektoren speichern,
//! Ähnlichkeit berechnen. Das Modell selbst steckt hinter [`Embedder`].

use rusqlite::{Connection, OptionalExtension, params};

use crate::db::Db;
use crate::notes::db_error;
use crate::timerange::Bounds;

/// Berechnet normierte Vektoren. Austauschbar für Tests.
pub trait Embedder: Send {
    /// Kennung des Modells. Ändert sie sich, werden alle Vektoren neu berechnet.
    fn model_id(&self) -> &str;
    fn embed_passages(&mut self, texts: &[String]) -> Result<Vec<Vec<f32>>, String>;
    fn embed_query(&mut self, text: &str) -> Result<Vec<f32>, String>;
}

/// Ein Abschnitt einer Notiz mit UTF-16-Bereich.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Chunk {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

/// Höchstens so viele Sätze pro Notiz (plus die ganze Notiz).
const MAX_SENTENCES: usize = 64;

/// Abkürzungen, nach deren Punkt kein neuer Satz beginnt.
const ABBREVIATIONS: &[&str] = &[
    "hr", "fr", "dr", "nr", "ca", "bzw", "evtl", "wg", "usw", "etc", "inkl", "ggf", "max", "min",
    "st", "str", "tel", "zb", "z", "b", "vs", "mio", "mrd", "prof", "jan", "feb", "mrz", "apr",
    "jun", "jul", "aug", "sep", "sept", "okt", "nov", "dez", "mo", "di", "mi", "do", "sa", "so",
];

/// Sätze bzw. Zeilen einer Notiz. Nur Teile mit Buchstaben oder Ziffern.
pub fn sentences(text: &str) -> Vec<Chunk> {
    let chars: Vec<char> = text.chars().collect();
    let mut chunks = Vec::new();
    let mut start = 0; // Index in `chars`
    let mut push = |from: usize, to: usize| {
        let slice = &chars[from..to];
        let Some(first) = slice.iter().position(|c| !c.is_whitespace()) else {
            return;
        };
        let last = slice.iter().rposition(|c| !c.is_whitespace()).unwrap();
        let part = &slice[first..=last];
        if !part.iter().any(|c| c.is_alphanumeric()) {
            return;
        }
        let offset = |index: usize| chars[..index].iter().map(|c| c.len_utf16()).sum::<usize>();
        chunks.push(Chunk {
            start: offset(from + first),
            end: offset(from + last + 1),
            text: part.iter().collect(),
        });
    };
    for index in 0..chars.len() {
        let c = chars[index];
        let next_is_space = chars.get(index + 1).is_none_or(|n| n.is_whitespace());
        let boundary = c == '\n'
            || (matches!(c, '.' | '!' | '?' | '…')
                && next_is_space
                && !is_abbreviation(&chars[..index]));
        if boundary {
            push(start, index + 1);
            start = index + 1;
        }
    }
    push(start, chars.len());
    chunks
}

fn is_abbreviation(before: &[char]) -> bool {
    let word: String = before
        .iter()
        .rev()
        .take_while(|c| c.is_alphanumeric())
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<String>()
        .to_lowercase();
    word.chars().all(|c| c.is_ascii_digit()) && !word.is_empty()
        || ABBREVIATIONS.contains(&word.as_str())
}

/// Abschnitte, für die Vektoren berechnet werden: die ganze Notiz und,
/// wenn es mehrere sind, jeder Satz einzeln.
pub fn chunks(text: &str) -> Vec<Chunk> {
    let mut parts = sentences(text);
    let (Some(first), Some(last)) = (parts.first(), parts.last()) else {
        return Vec::new();
    };
    let whole = Chunk {
        start: first.start,
        end: last.end,
        text: text.trim().to_string(),
    };
    if parts.len() == 1 {
        return vec![whole];
    }
    parts.truncate(MAX_SENTENCES);
    let mut all = vec![whole];
    all.extend(parts);
    all
}

pub fn encode(vector: &[f32]) -> Vec<u8> {
    vector
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect()
}

pub fn decode(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect()
}

pub fn normalize(mut vector: Vec<f32>) -> Vec<f32> {
    let norm = vector.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm > 0.0 {
        vector.iter_mut().for_each(|v| *v /= norm);
    }
    vector
}

fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

/// Vektoren eines anderen Modells löschen (Modellwechsel).
pub fn drop_other_models(conn: &Connection, model: &str) -> Result<usize, String> {
    conn.execute("DELETE FROM note_vectors WHERE model != ?1", [model])
        .map_err(db_error)
}

/// Notizen ohne Vektoren, gelöschte zuletzt, zuletzt geänderte zuerst.
pub fn pending(conn: &Connection, limit: usize) -> Result<Vec<(i64, String)>, String> {
    conn.prepare_cached(
        "SELECT seq, text FROM notes n
         WHERE trim(text) != ''
           AND NOT EXISTS (SELECT 1 FROM note_vectors v WHERE v.note_seq = n.seq)
         ORDER BY deleted_at IS NOT NULL, updated_at DESC LIMIT ?1",
    )
    .and_then(|mut stmt| {
        stmt.query_map([limit as i64], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect()
    })
    .map_err(db_error)
}

/// Speichert Vektoren, aber nur, wenn der Text inzwischen nicht geändert wurde.
pub fn store(
    conn: &mut Connection,
    seq: i64,
    text: &str,
    model: &str,
    chunks: &[Chunk],
    vectors: &[Vec<f32>],
) -> Result<bool, String> {
    let tx = conn.transaction().map_err(db_error)?;
    let current: Option<String> = tx
        .query_row("SELECT text FROM notes WHERE seq = ?1", [seq], |row| {
            row.get(0)
        })
        .optional()
        .map_err(db_error)?;
    if current.as_deref() != Some(text) {
        return Ok(false);
    }
    tx.execute("DELETE FROM note_vectors WHERE note_seq = ?1", [seq])
        .map_err(db_error)?;
    {
        let mut insert = tx
            .prepare_cached(
                "INSERT INTO note_vectors (note_seq, chunk, start, end, model, vector)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            )
            .map_err(db_error)?;
        for (index, (chunk, vector)) in chunks.iter().zip(vectors).enumerate() {
            insert
                .execute(params![
                    seq,
                    index as i64,
                    chunk.start as i64,
                    chunk.end as i64,
                    model,
                    encode(vector)
                ])
                .map_err(db_error)?;
        }
    }
    tx.commit().map_err(db_error)?;
    Ok(true)
}

/// Berechnet Vektoren für bis zu `limit` Notizen. Rückgabe: Anzahl verarbeitet.
/// Hält die Datenbank nicht, während das Modell rechnet.
pub fn process_pending(
    db: &Db,
    embedder: &mut dyn Embedder,
    limit: usize,
) -> Result<usize, String> {
    let todo = pending(&db.lock(), limit)?;
    for (seq, text) in &todo {
        let parts = chunks(text);
        let texts: Vec<String> = parts.iter().map(|chunk| chunk.text.clone()).collect();
        let vectors = embedder.embed_passages(&texts)?;
        store(
            &mut db.lock(),
            *seq,
            text,
            embedder.model_id(),
            &parts,
            &vectors,
        )?;
    }
    Ok(todo.len())
}

/// Bester Abschnitt einer Notiz für die Anfrage.
#[derive(Debug, Clone, PartialEq)]
pub struct SemanticHit {
    pub seq: i64,
    /// Cosine-Ähnlichkeit des besten Abschnitts
    pub similarity: f32,
    /// UTF-16-Bereich des besten Satzes, `None` wenn das die ganze Notiz ist
    pub best_sentence: Option<(usize, usize)>,
}

/// Ähnlichkeit aller nicht gelöschten Notizen im Zeitraum, beste zuerst.
pub fn rank(conn: &Connection, query: &[f32], bounds: &Bounds) -> Result<Vec<SemanticHit>, String> {
    let mut stmt = conn
        .prepare_cached(
            "SELECT v.note_seq, v.chunk, v.start, v.end, v.vector
             FROM note_vectors v JOIN notes n ON n.seq = v.note_seq
             WHERE n.deleted_at IS NULL
               AND (?1 IS NULL OR n.created_at >= ?1) AND (?2 IS NULL OR n.created_at < ?2)
             ORDER BY v.note_seq, v.chunk",
        )
        .map_err(db_error)?;
    let mut rows = stmt
        .query(params![bounds.from, bounds.to])
        .map_err(db_error)?;
    let mut hits: Vec<SemanticHit> = Vec::new();
    while let Some(row) = rows.next().map_err(db_error)? {
        let seq: i64 = row.get(0).map_err(db_error)?;
        let chunk: i64 = row.get(1).map_err(db_error)?;
        let range = (
            row.get::<_, i64>(2).map_err(db_error)? as usize,
            row.get::<_, i64>(3).map_err(db_error)? as usize,
        );
        let bytes: Vec<u8> = row.get(4).map_err(db_error)?;
        let similarity = dot(query, &decode(&bytes));
        let sentence = (chunk > 0).then_some(range);
        match hits.last_mut() {
            Some(hit) if hit.seq == seq => {
                if similarity > hit.similarity {
                    hit.similarity = similarity;
                    hit.best_sentence = sentence;
                }
            }
            _ => hits.push(SemanticHit {
                seq,
                similarity,
                best_sentence: sentence,
            }),
        }
    }
    hits.sort_by(|a, b| b.similarity.total_cmp(&a.similarity));
    Ok(hits)
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// Test-Embedder: ein Wort aus `VOCAB` = eine Dimension.
    pub struct FakeEmbedder;

    const VOCAB: &[&str] = &["heiz", "bad", "risotto", "velo", "zahnarzt"];

    fn vector(text: &str) -> Vec<f32> {
        let lower = text.to_lowercase();
        let mut v: Vec<f32> = VOCAB
            .iter()
            .map(|word| lower.matches(word).count() as f32)
            .collect();
        v.push(0.1);
        normalize(v)
    }

    impl Embedder for FakeEmbedder {
        fn model_id(&self) -> &str {
            "fake"
        }
        fn embed_passages(&mut self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
            Ok(texts.iter().map(|text| vector(text)).collect())
        }
        fn embed_query(&mut self, text: &str) -> Result<Vec<f32>, String> {
            Ok(vector(text))
        }
    }

    fn texts(text: &str) -> Vec<String> {
        sentences(text)
            .into_iter()
            .map(|chunk| chunk.text)
            .collect()
    }

    #[test]
    fn splits_sentences_and_lines() {
        assert_eq!(
            texts(
                "Heizung Bad klackert wieder. Hr. Brunner anrufen – am 3. Okt.\n\n- Budget max. 400!!\n…"
            ),
            [
                "Heizung Bad klackert wieder.",
                "Hr. Brunner anrufen – am 3. Okt.",
                "- Budget max. 400!!"
            ]
        );
        assert!(sentences("  \n ").is_empty());
        let text = "🔥 Eins. Zwei";
        let parts = sentences(text);
        let units: Vec<u16> = text.encode_utf16().collect();
        assert_eq!(
            String::from_utf16(&units[parts[1].start..parts[1].end]).unwrap(),
            "Zwei"
        );
    }

    #[test]
    fn chunks_contain_whole_note_first() {
        assert_eq!(chunks("Nur ein Satz").len(), 1);
        let all = chunks(" Eins. Zwei. ");
        assert_eq!(all.len(), 3);
        assert_eq!(all[0].text, "Eins. Zwei.");
        assert_eq!((all[0].start, all[0].end), (1, 12));
    }

    #[test]
    fn roundtrip_bytes() {
        let v = vec![0.5, -1.25, 3.0];
        assert_eq!(decode(&encode(&v)), v);
    }
}
