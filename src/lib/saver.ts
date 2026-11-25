/**
 * Autosave: debounced (~400 ms, CONTRACT.md), Aufrufe strikt nacheinander.
 * Eine neue Notiz wird erst beim ersten nicht-leeren Text angelegt.
 */
import { noteCreate, noteUpdate } from "./api";
import type { Note } from "./types";

export type SaveStatus = "saved" | "dirty" | "saving" | "error";

const DEBOUNCE_MS = 400;

export class NoteSaver {
  private pending: string | null = null;
  private timer: number | undefined;
  private chain: Promise<boolean> = Promise.resolve(true);
  private disposed = false;

  constructor(
    public id: string | null,
    private readonly listener: {
      status: (status: SaveStatus) => void;
      saved: (note: Note, created: boolean) => void;
      error: (error: unknown) => void;
    },
  ) {}

  schedule(text: string) {
    this.pending = text;
    this.listener.status("dirty");
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }

  get hasPending() {
    return this.pending !== null;
  }

  /** Speichert sofort. true, wenn alles gespeichert ist. */
  flush(): Promise<boolean> {
    window.clearTimeout(this.timer);
    if (this.pending === null) return this.chain;
    const text = this.pending;
    this.pending = null;
    this.chain = this.chain.then(async () => {
      if (!this.disposed) this.listener.status("saving");
      try {
        let note: Note | null = null;
        let created = false;
        if (this.id) {
          note = await noteUpdate(this.id, text);
        } else if (text.trim()) {
          note = await noteCreate(text, "app");
          this.id = note.id;
          created = true;
        }
        if (note) this.listener.saved(note, created);
        if (!this.disposed) this.listener.status(this.pending === null ? "saved" : "dirty");
        return true;
      } catch (error) {
        // Text nicht verlieren: beim nächsten Versuch erneut senden
        this.pending ??= text;
        if (!this.disposed) this.listener.status("error");
        this.listener.error(error);
        return false;
      }
    });
    return this.chain;
  }

  /** Beim Verlassen: Rest speichern, danach keine Status-Updates mehr */
  dispose(): Promise<boolean> {
    const done = this.flush();
    this.disposed = true;
    return done;
  }
}
