/**
 * Eigener Undo-Verlauf für den Editor. Der native Verlauf der Textarea geht
 * verloren, sobald der Text programmatisch gesetzt wird (z. B. KI annehmen).
 */
export interface EditState {
  text: string;
  start: number;
  end: number;
}

const MAX = 500;
const COALESCE_MS = 1000;

export class History {
  private undoStack: EditState[] = [];
  private redoStack: EditState[] = [];
  private lastEdit = 0;
  private lastKind: "insert" | "delete" | null = null;

  /** Vor einer Tipp-Änderung aufrufen. Fasst schnelles Tippen zusammen. */
  record(before: EditState, after: string) {
    const kind = after.length >= before.text.length ? "insert" : "delete";
    const now = Date.now();
    const inserted = after.length > before.text.length ? after.slice(before.start, before.start + after.length - before.text.length) : "";
    const boundary = now - this.lastEdit > COALESCE_MS || kind !== this.lastKind || inserted.includes("\n") || before.start !== before.end;
    if (boundary || this.undoStack.length === 0) this.push(before);
    this.lastEdit = now;
    this.lastKind = kind;
    this.redoStack = [];
  }

  /** Harte Grenze, z. B. vor „KI annehmen“ */
  checkpoint(before: EditState) {
    this.push(before);
    this.lastKind = null;
    this.redoStack = [];
  }

  private push(state: EditState) {
    this.undoStack.push(state);
    if (this.undoStack.length > MAX) this.undoStack.shift();
  }

  undo(current: EditState): EditState | null {
    const state = this.undoStack.pop();
    if (!state) return null;
    this.redoStack.push(current);
    this.lastKind = null;
    return state;
  }

  redo(current: EditState): EditState | null {
    const state = this.redoStack.pop();
    if (!state) return null;
    this.undoStack.push(current);
    this.lastKind = null;
    return state;
  }
}
