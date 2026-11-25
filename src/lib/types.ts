/**
 * Typen aus CONTRACT.md. Gegenstück: src-tauri/src/models.rs.
 * Nicht eigenmächtig ändern, siehe AGENTS.md.
 */

export type Source = "app" | "quick";

export interface Note {
  id: string;
  text: string;
  /** ISO-8601, UTC */
  createdAt: string;
  /** ISO-8601, UTC */
  updatedAt: string;
  pinned: boolean;
  source: Source;
  /** != null → im Papierkorb */
  deletedAt: string | null;
}

export type Filter = "all" | "today" | "last7" | "quick" | "pinned" | "trash";
export type Range = "all" | "lastMonth" | "thisYear";
export type AiCommand = "improve" | "correct" | "summarize" | "custom";

export interface SearchHit {
  note: Note;
  /** Zeichen-Bereiche [start, end) in note.text */
  highlights: [number, number][];
  score: number;
  /** "weak" = Abschnitt „Weniger passend“ */
  tier: "match" | "weak";
}

export interface Settings {
  theme: "light" | "dark" | "system";
  /** z. B. "Alt+Space" / "Ctrl+Shift+Space" */
  captureShortcut: string;
  hasApiKey: boolean;
}

/** Rückgabe von `notes_counts` */
export type NoteCounts = Record<Filter, number>;

/** Rückgabe von `search` */
export interface SearchResult {
  hits: SearchHit[];
  /** Nur bei einer Frage gesetzt, sonst null */
  answerRequestId: string | null;
}

/** Parameter von `settings_set` */
export type SettingsPatch = Partial<Omit<Settings, "hasApiKey">>;

/** Payload von `ai://chunk` */
export interface AiChunk {
  requestId: string;
  delta: string;
}

/** Payload von `ai://done` */
export interface AiDone {
  requestId: string;
  text: string;
  /** Note-IDs, auf die sich eine Kurzantwort stützt */
  sources?: string[];
}

/** Payload von `ai://error` */
export interface AiError {
  requestId: string;
  message: string;
}

/** Payload von `notes://changed` */
export interface NotesChanged {
  id: string;
}

/** Alle Events Backend → Frontend mit ihrem Payload */
export interface EventMap {
  "ai://chunk": AiChunk;
  "ai://done": AiDone;
  "ai://error": AiError;
  "notes://changed": NotesChanged;
}
