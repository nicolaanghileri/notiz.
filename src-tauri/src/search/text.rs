//! Textaufbereitung für die Suche: Normalisieren, Wörter mit UTF-16-Positionen,
//! Suchbegriffe aus der Anfrage.
//!
//! Muss zum FTS5-Tokenizer passen (`unicode61 remove_diacritics 2`):
//! Wörter = Buchstaben/Ziffern, klein geschrieben, ohne Akzente/Umlaut-Punkte.

use unicode_normalization::{UnicodeNormalization, char::is_combining_mark};

/// Kleinbuchstaben, ohne diakritische Zeichen („Ärzte“ → „arzte“).
pub fn fold(word: &str) -> String {
    word.to_lowercase()
        .nfd()
        .filter(|c| !is_combining_mark(*c))
        .collect()
}

fn is_word_char(c: char) -> bool {
    c.is_alphanumeric() || is_combining_mark(c)
}

/// Ein Wort im Notiztext.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Token {
    pub folded: String,
    /// UTF-16-Bereich [start, end) im Originaltext
    pub start: usize,
    pub end: usize,
}

pub fn tokens(text: &str) -> Vec<Token> {
    let mut result = Vec::new();
    let mut current: Option<(usize, String)> = None;
    let mut pos = 0;
    for c in text.chars() {
        // Ein Akzent am Wortanfang gehört zu keinem Wort.
        let joins = current.is_some() && is_combining_mark(c);
        if c.is_alphanumeric() || joins {
            current
                .get_or_insert_with(|| (pos, String::new()))
                .1
                .push(c);
        } else if let Some((start, word)) = current.take() {
            result.push(Token {
                folded: fold(&word),
                start,
                end: pos,
            });
        }
        pos += c.len_utf16();
    }
    if let Some((start, word)) = current {
        result.push(Token {
            folded: fold(&word),
            start,
            end: pos,
        });
    }
    debug_assert!(result.iter().all(|t| t.folded.chars().all(is_word_char)));
    result
}

const STOPWORDS: &[&str] = &[
    "aber",
    "alle",
    "als",
    "also",
    "am",
    "an",
    "auch",
    "auf",
    "aus",
    "bei",
    "bin",
    "bis",
    "da",
    "dann",
    "das",
    "dass",
    "dem",
    "den",
    "der",
    "des",
    "die",
    "dies",
    "diese",
    "doch",
    "du",
    "ein",
    "eine",
    "einem",
    "einen",
    "einer",
    "er",
    "es",
    "etwas",
    "fur",
    "gibt",
    "hab",
    "habe",
    "haben",
    "hast",
    "hat",
    "hatte",
    "ich",
    "ihr",
    "im",
    "in",
    "ist",
    "ja",
    "kann",
    "mal",
    "man",
    "mein",
    "meine",
    "meinem",
    "meinen",
    "mich",
    "mir",
    "mit",
    "nach",
    "nicht",
    "noch",
    "notiert",
    "notiz",
    "notizen",
    "nur",
    "ob",
    "oder",
    "schon",
    "sein",
    "sich",
    "sie",
    "sind",
    "so",
    "uber",
    "um",
    "und",
    "uns",
    "vom",
    "von",
    "vor",
    "war",
    "waren",
    "was",
    "weil",
    "wann",
    "wegen",
    "welche",
    "welcher",
    "welches",
    "wer",
    "wie",
    "wieder",
    "wir",
    "wo",
    "zu",
    "zum",
    "zur",
    "warum",
    "wieso",
    "weshalb",
    "wohin",
    "woher",
    "womit",
    "wem",
    "wen",
    "gerade",
    "eigentlich",
    // Englisch, häufig in gemischten Notizen
    "the",
    "and",
    "or",
    "of",
    "to",
    "is",
    "what",
    "where",
    "when",
    "how",
    "did",
    "my",
];

/// Häufige deutsche Endungen, damit „Heizungen“ auch „Heizung“ findet.
const SUFFIXES: &[&str] = &["ern", "en", "er", "es", "em", "e", "n", "s"];

/// Ein Suchbegriff aus der Anfrage.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Term {
    /// Normalisierter (und gekürzter) Wortanfang
    pub stem: String,
    /// `true`: passt auf jedes Wort, das mit `stem` beginnt
    pub prefix: bool,
}

impl Term {
    fn new(word: &str) -> Self {
        let len = word.chars().count();
        if len < 3 {
            return Self {
                stem: word.into(),
                prefix: false,
            };
        }
        let stem = SUFFIXES
            .iter()
            .find_map(|suffix| {
                word.strip_suffix(suffix)
                    .filter(|rest| rest.chars().count() >= 4)
            })
            .unwrap_or(word);
        Self {
            stem: stem.into(),
            prefix: true,
        }
    }

    pub fn matches(&self, folded: &str) -> bool {
        if self.prefix {
            folded.starts_with(&self.stem)
        } else {
            folded == self.stem
        }
    }

    /// FTS5-Ausdruck. `stem` besteht nur aus Wortzeichen, Quotes sind also sicher.
    pub fn fts(&self) -> String {
        if self.prefix {
            format!("\"{}\"*", self.stem)
        } else {
            format!("\"{}\"", self.stem)
        }
    }
}

/// Suchbegriffe ohne Füllwörter und ohne Duplikate.
/// Besteht die Anfrage nur aus Füllwörtern, zählen sie doch.
pub fn query_terms(query: &str) -> Vec<Term> {
    let words: Vec<String> = tokens(query).into_iter().map(|t| t.folded).collect();
    let content: Vec<&String> = words
        .iter()
        .filter(|word| !STOPWORDS.contains(&word.as_str()))
        .collect();
    let chosen = if content.is_empty() {
        words.iter().collect()
    } else {
        content
    };
    let mut terms: Vec<Term> = Vec::new();
    for term in chosen.into_iter().map(|word| Term::new(word)) {
        if !terms.contains(&term) {
            terms.push(term);
        }
    }
    terms
}

const QUESTION_WORDS: &[&str] = &[
    "wo", "was", "wann", "wer", "wie", "warum", "wieso", "weshalb", "welche", "welcher", "welches",
    "welchen", "welchem", "wem", "wen", "wohin", "woher", "womit", "wozu", "wieviel", "hab",
    "habe", "hatte", "hatten", "gibt", "ist", "sind", "war", "kann", "soll", "muss", "what",
    "where", "when", "who", "why", "how", "which", "did", "do", "does", "is",
];

/// Frage (→ Kurzantwort) oder nur Stichwörter?
/// Frage = endet mit „?“ oder beginnt mit einem Fragewort und hat mehr als ein Wort.
pub fn is_question(query: &str) -> bool {
    let query = query.trim();
    let words = tokens(query);
    if words.is_empty() {
        return false;
    }
    query.ends_with('?') || (words.len() > 1 && QUESTION_WORDS.contains(&words[0].folded.as_str()))
}

/// Sortiert und vereint Bereiche, die sich überlappen oder nur durch
/// Leerraum getrennt sind („Heizung Bad“ wird ein Bereich).
pub fn merge_ranges(text: &str, mut ranges: Vec<(usize, usize)>) -> Vec<(usize, usize)> {
    ranges.sort_unstable();
    let units: Vec<u16> = text.encode_utf16().collect();
    let only_space = |from: usize, to: usize| {
        char::decode_utf16(
            units[from.min(units.len())..to.min(units.len())]
                .iter()
                .copied(),
        )
        .all(|c| c.is_ok_and(|c| c == ' ' || c == '\t'))
    };
    let mut merged: Vec<(usize, usize)> = Vec::new();
    for (start, end) in ranges {
        match merged.last_mut() {
            Some(last) if start <= last.1 || only_space(last.1, start) => last.1 = last.1.max(end),
            _ => merged.push((start, end)),
        }
    }
    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    fn slice(text: &str, (start, end): (usize, usize)) -> String {
        String::from_utf16(&text.encode_utf16().collect::<Vec<_>>()[start..end]).unwrap()
    }

    #[test]
    fn tokens_use_utf16_offsets() {
        let text = "🔥 Ärzte-Termin, Café\u{301}!";
        let found = tokens(text);
        let words: Vec<_> = found.iter().map(|t| t.folded.as_str()).collect();
        assert_eq!(words, ["arzte", "termin", "cafe"]);
        assert_eq!(slice(text, (found[0].start, found[0].end)), "Ärzte");
        assert_eq!(slice(text, (found[2].start, found[2].end)), "Café\u{301}");
    }

    #[test]
    fn query_terms_drop_stopwords_and_stem() {
        let terms = query_terms("Wann war das mit den Heizungen im Bad?");
        assert_eq!(
            terms,
            [
                Term {
                    stem: "heizung".into(),
                    prefix: true
                },
                Term {
                    stem: "bad".into(),
                    prefix: true
                }
            ]
        );
        assert!(terms[0].matches("heizung"));
        assert!(terms[1].matches("badezimmer"));
        assert_eq!(query_terms("was ist das").len(), 3);
        assert_eq!(query_terms("Dr").first().unwrap().fts(), "\"dr\"");
        assert!(query_terms("?!").is_empty());
    }

    #[test]
    fn questions() {
        assert!(is_question("wann war die Heizung kaputt"));
        assert!(is_question("Risotto?"));
        assert!(!is_question("Heizung"));
        assert!(!is_question("Wo"));
        assert!(!is_question("Heizung Bad"));
        assert!(!is_question("?"));
    }

    #[test]
    fn merges_neighbours() {
        let text = "Heizung Bad klackert.\nBad";
        assert_eq!(
            merge_ranges(text, vec![(22, 25), (8, 11), (0, 7), (12, 20)]),
            [(0, 20), (22, 25)]
        );
    }
}
