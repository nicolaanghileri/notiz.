import { ArrowLeft, Copy, CopyPlus, Ellipsis, PanelRight, Pin, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import * as api from "../lib/api";
import { formatRelative } from "../lib/dates";
import { History, type EditState } from "../lib/history";
import { wordCount } from "../lib/noteText";
import { isMac, kbd, modKey } from "../lib/platform";
import { NoteSaver, type SaveStatus } from "../lib/saver";
import type { Note } from "../lib/types";
import { runAi, type AiRequest } from "../lib/ai";
import { changeCount, diffWords } from "../lib/diff";
import type { AiCommand } from "../lib/types";
import { AiMenu, AI_COMMANDS, commandLabel, DiffLegend, PreviewBody, PreviewPanel, previewKeyHandler, type PreviewMode, type PreviewState } from "./ai";
import { ConfirmDialog } from "./ConfirmDialog";
import { errorText, useToast } from "./Toast";
import { Button, cx, IconButton } from "./ui";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Gespeichert",
  dirty: "Speichert …",
  saving: "Speichert …",
  error: "Nicht gespeichert",
};

export interface EditorProps {
  noteId: string | null;
  backLabel: string;
  onBack: () => void;
  /** Neue Notiz wurde beim ersten Speichern angelegt */
  onCreated: (id: string) => void;
  /** Liste/Zahlen neu laden */
  onChanged: () => void;
  onOpen: (id: string) => void;
  onOpenSettings?: () => void;
}

interface Preview {
  command: AiCommand;
  instruction?: string;
  start: number;
  end: number;
  state: PreviewState;
  mode: PreviewMode;
}

export function Editor({ noteId, backLabel, onBack, onCreated, onChanged, onOpen, onOpenSettings }: EditorProps) {
  const toast = useToast();
  const [note, setNote] = useState<Note | null>(null);
  const [loaded, setLoaded] = useState(noteId === null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const [focused, setFocused] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [confirmForever, setConfirmForever] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuActive, setMenuActive] = useState(0);
  const [menuPos, setMenuPos] = useState<CSSProperties>({ left: 0, top: 0 });
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const request = useRef<AiRequest<void> | null>(null);
  /** Markierung, für die das Menü per esc geschlossen wurde */
  const dismissed = useRef<{ start: number; end: number } | null>(null);
  const dragging = useRef(false);
  const column = useRef<HTMLDivElement>(null);
  const instructionInput = useRef<HTMLInputElement>(null);

  const area = useRef<HTMLTextAreaElement>(null);
  const history = useRef(new History());
  const textRef = useRef(text);
  textRef.current = text;
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const callbacks = useRef({ onCreated, onChanged });
  callbacks.current = { onCreated, onChanged };

  const saver = useRef<NoteSaver>(null);
  if (!saver.current) {
    saver.current = new NoteSaver(noteId, {
      status: setStatus,
      saved: (saved, created) => {
        setNote(saved);
        if (created) callbacks.current.onCreated(saved.id);
        callbacks.current.onChanged();
      },
      error: () => {},
    });
  }

  // Laden
  useEffect(() => {
    if (noteId === null || saver.current!.id !== noteId || note) return;
    let alive = true;
    api.noteGet(noteId).then(
      (loadedNote) => {
        if (!alive) return;
        setNote(loadedNote);
        setText(loadedNote.text);
        setLoaded(true);
      },
      (error) => {
        toast.show({ message: errorText(error), tone: "error" });
        onBack();
      },
    );
    return () => {
      alive = false;
    };
  }, [noteId, note, toast, onBack]);

  // Fokus nach dem Laden: neue Notiz → Cursor drin
  useEffect(() => {
    if (!loaded) return;
    const el = area.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (noteId === null) el.setSelectionRange(el.value.length, el.value.length);
    else el.setSelectionRange(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Beim Verlassen speichern
  useEffect(() => {
    const current = saver.current!;
    const flush = () => void current.flush();
    window.addEventListener("blur", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("blur", flush);
      window.removeEventListener("beforeunload", flush);
      void current.dispose().then((ok) => {
        if (!ok)
          toast.show({
            message: "Notiz konnte nicht gespeichert werden",
            tone: "error",
            action: { label: "Erneut versuchen", run: () => void current.flush() },
          });
      });
    };
  }, [toast]);

  useLayoutEffect(() => {
    const target = pendingSelection.current;
    const el = area.current;
    if (!target || !el) return;
    pendingSelection.current = null;
    el.focus({ preventScroll: true });
    el.setSelectionRange(target.start, target.end);
    setSel(target);
  });

  const readOnly = note?.deletedAt != null;

  const currentState = (): EditState => {
    const el = area.current;
    return { text: textRef.current, start: el?.selectionStart ?? 0, end: el?.selectionEnd ?? 0 };
  };

  /** Text programmatisch setzen (Undo, KI), Auswahl danach wiederherstellen */
  const applyState = useCallback((state: EditState) => {
    setText(state.text);
    textRef.current = state.text;
    pendingSelection.current = { start: state.start, end: state.end };
    if (state.end > state.start) dismissed.current = { start: state.start, end: state.end };
    saver.current!.schedule(state.text);
  }, []);

  const undo = useCallback(() => {
    const state = history.current.undo(currentState());
    if (state) applyState(state);
    toast.hide();
    return state !== null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyState, toast]);

  const redo = useCallback(() => {
    const state = history.current.redo(currentState());
    if (state) applyState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyState]);

  const readSelection = () => {
    const el = area.current;
    if (!el) return;
    setSel((prev) =>
      prev.start === el.selectionStart && prev.end === el.selectionEnd ? prev : { start: el.selectionStart, end: el.selectionEnd },
    );
  };

  const onInput = (value: string) => {
    history.current.record({ text: textRef.current, start: sel.start, end: sel.end }, value);
    setText(value);
    textRef.current = value;
    saver.current!.schedule(value);
    readSelection();
  };

  // --- Aktionen ---------------------------------------------------------

  const togglePin = useCallback(async () => {
    const id = saver.current!.id;
    if (!id || !note) return;
    try {
      const updated = await api.noteSetPinned(id, !note.pinned);
      setNote(updated);
      onChanged();
      toast.show({ message: updated.pinned ? "Angeheftet" : "Nicht mehr angeheftet" });
    } catch (error) {
      toast.show({ message: errorText(error), tone: "error" });
    }
  }, [note, onChanged, toast]);

  const moveToTrash = useCallback(async () => {
    setMoreOpen(false);
    const current = saver.current!;
    if (!current.id) {
      onBack();
      return;
    }
    await current.flush();
    const id = current.id;
    try {
      await api.noteDelete(id);
      onChanged();
      onBack();
      toast.show({
        message: "In den Papierkorb verschoben",
        undo: () =>
          void api.noteRestore(id).then(onChanged, (error) => toast.show({ message: errorText(error), tone: "error" })),
      });
    } catch (error) {
      toast.show({ message: errorText(error), tone: "error" });
    }
  }, [onBack, onChanged, toast]);

  const duplicate = useCallback(async () => {
    setMoreOpen(false);
    if (!textRef.current.trim()) return;
    try {
      const copy = await api.noteCreate(textRef.current, "app");
      onChanged();
      onOpen(copy.id);
      toast.show({ message: "Notiz dupliziert" });
    } catch (error) {
      toast.show({ message: errorText(error), tone: "error" });
    }
  }, [onChanged, onOpen, toast]);

  const copyText = useCallback(async () => {
    setMoreOpen(false);
    try {
      await navigator.clipboard.writeText(textRef.current);
      toast.show({ message: "Text kopiert" });
    } catch {
      toast.show({ message: "Kopieren nicht möglich", tone: "error" });
    }
  }, [toast]);

  const restore = useCallback(async () => {
    if (!note) return;
    try {
      await api.noteRestore(note.id);
      setNote({ ...note, deletedAt: null });
      onChanged();
      toast.show({ message: "Wiederhergestellt" });
    } catch (error) {
      toast.show({ message: errorText(error), tone: "error" });
    }
  }, [note, onChanged, toast]);

  const deleteForever = useCallback(async () => {
    if (!note) return;
    setConfirmForever(false);
    try {
      await api.noteDeleteForever(note.id);
      onChanged();
      onBack();
      toast.show({ message: "Endgültig gelöscht" });
    } catch (error) {
      toast.show({ message: errorText(error), tone: "error" });
    }
  }, [note, onBack, onChanged, toast]);

  // Editor-Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const mod = modKey(e);
      const key = e.key.toLowerCase();
      if (mod && e.shiftKey && key === "p") {
        e.preventDefault();
        void togglePin();
      } else if (mod && e.shiftKey && e.key === "Backspace") {
        e.preventDefault();
        if (!readOnly) void moveToTrash();
      } else if (mod && !e.shiftKey && key === "d") {
        e.preventDefault();
        void duplicate();
      } else if (mod && key === "z" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (!isMac && mod && key === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape" && !moreOpen && !confirmForever) {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePin, moveToTrash, duplicate, undo, redo, onBack, readOnly, moreOpen, confirmForever]);

  // Markierung verfolgen (auch Tastatur/programmatisch)
  useEffect(() => {
    const onChange = () => {
      if (document.activeElement === area.current) readSelection();
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

  // Undo/Redo aus dem nativen Bearbeiten-Menü ebenfalls über den eigenen Verlauf
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
        e.preventDefault();
        if (e.inputType === "historyUndo") undo();
        else redo();
      }
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, [loaded, preview === null, undo, redo]);

  // --- KI-Menü ----------------------------------------------------------

  const hasSelection = sel.end > sel.start && !readOnly && !preview;

  useEffect(() => {
    if (!hasSelection) {
      setMenuOpen(false);
      return;
    }
    const gone = dismissed.current;
    if (gone && gone.start === sel.start && gone.end === sel.end) return;
    dismissed.current = null;
    if (!dragging.current) setMenuOpen(true);
  }, [hasSelection, sel.start, sel.end]);

  useEffect(() => {
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      const el = area.current;
      if (el && el.selectionEnd > el.selectionStart && !readOnly) {
        dismissed.current = null;
        setSel({ start: el.selectionStart, end: el.selectionEnd });
        setMenuOpen(true);
      }
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [readOnly]);

  useEffect(() => {
    if (menuOpen) {
      setMenuActive(0);
      setInstruction("");
    }
  }, [menuOpen]);

  // Menü direkt unter der Markierung
  useLayoutEffect(() => {
    if (!menuOpen || !column.current) return;
    const mark = column.current.querySelector<HTMLElement>("[data-sel]");
    if (!mark) return;
    const rects = [...mark.getClientRects()].filter((rect) => rect.width > 0);
    if (rects.length === 0) return;
    const box = column.current.getBoundingClientRect();
    const last = rects[rects.length - 1];
    const left = Math.min(rects[0].left - box.left, Math.max(0, box.width - 472));
    setMenuPos({ left: Math.max(0, left), top: last.bottom - box.top + 10 });
  }, [menuOpen, sel.start, sel.end, text]);

  useEffect(() => {
    if (!menuOpen) return;
    requestAnimationFrame(() =>
      column.current?.querySelector('[role="menu"]')?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  }, [menuOpen]);

  const closeMenu = () => {
    dismissed.current = { ...sel };
    setMenuOpen(false);
  };

  // --- KI-Vorschau ------------------------------------------------------

  const start = useCallback((command: AiCommand, range: { start: number; end: number }, custom?: string) => {
    request.current?.cancel();
    const original = textRef.current.slice(range.start, range.end);
    setMenuOpen(false);
    setPreview({ command, instruction: custom, ...range, mode: "changes", state: { status: "loading", original, result: "" } });
    const update = (state: Partial<PreviewState>) =>
      setPreview((current) => current && { ...current, state: { ...current.state, ...state } });
    request.current = runAi((id) => api.aiTransform(id, command, original, custom), {
      chunk: (result) => update({ status: "streaming", result }),
      done: (result) => update({ status: "done", result }),
      error: (message) => update({ status: "error", error: message }),
    });
  }, []);

  const runCommand = (command: AiCommand, custom?: string) => {
    if (command === "custom" && !custom?.trim()) return;
    start(command, { ...sel }, custom?.trim());
  };

  const discard = useCallback(() => {
    request.current?.cancel();
    request.current = null;
    setPreview((current) => {
      if (current) {
        dismissed.current = { start: current.start, end: current.end };
        pendingSelection.current = { start: current.start, end: current.end };
      }
      return null;
    });
  }, []);

  const accept = useCallback(() => {
    if (!preview || preview.state.status !== "done") return;
    const { start: from, end: to, state, command } = preview;
    const current = textRef.current;
    history.current.checkpoint({ text: current, start: from, end: to });
    const next = current.slice(0, from) + state.result + current.slice(to);
    request.current = null;
    setPreview(null);
    applyState({ text: next, start: from + state.result.length, end: from + state.result.length });
    toast.show({ message: `„${commandLabel(command)}“ übernommen`, undo: () => undo() });
  }, [preview, applyState, toast, undo]);

  const regenerate = useCallback(() => {
    if (preview) start(preview.command, { start: preview.start, end: preview.end }, preview.instruction);
  }, [preview, start]);

  useEffect(() => {
    if (!preview) return;
    const onKey = previewKeyHandler(accept, discard);
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [preview, accept, discard]);

  // Fokus auf „Annehmen“, sobald das Ergebnis da ist
  useEffect(() => {
    if (preview?.state.status === "done") column.current?.querySelector<HTMLButtonElement>("[data-accept]")?.focus({ preventScroll: true });
  }, [preview?.state.status]);

  useEffect(() => () => request.current?.cancel(), []);

  const diffParts = useMemo(
    () => (preview?.state.status === "done" ? diffWords(preview.state.original, preview.state.result) : []),
    [preview?.state.status, preview?.state.original, preview?.state.result],
  );

  const onAreaKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!menuOpen || e.nativeEvent.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    const index = AI_COMMANDS.findIndex((item) => item.key === e.key);
    if (index !== -1) {
      e.preventDefault();
      runCommand(AI_COMMANDS[index].command);
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !e.shiftKey) {
      e.preventDefault();
      const next = Math.max(0, Math.min(3, menuActive + (e.key === "ArrowDown" ? 1 : -1)));
      setMenuActive(next);
      if (next === 3) instructionInput.current?.focus();
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      setMenuActive(3);
      instructionInput.current?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (menuActive === 3) instructionInput.current?.focus();
      else runCommand(AI_COMMANDS[menuActive].command);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    }
  };

  const onInstructionKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      runCommand("custom", instruction);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
      area.current?.focus();
    } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setMenuActive(2);
      area.current?.focus();
    }
  };

  const words = sel.end > sel.start && !preview ? wordCount(text.slice(sel.start, sel.end)) : 0;
  const meta = note ? formatRelative(note.createdAt) : "Neue Notiz";
  const statusText = readOnly ? "Im Papierkorb" : note || status !== "saved" ? STATUS_TEXT[status] : "Noch leer";

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[5.6rem] shrink-0 items-center gap-[1.1rem] pr-[2rem] pl-[1.75rem]">
        <button
          type="button"
          onClick={onBack}
          title={`Zurück (${kbd("esc")})`}
          className="flex h-[2.75rem] items-center gap-[0.6rem] rounded-full bg-hover px-[1.1rem] text-body text-text transition-colors hover:bg-border"
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
          {backLabel}
        </button>
        <span className="truncate text-body text-muted">
          {meta} ·{" "}
          {status === "error" ? (
            <button type="button" className="text-del underline-offset-2 hover:underline" onClick={() => void saver.current!.flush()}>
              {STATUS_TEXT.error} – erneut versuchen
            </button>
          ) : (
            statusText
          )}
        </span>
        <div className="ml-auto flex items-center gap-[0.6rem]">
          {readOnly ? (
            <>
              <Button onClick={restore}>
                <RotateCcw size={16} strokeWidth={1.75} /> Wiederherstellen
              </Button>
              <Button variant="ghost" className="text-del hover:text-del" onClick={() => setConfirmForever(true)}>
                Endgültig löschen
              </Button>
            </>
          ) : (
            <>
              <IconButton
                label={`${note?.pinned ? "Lösen" : "Anheften"} (${kbd("mod", "shift", "P")})`}
                active={note?.pinned}
                disabled={!note}
                onClick={togglePin}
              >
                <Pin size={18} strokeWidth={1.5} fill={note?.pinned ? "currentColor" : "none"} />
              </IconButton>
              <IconButton label="Seitenleiste ein/aus" active={contextOpen} onClick={() => setContextOpen((open) => !open)}>
                <PanelRight size={18} strokeWidth={1.5} />
              </IconButton>
              <div className="relative">
                <IconButton label="Mehr" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
                  <Ellipsis size={18} strokeWidth={1.5} />
                </IconButton>
                {moreOpen && (
                  <MoreMenu
                    onClose={() => setMoreOpen(false)}
                    items={[
                      { label: "Duplizieren", icon: CopyPlus, shortcut: kbd("mod", "D"), run: duplicate, disabled: !text.trim() },
                      { label: "Text kopieren", icon: Copy, run: copyText },
                      { label: "In den Papierkorb", icon: Trash2, shortcut: kbd("mod", "shift", "backspace"), run: moveToTrash, danger: true },
                    ]}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto" onMouseDown={(e) => {
          // Klick in den leeren Bereich unter dem Text → Cursor ans Ende
          if (e.target === e.currentTarget && area.current && !readOnly) {
            e.preventDefault();
            area.current.focus();
            area.current.setSelectionRange(text.length, text.length);
          }
        }}>
          <div className="mx-auto max-w-[61.25rem] px-[2.5rem] pt-[2.4rem] pb-[12rem]">
            {loaded && !preview && (
              <div ref={column} className="relative grid text-editor">
                {/* Spiegel: gleiche Typografie, zeigt die Markierung, wenn der Fokus woanders ist */}
                <div
                  aria-hidden
                  className="pointer-events-none col-start-1 row-start-1 break-words whitespace-pre-wrap text-transparent"
                >
                  {text.slice(0, sel.start)}
                  <span data-sel className={cx(sel.end > sel.start && (!focused || menuOpen) && "sel")}>
                    {text.slice(sel.start, sel.end)}
                  </span>
                  {text.slice(sel.end)}
                  {"\u200b"}
                </div>
                <textarea
                  ref={area}
                  value={text}
                  readOnly={readOnly}
                  aria-label="Notiz"
                  placeholder="Einfach losschreiben …"
                  spellCheck
                  onChange={(e) => onInput(e.target.value)}
                  onSelect={readSelection}
                  onKeyDown={onAreaKeyDown}
                  onMouseDown={() => {
                    dragging.current = true;
                    setMenuOpen(false);
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className={cx(
                    "col-start-1 row-start-1 h-full resize-none overflow-hidden bg-transparent break-words whitespace-pre-wrap text-text caret-text outline-none",
                    menuOpen && "selection:bg-transparent",
                  )}
                />
                {menuOpen && (
                  <AiMenu
                    ref={instructionInput}
                    style={menuPos}
                    active={menuActive}
                    onActive={setMenuActive}
                    onRun={runCommand}
                    instruction={instruction}
                    onInstruction={setInstruction}
                    onInputKeyDown={onInstructionKeyDown}
                  />
                )}
              </div>
            )}
            {loaded && preview && (
              <div ref={column} className="text-editor">
                <div className="break-words whitespace-pre-wrap opacity-45">{text.slice(0, preview.start).replace(/\n$/, "")}</div>
                <div
                  aria-live="polite"
                  className="-mx-[1.6rem] my-[0.6rem] rounded-[16px] border border-border px-[1.6rem] py-[0.9rem] break-words whitespace-pre-wrap"
                >
                  <PreviewBody state={preview.state} mode={preview.mode} parts={diffParts} />
                </div>
                <div className="-mx-[1.2rem] mb-[1.4rem]">
                  <PreviewPanel
                    title={`Vorschau: ${commandLabel(preview.command)}`}
                    subtitle={`${changeCount(diffParts) || "Keine"} ${changeCount(diffParts) === 1 ? "Änderung" : "Änderungen"} · nur die Markierung`}
                    state={preview.state}
                    mode={preview.mode}
                    onMode={(mode) => setPreview((current) => current && { ...current, mode })}
                    onRegenerate={regenerate}
                    onDiscard={discard}
                    onAccept={accept}
                    onOpenSettings={onOpenSettings}
                  />
                </div>
                <div className="break-words whitespace-pre-wrap opacity-45">{text.slice(preview.end).replace(/^\n/, "")}</div>
                <div className="mt-[4rem]">
                  <DiffLegend />
                </div>
              </div>
            )}
          </div>
        </div>
        {contextOpen && (
          <aside className="w-[20rem] shrink-0 border-l border-border px-[1.5rem] pt-[1rem] text-meta text-muted">
            Kontext (Personen, Themen, Aufgaben) folgt später.
          </aside>
        )}
      </div>

      {words > 0 && (
        <div className="pointer-events-none absolute right-[2.4rem] bottom-[1.4rem] flex gap-[1.5rem] text-meta text-muted">
          <span>
            {words} {words === 1 ? "Wort" : "Wörter"} markiert
          </span>
          {menuOpen && <span>{kbd("esc")} schliesst</span>}
        </div>
      )}

      <ConfirmDialog
        open={confirmForever}
        title="Endgültig löschen?"
        message="Die Notiz wird unwiderruflich gelöscht."
        confirmLabel="Endgültig löschen"
        onConfirm={deleteForever}
        onCancel={() => setConfirmForever(false)}
      />
    </div>
  );
}

interface MenuItem {
  label: string;
  icon: typeof Copy;
  shortcut?: string;
  run: () => void;
  danger?: boolean;
  disabled?: boolean;
}

function MoreMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="appear absolute top-[2.75rem] right-0 z-30 w-[17rem] rounded-control border border-border bg-float p-[0.35rem] shadow-float"
    >
      {items.map(({ label, icon: Icon, shortcut, run, danger, disabled }) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={run}
          className={cx(
            "flex h-[2.5rem] w-full items-center gap-[0.75rem] rounded-small px-[0.75rem] text-left text-[1rem] outline-none hover:bg-hover focus:bg-hover disabled:opacity-40",
            danger ? "text-del" : "text-text",
          )}
        >
          <Icon size={16} strokeWidth={1.5} className={danger ? "" : "text-muted"} />
          <span className="flex-1">{label}</span>
          {shortcut && <span className="text-badge text-muted">{shortcut}</span>}
        </button>
      ))}
    </div>
  );
}
