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
  highlights: [number, number][];   // Zeichen-Bereiche [start, end) im note.text
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
| `notes_list` | `filter: Filter` | `Note[]` | neueste zuerst, `trash` nur gelöschte, sonst nur nicht gelöschte |
| `notes_counts` | – | `Record<Filter, number>` | für die Zahlen in der Sidebar |
| `note_get` | `id` | `Note` | |
| `note_create` | `text, source` | `Note` | |
| `note_update` | `id, text` | `Note` | Autosave, Frontend debounced (~400 ms) |
| `note_set_pinned` | `id, pinned` | `Note` | |
| `note_delete` | `id` | – | verschiebt in den Papierkorb |
| `note_restore` | `id` | – | aus Papierkorb zurück |
| `note_delete_forever` | `id` | – | endgültig |
| `search` | `query, range: Range` | `{ hits: SearchHit[]; answerRequestId: string \| null }` | `answerRequestId` nur bei einer Frage, sonst `null` |
| `ai_transform` | `requestId, command: AiCommand, text, instruction?` | – | Ergebnis kommt per Events |
| `ai_summarize_notes` | `requestId, ids: string[]` | – | Ergebnis per Events, Frontend legt danach neue Notiz an |
| `ai_cancel` | `requestId` | – | |
| `settings_get` | – | `Settings` | |
| `settings_set` | `Partial<Settings>` (ohne `hasApiKey`) | – | |
| `api_key_set` | `key: string` | – | speichert im System-Keychain |

`requestId` erzeugt das Frontend (z. B. `crypto.randomUUID()`).

## Events (Backend → Frontend)

| Event | Payload | Wann |
|---|---|---|
| `ai://chunk` | `{ requestId, delta: string }` | Streaming-Teil der KI-Antwort |
| `ai://done` | `{ requestId, text: string, sources?: string[] }` | fertig; `sources` = Note-IDs, auf die sich eine Kurzantwort stützt |
| `ai://error` | `{ requestId, message: string }` | Fehler (kein API-Key, Netz, Limit …) |
| `notes://changed` | `{ id }` | Notiz wurde ausserhalb der aktuellen Ansicht geändert/erstellt (z. B. Quick Capture) |

Die Kurzantwort der Suche läuft über dieselben `ai://`-Events mit der `answerRequestId`. Das Frontend nummeriert die Quellen-Badges [1] [2] [3] in der Reihenfolge der `hits`.

## Fehler

Commands geben bei Fehlern einen String zurück (Tauri `Result<T, String>`), den das Frontend als dezente Meldung anzeigt.
