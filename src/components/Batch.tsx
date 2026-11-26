import { CornerDownLeft, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../lib/api";
import { runAi, type AiRequest } from "../lib/ai";
import { changeCount, diffWords } from "../lib/diff";
import { deriveTitle } from "../lib/noteText";
import type { AiCommand, Note } from "../lib/types";
import { AI_COMMANDS, commandLabel, DiffLegend, PreviewBody, PreviewPanel, previewKeyHandler, type PreviewMode, type PreviewState } from "./ai";
import { errorText, useToast } from "./Toast";
import { Button, cx, Kbd } from "./ui";

// --- Schwebende Aktionsleiste (Screen 6) -----------------------------------

export function SelectionBar({
  count,
  onRun,
  onClear,
}: {
  count: number;
  onRun: (command: AiCommand, instruction?: string) => void;
  onClear: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  return (
    <div
      role="toolbar"
      aria-label="Aktionen für die Auswahl"
      className="appear absolute bottom-[2rem] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[0.35rem] rounded-full border border-border bg-float py-[0.45rem] pr-[0.6rem] pl-[1.6rem] text-body whitespace-nowrap shadow-float"
    >
      <span className="pr-[0.9rem] text-text">{count} ausgewählt</span>
      <span className="mr-[0.4rem] h-[1.6rem] border-l border-border" />
      {AI_COMMANDS.map(({ command, label, icon: Icon, key }) => (
        <button
          key={command}
          type="button"
          onClick={() => onRun(command)}
          className="flex h-[2.8rem] items-center gap-[0.65rem] rounded-full px-[1rem] text-text hover:bg-hover"
        >
          <Icon size={17} strokeWidth={1.5} className="text-muted" />
          {label}
          <Kbd>{key}</Kbd>
        </button>
      ))}
      <label className="ml-[0.3rem] flex h-[2.9rem] w-[18rem] items-center gap-[0.5rem] rounded-full bg-hover px-[1.1rem]">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" && instruction.trim()) {
              e.preventDefault();
              onRun("custom", instruction.trim());
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Eigene Anweisung …"
          aria-label="Eigene Anweisung"
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
        <CornerDownLeft size={15} strokeWidth={1.5} className="shrink-0 text-muted" />
      </label>
      <button
        type="button"
        aria-label="Auswahl aufheben"
        title="Auswahl aufheben (esc)"
        onClick={onClear}
        className="ml-[0.2rem] flex size-[2.6rem] items-center justify-center rounded-full text-muted hover:bg-hover hover:text-text"
      >
        <X size={18} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function Overlay({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="dialog" aria-modal aria-label={label} className="absolute inset-0 z-30 overflow-y-auto bg-panel/85 backdrop-blur-[2px]">
      <div className="mx-auto max-w-[56rem] px-[2rem] pt-[4rem] pb-[6rem]">{children}</div>
    </div>
  );
}

// --- Zusammenfassen: neue Notiz aus mehreren --------------------------------

export function SummarizeDialog({
  notes,
  onClose,
  onCreated,
}: {
  notes: Note[];
  onClose: () => void;
  onCreated: (note: Note) => void;
}) {
  const toast = useToast();
  const [state, setState] = useState<PreviewState>({ status: "loading", original: "", result: "" });
  const request = useRef<AiRequest<void> | null>(null);

  const start = useCallback(() => {
    request.current?.cancel();
    setState({ status: "loading", original: "", result: "" });
    request.current = runAi((id) => api.aiSummarizeNotes(id, notes.map((note) => note.id)), {
      chunk: (result) => setState((s) => ({ ...s, status: "streaming", result })),
      done: (result) => setState((s) => ({ ...s, status: "done", result })),
      error: (message) => setState((s) => ({ ...s, status: "error", error: message })),
    });
  }, [notes]);

  useEffect(() => {
    start();
    return () => request.current?.cancel();
  }, [start]);

  const discard = useCallback(() => {
    request.current?.cancel();
    onClose();
  }, [onClose]);

  const accept = useCallback(async () => {
    if (state.status !== "done") return;
    try {
      const note = await api.noteCreate(state.result, "app");
      onCreated(note);
      toast.show({
        message: "Neue Notiz erstellt",
        undo: () => void api.noteDeleteForever(note.id).then(() => onCreated(note), (e) => toast.show({ message: errorText(e), tone: "error" })),
      });
    } catch (error) {
      toast.show({ message: errorText(error), tone: "error" });
    }
  }, [state, onCreated, toast]);

  useEffect(() => {
    const onKey = previewKeyHandler(() => void accept(), discard);
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [accept, discard]);

  return (
    <Overlay label="Vorschau: Zusammenfassen">
      <p className="mb-[0.8rem] text-meta text-muted">
        Aus {notes.length} Notizen: {notes.map((note) => deriveTitle(note.text).title.replace(/[.:]$/, "")).join(" · ")}
      </p>
      <div className="mb-[1rem] min-h-[8rem] rounded-[16px] border border-border bg-card px-[1.6rem] py-[1.2rem] text-editor break-words whitespace-pre-wrap" aria-live="polite">
        {state.status === "loading" ? (
          <span className="thinking text-muted">Fasst zusammen …</span>
        ) : (
          <PreviewBody state={state} mode="result" parts={[]} />
        )}
      </div>
      <PreviewPanel
        title="Vorschau: Zusammenfassen"
        subtitle="Wird als neue Notiz gespeichert · Originale bleiben"
        state={state}
        mode="result"
        onMode={() => {}}
        showModes={false}
        onRegenerate={start}
        onDiscard={discard}
        onAccept={() => void accept()}
        acceptLabel="Als neue Notiz"
      />
    </Overlay>
  );
}

// --- Verbessern/Korrigieren/Eigene Anweisung: pro Notiz eine Vorschau --------

interface Item {
  note: Note;
  state: PreviewState | null; // null = noch nicht gestartet
  decision: "open" | "accepted" | "discarded";
}

export function TransformDialog({
  notes,
  command,
  instruction,
  onClose,
  onChanged,
}: {
  notes: Note[];
  command: AiCommand;
  instruction?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>(() => notes.map((note) => ({ note, state: null, decision: "open" })));
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<PreviewMode>("changes");
  const requests = useRef(new Map<string, AiRequest<void>>());
  /** Für Rückgängig: Originaltexte der übernommenen Notizen */
  const applied = useRef<{ id: string; text: string }[]>([]);
  const finished = useRef(false);

  const patch = (id: string, change: Partial<Item> | ((item: Item) => Partial<Item>)) =>
    setItems((list) => list.map((item) => (item.note.id === id ? { ...item, ...(typeof change === "function" ? change(item) : change) } : item)));

  const start = useCallback(
    (note: Note) => {
      requests.current.get(note.id)?.cancel();
      const update = (state: Partial<PreviewState>) =>
        patch(note.id, (item) => ({ state: { ...(item.state ?? { status: "loading", original: note.text, result: "" }), ...state } }));
      patch(note.id, { state: { status: "loading", original: note.text, result: "" } });
      requests.current.set(
        note.id,
        runAi((id) => api.aiTransform(id, command, note.text, instruction), {
          chunk: (result) => update({ status: "streaming", result }),
          done: (result) => update({ status: "done", result }),
          error: (message) => update({ status: "error", error: message }),
        }),
      );
    },
    [command, instruction],
  );

  // Nacheinander: die nächste Anfrage startet, wenn die vorige fertig ist
  useEffect(() => {
    const running = items.some((item) => item.state && (item.state.status === "loading" || item.state.status === "streaming"));
    if (running) return;
    const next = items.find((item) => item.state === null && item.decision === "open");
    if (next) start(next.note);
  }, [items, start]);

  useEffect(() => {
    const map = requests.current;
    return () => map.forEach((request) => request.cancel());
  }, []);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    requests.current.forEach((request) => request.cancel());
    const done = applied.current;
    if (done.length > 0) {
      toast.show({
        message: `„${commandLabel(command)}“ auf ${done.length} ${done.length === 1 ? "Notiz" : "Notizen"} übernommen`,
        undo: () =>
          void Promise.all(done.map(({ id, text }) => api.noteUpdate(id, text))).then(onChanged, (e) =>
            toast.show({ message: errorText(e), tone: "error" }),
          ),
      });
    }
    onClose();
  }, [command, onChanged, onClose, toast]);

  const advance = (list: Item[]) => {
    const next = list.findIndex((item) => item.decision === "open");
    if (next === -1) finish();
    else {
      setIndex(next);
      setMode("changes");
    }
  };

  const acceptItems = async (targets: Item[]) => {
    const results = await Promise.allSettled(
      targets.map(async (item) => {
        await api.noteUpdate(item.note.id, item.state!.result);
        applied.current.push({ id: item.note.id, text: item.note.text });
        return item.note.id;
      }),
    );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) toast.show({ message: errorText((failed[0] as PromiseRejectedResult).reason), tone: "error" });
    onChanged();
    const ok = new Set(results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])));
    const list = items.map((item) => (ok.has(item.note.id) ? { ...item, decision: "accepted" as const } : item));
    setItems(list);
    advance(list);
  };

  const current = items[index];
  const accept = () => {
    if (current?.state?.status === "done" && current.decision === "open") void acceptItems([current]);
  };
  const discard = () => {
    if (!current) return;
    requests.current.get(current.note.id)?.cancel();
    const list = items.map((item, k) => (k === index ? { ...item, decision: "discarded" as const } : item));
    setItems(list);
    advance(list);
  };
  const open = items.filter((item) => item.decision === "open");
  const allReady = open.length > 0 && open.every((item) => item.state?.status === "done");
  const acceptAll = () => {
    if (allReady) void acceptItems(open);
  };

  const keys = useRef({ accept, discard });
  keys.current = { accept, discard };
  useEffect(() => {
    const onKey = previewKeyHandler(() => keys.current.accept(), () => keys.current.discard());
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const parts = useMemo(
    () => (current?.state?.status === "done" ? diffWords(current.state.original, current.state.result) : []),
    [current?.state],
  );

  if (!current) return null;
  const state = current.state ?? { status: "loading" as const, original: current.note.text, result: "" };
  const changes = changeCount(parts);

  return (
    <Overlay label={`Vorschau: ${commandLabel(command)}`}>
      <div className="mb-[0.8rem] flex items-center gap-[0.5rem]">
        {items.map((item, k) => (
          <button
            key={item.note.id}
            type="button"
            disabled={item.decision !== "open"}
            onClick={() => {
              setIndex(k);
              setMode("changes");
            }}
            aria-label={`Notiz ${k + 1}`}
            className={cx(
              "h-[0.5rem] w-[2.2rem] rounded-full transition-colors",
              k === index ? "bg-accent" : item.decision === "accepted" ? "bg-ins" : item.decision === "discarded" ? "bg-border-strong" : "bg-border",
            )}
          />
        ))}
        <span className="ml-[0.6rem] text-meta text-muted">
          Notiz {index + 1} von {items.length}
        </span>
        <button type="button" onClick={finish} className="ml-auto text-meta text-muted hover:text-text">
          Fertig
        </button>
      </div>
      <div className="mb-[1rem] rounded-[16px] border border-border bg-card px-[1.6rem] py-[1.2rem] text-editor break-words whitespace-pre-wrap" aria-live="polite">
        <PreviewBody state={state} mode={mode} parts={parts} />
      </div>
      <PreviewPanel
        title={`Vorschau: ${commandLabel(command)}`}
        subtitle={`${changes || "Keine"} ${changes === 1 ? "Änderung" : "Änderungen"} · ganze Notiz`}
        state={state}
        mode={mode}
        onMode={setMode}
        onRegenerate={() => start(current.note)}
        onDiscard={discard}
        onAccept={accept}
        extra={
          items.length > 1 ? (
            <div className="mt-[0.6rem] text-meta text-muted">
              <Button variant="ghost" className="-ml-[1.1rem] h-[2rem]" disabled={!allReady} onClick={acceptAll}>
                Alle {open.length} annehmen
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="mt-[2rem]">
        <DiffLegend />
      </div>
    </Overlay>
  );
}
