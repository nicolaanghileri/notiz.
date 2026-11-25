/**
 * Einzige Schnittstelle des Frontends zum Backend (siehe CONTRACT.md).
 *
 * VITE_USE_MOCK=true → Mock im Speicher (mock.ts), sonst echte Tauri-Commands.
 * Commands werfen bei Fehlern einen String (Tauri `Result<T, String>`).
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createMockApi } from "./mock";
import type {
  AiChunk,
  AiCommand,
  AiDone,
  AiError,
  EventMap,
  Filter,
  Note,
  NoteCounts,
  NotesChanged,
  Range,
  SearchResult,
  Settings,
  SettingsPatch,
  Source,
} from "./types";

export type Unlisten = () => void;

export interface NotizApi {
  notesList(filter: Filter): Promise<Note[]>;
  notesCounts(): Promise<NoteCounts>;
  noteGet(id: string): Promise<Note>;
  noteCreate(text: string, source: Source): Promise<Note>;
  noteUpdate(id: string, text: string): Promise<Note>;
  noteSetPinned(id: string, pinned: boolean): Promise<Note>;
  noteDelete(id: string): Promise<void>;
  noteRestore(id: string): Promise<void>;
  noteDeleteForever(id: string): Promise<void>;
  search(
    requestId: string,
    query: string,
    range: Range,
  ): Promise<SearchResult>;
  aiTransform(
    requestId: string,
    command: AiCommand,
    text: string,
    instruction?: string,
  ): Promise<void>;
  aiSummarizeNotes(requestId: string, ids: string[]): Promise<void>;
  aiCancel(requestId: string): Promise<void>;
  settingsGet(): Promise<Settings>;
  settingsSet(partial: SettingsPatch): Promise<void>;
  apiKeySet(key: string): Promise<void>;
  on<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void,
  ): Promise<Unlisten>;
}

const tauriApi: NotizApi = {
  notesList: (filter) => invoke("notes_list", { filter }),
  notesCounts: () => invoke("notes_counts"),
  noteGet: (id) => invoke("note_get", { id }),
  noteCreate: (text, source) => invoke("note_create", { text, source }),
  noteUpdate: (id, text) => invoke("note_update", { id, text }),
  noteSetPinned: (id, pinned) => invoke("note_set_pinned", { id, pinned }),
  noteDelete: (id) => invoke("note_delete", { id }),
  noteRestore: (id) => invoke("note_restore", { id }),
  noteDeleteForever: (id) => invoke("note_delete_forever", { id }),
  search: (requestId, query, range) =>
    invoke("search", { requestId, query, range }),
  aiTransform: (requestId, command, text, instruction) =>
    invoke("ai_transform", { requestId, command, text, instruction }),
  aiSummarizeNotes: (requestId, ids) =>
    invoke("ai_summarize_notes", { requestId, ids }),
  aiCancel: (requestId) => invoke("ai_cancel", { requestId }),
  settingsGet: () => invoke("settings_get"),
  settingsSet: (partial) => invoke("settings_set", { partial }),
  apiKeySet: (key) => invoke("api_key_set", { key }),
  on: (event, handler) =>
    listen(event, (e) => handler(e.payload as EventMap[typeof event])),
};

export const isMock = import.meta.env.VITE_USE_MOCK === "true";

const api: NotizApi = isMock ? createMockApi() : tauriApi;

// Commands
export const notesList = api.notesList;
export const notesCounts = api.notesCounts;
export const noteGet = api.noteGet;
export const noteCreate = api.noteCreate;
export const noteUpdate = api.noteUpdate;
export const noteSetPinned = api.noteSetPinned;
export const noteDelete = api.noteDelete;
export const noteRestore = api.noteRestore;
export const noteDeleteForever = api.noteDeleteForever;
export const search = api.search;
export const aiTransform = api.aiTransform;
export const aiSummarizeNotes = api.aiSummarizeNotes;
export const aiCancel = api.aiCancel;
export const settingsGet = api.settingsGet;
export const settingsSet = api.settingsSet;
export const apiKeySet = api.apiKeySet;

// Events. Rückgabe: Funktion zum Abmelden.
export const onAiChunk = (handler: (payload: AiChunk) => void) =>
  api.on("ai://chunk", handler);
export const onAiDone = (handler: (payload: AiDone) => void) =>
  api.on("ai://done", handler);
export const onAiError = (handler: (payload: AiError) => void) =>
  api.on("ai://error", handler);
export const onNotesChanged = (handler: (payload: NotesChanged) => void) =>
  api.on("notes://changed", handler);
