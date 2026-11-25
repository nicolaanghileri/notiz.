# CONTRACT – Schnittstelle Backend ↔ Frontend

Das ist der Vertrag zwischen **Agent A (Rust-Backend, `src-tauri/`)** und **Agent B (Frontend, `src/`)**.

- Frontend ruft Commands per Tauri `invoke()` auf, Backend schickt Events per `emit()`.
- Feldnamen sind in JSON **camelCase** (Rust: `#[serde(rename_all = "camelCase")]`).
- Datumswerte sind ISO-8601-Strings in UTC.
- **Nicht eigenmächtig ändern.** Wenn etwas fehlt oder unpraktisch ist: in `OPEN_QUESTIONS.md` eintragen und Nicola entscheiden lassen.

## Typen

```ts
type Source = 'app' | 'quick';

interface Note {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  source: Source;
  deletedAt: string | null;   // != null → im Papierkorb
}

type Filter    = 'all' | 'today' | 'last7' | 'quick' | 'pinned' | 'trash';
type Range     = 'all' | 'lastMonth' | 'thisYear';
type AiCommand = 'improve' | 'correct' | 'summarize' | 'custom';

interface SearchHit {
  note: Note;
  highlights: [number, number][];   // UTF-16-Bereiche [start, end): note.text.slice(start, end)
  score: number;
  tier: 'match' | 'weak';            // 'weak' = Abschnitt "Weniger passend"
}

interface Settings {
  theme: 'light' | 'dark' | 'system';
  captureShortcut: string;           // z. B. "Alt+Space" / "Ctrl+Shift+Space"
  hasApiKey: boolean;
}
```

## Commands

| Command | Parameter | Rückgabe | Hinweis |
|---|---|---|---|
| `notes_list` | `filter: Filter` | `Note[]` | neueste zuerst (nach `createdAt`), `trash` nur gelöschte, sonst nur nicht gelöschte |
| `notes_counts` | – | `Record<Filter, number>` | für die Zahlen in der Sidebar |
| `note_get` | `id` | `Note` | |
| `note_create` | `text, source` | `Note` | |
| `note_update` | `id, text` | `Note` | Autosave, Frontend debounced (~400 ms) |
| `note_set_pinned` | `id, pinned` | `Note` | |
| `note_delete` | `id` | – | verschiebt in den Papierkorb |
| `note_restore` | `id` | – | aus Papierkorb zurück |
| `note_delete_forever` | `id` | – | endgültig |
| `search` | `requestId, query, range: Range` | `{ hits: SearchHit[]; answerRequestId: string \| null }` | `answerRequestId` = die übergebene `requestId`, wenn eine Kurzantwort folgt (nur bei einer Frage), sonst `null` |
| `ai_transform` | `requestId, command: AiCommand, text, instruction?` | – | Ergebnis kommt per Events |
| `ai_summarize_notes` | `requestId, ids: string[]` | – | Ergebnis per Events, Frontend legt danach neue Notiz an |
| `ai_cancel` | `requestId` | – | danach kein Event mehr für diese `requestId` (auch kein `ai://done` / `ai://error`) |
| `settings_get` | – | `Settings` | |
| `settings_set` | `partial: Partial<Settings>` (ohne `hasApiKey`) | – | |
| `api_key_set` | `key: string` | – | speichert im System-Keychain |

`requestId` erzeugt das Frontend (z. B. `crypto.randomUUID()`).

**Zeiträume** gelten für `createdAt` in der lokalen Zeitzone:

| Wert | Bedeutung |
|---|---|
| `today` | ab heute 00:00 |
| `last7` | heute + die 6 Tage davor |
| `lastMonth` | heute + die 30 Tage davor |
| `thisYear` | aktuelles Kalenderjahr |

**Mehrere Notizen:** Für Korrigieren, Verbessern und eigene Anweisung ruft das Frontend `ai_transform` pro Notiz auf, je mit eigener `requestId`. Nur Zusammenfassen läuft über `ai_summarize_notes`.

**Quick-Capture-Fenster schliessen:** kein Command. Das Frontend ruft `getCurrentWindow().hide()` auf, das Backend gibt die Berechtigung in `src-tauri/capabilities/` frei.

## Events (Backend → Frontend)

| Event | Payload | Wann |
|---|---|---|
| `ai://chunk` | `{ requestId, delta: string }` | Streaming-Teil der KI-Antwort |
| `ai://done` | `{ requestId, text: string, sources?: string[] }` | fertig; `sources` = Note-IDs, auf die sich eine Kurzantwort stützt |
| `ai://error` | `{ requestId, message: string }` | Fehler (kein API-Key, Netz, Limit …) |
| `notes://changed` | `{ id }` | nur wenn eine Notiz ausserhalb der aktuellen Ansicht geändert/erstellt wurde (z. B. Quick Capture) |

Die Kurzantwort der Suche läuft über dieselben `ai://`-Events mit der `requestId`, die das Frontend bei `search` mitgibt. Das Frontend kennt die ID also, bevor das erste Event eintrifft. Der Antworttext enthält die Quellen-Badges als `[1]`, `[2]`, `[3]`, 1-basiert in der Reihenfolge der `hits`. `sources` enthält die zugehörigen Note-IDs.

## Fehler

Commands geben bei Fehlern einen String zurück (Tauri `Result<T, String>`), den das Frontend als dezente Meldung anzeigt.
