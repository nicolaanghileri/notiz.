//! Lokales Embedding-Modell (fastembed) und Hintergrund-Thread, der die
//! Vektoren aktuell hält. Notiztext verlässt dabei den Rechner nicht.
//! Nur das Modell wird beim ersten Start einmalig heruntergeladen.

use std::path::PathBuf;
use std::sync::{Condvar, Mutex, MutexGuard};
use std::time::Duration;

use fastembed::{AutoDevicePolicy, EmbeddingModel, TextEmbedding, TextInitOptions};
use tauri::{AppHandle, Manager};

use crate::db::Db;
use crate::search::semantic::{self, Embedder, normalize};

/// Mehrsprachig, 384 Dimensionen, ca. 470 MB.
const MODEL: EmbeddingModel = EmbeddingModel::MultilingualE5Small;
const MODEL_ID: &str = "intfloat/multilingual-e5-small";
/// Wartezeit nach einer Änderung, damit Autosave beim Tippen nicht jedes Mal rechnet.
const DEBOUNCE: Duration = Duration::from_millis(1500);
/// Neuer Versuch, wenn das Modell nicht geladen werden konnte (z. B. offline).
const RETRY_LOAD: Duration = Duration::from_secs(10 * 60);
const RETRY_ERROR: Duration = Duration::from_secs(60);

pub struct FastEmbedder {
    model: TextEmbedding,
}

impl FastEmbedder {
    pub fn load(cache_dir: PathBuf) -> Result<Self, String> {
        let threads = std::thread::available_parallelism().map_or(2, |n| (n.get() / 2).max(1));
        let options = TextInitOptions::new(MODEL)
            .with_cache_dir(cache_dir)
            .with_show_download_progress(false)
            .with_intra_threads(threads)
            // Sonst kompiliert ort das Modell auf macOS für CoreML (scheiterte im Test,
            // braucht zusätzlichen Platz). Für ein kleines Modell reicht die CPU.
            .with_auto_device(AutoDevicePolicy::PreferCPU);
        TextEmbedding::try_new(options)
            .map(|model| Self { model })
            .map_err(|e| format!("Embedding-Modell nicht verfügbar: {e}"))
    }

    fn embed(&mut self, texts: Vec<String>) -> Result<Vec<Vec<f32>>, String> {
        self.model
            .embed(texts, Some(16))
            .map(|vectors| vectors.into_iter().map(normalize).collect())
            .map_err(|e| format!("Embedding fehlgeschlagen: {e}"))
    }
}

/// E5-Modelle erwarten die Präfixe „query: “ und „passage: “.
impl Embedder for FastEmbedder {
    fn model_id(&self) -> &str {
        MODEL_ID
    }

    fn embed_passages(&mut self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        self.embed(texts.iter().map(|t| format!("passage: {t}")).collect())
    }

    fn embed_query(&mut self, text: &str) -> Result<Vec<f32>, String> {
        self.embed(vec![format!("query: {text}")])?
            .pop()
            .ok_or_else(|| "Embedding fehlgeschlagen".to_string())
    }
}

/// Geteilter Zustand: Modell (sobald geladen) und Weckruf für den Thread.
pub struct SemanticIndex {
    embedder: Mutex<Option<Box<dyn Embedder>>>,
    dirty: Mutex<bool>,
    wake: Condvar,
}

impl SemanticIndex {
    pub fn new() -> Self {
        Self {
            embedder: Mutex::new(None),
            dirty: Mutex::new(true),
            wake: Condvar::new(),
        }
    }

    fn embedder(&self) -> MutexGuard<'_, Option<Box<dyn Embedder>>> {
        self.embedder.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Nach dem Speichern aufrufen: Vektoren im Hintergrund aktualisieren.
    pub fn notify_changed(&self) {
        *self.dirty.lock().unwrap_or_else(|e| e.into_inner()) = true;
        self.wake.notify_all();
    }

    /// Vektor der Suchanfrage. `None`, solange das Modell nicht bereit ist.
    pub fn query_vector(&self, query: &str) -> Option<Vec<f32>> {
        if query.trim().is_empty() {
            return None;
        }
        let mut guard = self.embedder();
        match guard.as_mut()?.embed_query(query) {
            Ok(vector) => Some(vector),
            Err(error) => {
                log::warn!("{error}");
                None
            }
        }
    }

    /// Wartet auf eine Änderung (oder bis `timeout`) und setzt das Flag zurück.
    fn wait_for_change(&self, timeout: Option<Duration>) {
        let mut dirty = self.dirty.lock().unwrap_or_else(|e| e.into_inner());
        while !*dirty {
            match timeout {
                None => dirty = self.wake.wait(dirty).unwrap_or_else(|e| e.into_inner()),
                Some(timeout) => {
                    let (guard, result) = self
                        .wake
                        .wait_timeout(dirty, timeout)
                        .unwrap_or_else(|e| e.into_inner());
                    dirty = guard;
                    if result.timed_out() {
                        break;
                    }
                }
            }
        }
        *dirty = false;
    }

    fn sleep_unless_woken(&self, duration: Duration) {
        let dirty = self.dirty.lock().unwrap_or_else(|e| e.into_inner());
        let _ = self.wake.wait_timeout(dirty, duration);
    }
}

/// Startet den Hintergrund-Thread. Erwartet `Db` und `SemanticIndex` als State.
pub fn start(app: AppHandle, cache_dir: PathBuf) {
    let spawned = std::thread::Builder::new()
        .name("notiz-embeddings".into())
        .spawn(move || run(&app, cache_dir));
    if let Err(error) = spawned {
        log::error!("Embedding-Thread nicht gestartet: {error}");
    }
}

fn run(app: &AppHandle, cache_dir: PathBuf) {
    let db = app.state::<Db>();
    let index = app.state::<SemanticIndex>();

    let embedder = loop {
        match FastEmbedder::load(cache_dir.clone()) {
            Ok(embedder) => break embedder,
            Err(error) => {
                log::warn!("{error}. Suche läuft vorerst nur über Wörter.");
                index.sleep_unless_woken(RETRY_LOAD);
            }
        }
    };
    if let Err(error) = semantic::drop_other_models(&db.lock(), embedder.model_id()) {
        log::warn!("{error}");
    }
    *index.embedder() = Some(Box::new(embedder));
    log::info!("Embedding-Modell bereit");

    loop {
        // Eine Notiz pro Durchgang, damit Suchanfragen nicht lange warten.
        let result = match index.embedder().as_mut() {
            Some(embedder) => semantic::process_pending(&db, embedder.as_mut(), 1),
            None => return,
        };
        match result {
            Ok(0) => {
                index.wait_for_change(None);
                std::thread::sleep(DEBOUNCE);
            }
            Ok(_) => {}
            Err(error) => {
                log::warn!("{error}");
                index.sleep_unless_woken(RETRY_ERROR);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOTES: &[(&str, &str)] = &[
        (
            "lena-geburi",
            "Idee für Lenas Geburi: nicht wieder Restaurant. vllt Kochkurs zu zweit? die in Wiedikon hat Thai-Kurse, Sa nachmittags, ca. 120.– p.P.\noder Wochenende Tessin, aber Hotel muss bald gebucht werden wg. Ostern\nBudget max 400\nSie hat mal gesagt sie will Töpfern lernen!! → Atelier am Idaplatz anschauen, haben die Gutscheine?\n\nnicht vergessen: Karte schreiben, nicht nur WhatsApp",
        ),
        (
            "zahnarzt",
            "Zahnarzt verschoben auf Do 14:30\nDr. Keller, Praxis am Stauffacher. Karte mitnehmen, Zahnseide-Ermahnung ignorieren lol",
        ),
        (
            "buch-tipp",
            "Buch-Tipp von Marc: Der Hals der Giraffe\nSchalansky – irgendwas mit Biologielehrerin? Marc sagt kurz, gut für Zugfahrten",
        ),
        (
            "heizung-bad",
            "Heizung Bad klackert wieder. Brunner anrufen 044 512 77 30 nur vormittags\nevtl. Mietzinsreduktion ansprechen?? nachlesen ob das bei Heizung überhaupt geht\nFoto vom Thermostat machen bevor die kommen",
        ),
        (
            "meeting-agentur",
            "Meeting Agentur: Logo zu verspielt\nnochmal mit weniger Farbe, Schrift ok. Deadline 4.12., Rechnung erst nach Freigabe",
        ),
        (
            "router-passwort",
            "Router-Passwort geändert\nsteht auf Zettel im Schrank (nicht hier!!). Gäste-WLAN heisst jetzt „Wohnung 3“",
        ),
        (
            "sauerteig",
            "Sauerteig: 100g Starter, 350 Wasser, 500 Mehl\n400 hell / 100 Vollkorn, 10g Salz, über Nacht Kühlschrank, 45 min bei 240°",
        ),
        (
            "kuerbis-risotto",
            "wo war das Restaurant mit dem Kürbis-Risotto??\nKreis 4, irgendwas mit „Rosso“? Sarah fragen, war mit ihr im Oktober dort",
        ),
        (
            "steuererklaerung",
            "Steuererklärung: Belege Säule 3a fehlen noch\nbei Bank anfragen, Frist verlängert bis 30.11. – Spendenquittung Rotes Kreuz auch noch",
        ),
        (
            "velo-service",
            "Velo-Service: Bremsen hinten, Kette\nLaden Langstrasse sagt 85.–, Do abholen. Licht hinten auch gleich",
        ),
        (
            "brunner-monteur",
            "Brunner war da (endlich) – sagt Monteur kommt nächste Woche wegen Ventil im Bad, soll mich melden falls nicht. Waschküche neu: Do ist jetzt unsere",
        ),
        (
            "nebenkosten",
            "Nebenkostenabrechnung 2025 gekommen. Heizkosten fast 30% höher als letztes Jahr?? mit Nachbarn reden, Abrechnung aufheben",
        ),
    ];

    /// Anfrage → Notizen, die als „passend“ gelten müssen.
    const QUERIES: &[(&str, &[&str])] = &[
        (
            "wann war das mit der Heizung?",
            &["heizung-bad", "brunner-monteur", "nebenkosten"],
        ),
        ("wo war das mit dem Risotto?", &["kuerbis-risotto"]),
        ("Geschenkidee Geburtstag", &["lena-geburi"]),
        ("Brot backen Rezept", &["sauerteig"]),
        ("WLAN Passwort", &["router-passwort"]),
        ("Fahrrad reparieren", &["velo-service"]),
        ("Termin beim Arzt", &["zahnarzt"]),
        (
            "was muss ich für die Steuern noch machen?",
            &["steuererklaerung"],
        ),
    ];

    /// Echtes Modell (lädt ca. 470 MB herunter). Gibt Ähnlichkeiten aus, um die
    /// Schwellen in `search/mod.rs` festzulegen:
    /// `NOTIZ_MODEL_DIR=… cargo test --lib calibrate -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn calibrate() {
        use crate::db::Db;
        use crate::models::{Range, Source, Tier};

        let dir = std::env::var("NOTIZ_MODEL_DIR").expect("NOTIZ_MODEL_DIR setzen");
        let mut embedder = FastEmbedder::load(dir.into()).unwrap();
        let db = Db::in_memory();
        let ids: Vec<(String, &str)> = NOTES
            .iter()
            .map(|(id, text)| {
                let note = crate::notes::create(&db.lock(), text, Source::App).unwrap();
                (note.id, *id)
            })
            .collect();
        let name = |note_id: &str| ids.iter().find(|(id, _)| id == note_id).unwrap().1;
        while semantic::process_pending(&db, &mut embedder, 4).unwrap() > 0 {}

        let mut failures = Vec::new();
        for (query, expected) in QUERIES {
            let vector = embedder.embed_query(query).unwrap();
            let ranked = semantic::rank(&db.lock(), &vector, &Default::default()).unwrap();
            println!("\n{query}");
            for hit in &ranked {
                let id = crate::notes::get_by_seq(&db.lock(), hit.seq).unwrap().id;
                println!("  {:.3} {}", hit.similarity, name(&id));
            }
            let hits = crate::search::search(&db.lock(), query, Range::All, Some(&vector)).unwrap();
            let matches: Vec<&str> = hits
                .iter()
                .filter(|hit| hit.tier == Tier::Match)
                .map(|hit| name(&hit.note.id))
                .collect();
            let weak: Vec<&str> = hits
                .iter()
                .filter(|hit| hit.tier == Tier::Weak)
                .map(|hit| name(&hit.note.id))
                .collect();
            println!("  → match {matches:?}, weak {weak:?}");
            let missing: Vec<_> = expected.iter().filter(|id| !matches.contains(id)).collect();
            let extra: Vec<_> = matches.iter().filter(|id| !expected.contains(id)).collect();
            if !missing.is_empty() || extra.len() > 1 {
                failures.push(format!("{query}: fehlt {missing:?}, zu viel {extra:?}"));
            }
        }
        assert!(failures.is_empty(), "{failures:#?}");
    }
}
