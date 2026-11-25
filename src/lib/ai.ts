/**
 * KI-Anfragen über die ai://-Events (CONTRACT.md). Die Listener sind
 * angemeldet, bevor der Command startet; die requestId erzeugt das Frontend.
 */
import { aiCancel, onAiChunk, onAiDone, onAiError } from "./api";

export interface AiHandlers {
  /** Bisher gestreamter Text (kumuliert) */
  chunk?: (text: string) => void;
  done: (text: string, sources?: string[]) => void;
  error: (message: string) => void;
}

interface Entry extends AiHandlers {
  text: string;
}

const entries = new Map<string, Entry>();
let ready: Promise<void> | null = null;

function listen(): Promise<void> {
  ready ??= Promise.all([
    onAiChunk(({ requestId, delta }) => {
      const entry = entries.get(requestId);
      if (!entry) return;
      entry.text += delta;
      entry.chunk?.(entry.text);
    }),
    onAiDone(({ requestId, text, sources }) => {
      const entry = entries.get(requestId);
      if (!entry) return;
      entries.delete(requestId);
      entry.done(text, sources);
    }),
    onAiError(({ requestId, message }) => {
      const entry = entries.get(requestId);
      if (!entry) return;
      entries.delete(requestId);
      entry.error(message);
    }),
  ]).then(() => undefined);
  return ready;
}

export const errorMessage = (error: unknown) =>
  typeof error === "string" ? error : error instanceof Error ? error.message : "Unbekannter Fehler";

export interface AiRequest<T> {
  id: string;
  /** Ergebnis des Commands selbst (z. B. Treffer bei `search`) */
  started: Promise<T | undefined>;
  /** Abbrechen: danach kommt kein Handler-Aufruf mehr */
  cancel: () => void;
  /** Nur abmelden, ohne ai_cancel (z. B. wenn keine Kurzantwort folgt) */
  forget: () => void;
}

export function runAi<T>(start: (requestId: string) => Promise<T>, handlers: AiHandlers): AiRequest<T> {
  const id = crypto.randomUUID();
  entries.set(id, { ...handlers, text: "" });
  const started = listen()
    .then(() => (entries.has(id) ? start(id) : undefined))
    .catch((error) => {
      const entry = entries.get(id);
      entries.delete(id);
      entry?.error(errorMessage(error));
      return undefined;
    });
  return {
    id,
    started,
    cancel: () => {
      if (entries.delete(id)) void aiCancel(id).catch(() => {});
    },
    forget: () => void entries.delete(id),
  };
}
