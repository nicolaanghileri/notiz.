# Prompt: Agent A – Rust-Backend

Erst nach Phase 0 starten. Am besten auf eigenem Branch bzw. Git-Worktree (`agent-a-backend`), parallel zu Agent B. Diesen Text in eine neue Agent-Session kopieren:

---

```
Du bist Agent A (Backend) im Projekt "notiz.". Lies zuerst:
- AGENTS.md
- docs/BRIEF.md (vor allem Abschnitte 1, 7, 11, 14 und 15)
- CONTRACT.md

Regeln:
- Du arbeitest NUR in src-tauri/. Dateien in src/ fasst du nicht an.
- CONTRACT.md ist verbindlich. Nicht ändern. Wenn etwas fehlt oder
  unklar ist: in OPEN_QUESTIONS.md eintragen (mit "[Agent A]") und mit
  einer sinnvollen Annahme weitermachen.
- Nach jedem abgeschlossenen Schritt: Tests laufen lassen, committen.

Setz der Reihe nach um:
1. SQLite-Datenbank mit Migrationen (Tabelle notes gemäss Datenmodell,
   Speicherort im App-Data-Verzeichnis).
2. Alle Notiz-Commands aus CONTRACT.md (notes_list, notes_counts,
   note_get/create/update/set_pinned/delete/restore/delete_forever).
3. Volltextsuche mit FTS5 inkl. highlights (Zeichen-Bereiche) und
   Zeitraum-Filter.
4. Semantische Suche: Embeddings lokal mit fastembed (mehrsprachiges
   Modell), Vektoren in SQLite, Cosine-Ähnlichkeit. Hybrid-Ranking aus
   Volltext + Bedeutung, Aufteilung in tier 'match' und 'weak'.
   Embeddings beim Speichern im Hintergrund aktualisieren.
5. Claude-Anbindung per reqwest mit Streaming (ai_transform,
   ai_summarize_notes, ai_cancel, Kurzantwort für search) über die
   ai://-Events. System-Prompts:
   - correct: nur Rechtschreibung/Grammatik/Zeichensetzung, nichts sonst
   - improve: klarer formulieren, Inhalt gleich, nichts erfinden
   - summarize: kürzer, Kernpunkte behalten
   - Kurzantwort: nur aus den gefundenen Notizen, jede Aussage mit Quelle
   Model-Namen als Konstanten. Notiztext geht nur bei aktivem Befehl
   oder Suchfrage an die API.
6. API-Key im System-Keychain (keyring crate), settings_get/set.
7. Globaler Shortcut für Quick Capture (macOS Alt+Space, Windows
   Ctrl+Shift+Space, änderbar), eigenes kleines Fenster ohne Rahmen
   (lädt die Frontend-Route /capture), App läuft im Hintergrund mit
   Tray-Icon weiter, single-instance. Nach dem Speichern
   notes://changed senden.

Am Ende: kurze Zusammenfassung, was fertig ist, was offen ist.
```
