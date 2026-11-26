import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { dayKey, formatDayHeading, startOfWeek } from "../lib/dates";
import { kbd, modKey } from "../lib/platform";
import type { AiCommand } from "../lib/types";
import { AI_COMMANDS } from "./ai";
import { SelectionBar, SummarizeDialog, TransformDialog } from "./Batch";
import type { Filter, Note } from "../lib/types";
import { NewNoteCard, NoteCard, NoteRow, type CardHandlers } from "./NoteCard";
import { FILTER_LABELS } from "./Sidebar";
import { Segmented } from "./ui";

export type Layout = "cards" | "list";
const LAYOUT_KEY = "notiz.layout";

interface Group {
  key: string;
  label: string;
  notes: Note[];
}

function groupByWeek(notes: Note[]): Group[] {
  const week = startOfWeek().getTime();
  const thisWeek = notes.filter((note) => new Date(note.createdAt).getTime() >= week);
  const earlier = notes.filter((note) => new Date(note.createdAt).getTime() < week);
  return [
    { key: "week", label: "Diese Woche", notes: thisWeek },
    { key: "earlier", label: "Früher", notes: earlier },
  ];
}

function groupByDay(notes: Note[]): Group[] {
  const groups: Group[] = [];
  for (const note of notes) {
    const key = String(dayKey(note.createdAt));
    const last = groups[groups.length - 1];
    if (last?.key === key) last.notes.push(note);
    else groups.push({ key, label: formatDayHeading(note.createdAt), notes: [note] });
  }
  return groups;
}

/** Pfeiltasten im Karten-Grid: nächste Karte in der Richtung nach Position */
function moveFocus(e: KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  if (!keys.includes(e.key) || e.altKey || e.metaKey || e.ctrlKey) return;
  const current = (e.target as HTMLElement).closest<HTMLElement>("[data-note-id],[data-new-card]");
  if (!current) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-note-id],[data-new-card] > button")];
  const from = current.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const item of items) {
    const target = item.closest<HTMLElement>("[data-note-id],[data-new-card]")!;
    if (target === current) continue;
    const r = target.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (from.left + from.width / 2);
    const dy = r.top + r.height / 2 - (from.top + from.height / 2);
    const forward =
      e.key === "ArrowRight" ? dx > 1 && Math.abs(dy) < r.height / 2 :
      e.key === "ArrowLeft" ? dx < -1 && Math.abs(dy) < r.height / 2 :
      e.key === "ArrowDown" ? dy > 1 : dy < -1;
    if (!forward) continue;
    const score = e.key === "ArrowLeft" || e.key === "ArrowRight" ? Math.abs(dx) : Math.abs(dy) * 4 + Math.abs(dx);
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (best) {
    e.preventDefault();
    best.focus();
    best.scrollIntoView({ block: "nearest" });
  }
}

export function NotesView({
  filter,
  notes,
  onOpen,
  onNew,
  onChanged,
}: {
  filter: Filter;
  notes: Note[] | null;
  onOpen: (note: Note) => void;
  onNew: () => void;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const [batch, setBatch] = useState<{ command: AiCommand; instruction?: string; notes: Note[] } | null>(null);
  const selectable = filter !== "trash";
  const selecting = selected.size > 0;

  const [layout, setLayout] = useState<Layout>(() =>
    localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "cards",
  );
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setSelected(new Set());
    anchor.current = null;
  }, [filter]);

  // Nicht mehr vorhandene Notizen aus der Auswahl entfernen
  useEffect(() => {
    if (!notes) return;
    const ids = new Set(notes.map((note) => note.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [notes]);

  const changeLayout = (value: Layout) => {
    setLayout(value);
    localStorage.setItem(LAYOUT_KEY, value);
  };

  const showNewCard = (filter === "all" || filter === "today" || filter === "last7") && !selecting;
  const groups = useMemo(() => {
    if (!notes) return [];
    if (layout === "list") return groupByDay(notes);
    const grouped = groupByWeek(notes);
    return grouped.filter((group) => group.notes.length > 0 || (showNewCard && group.key === "week"));
  }, [notes, layout, showNewCard]);

  /** Angezeigte Reihenfolge, für ⇧-Klick-Bereiche */
  const ordered = useMemo(() => groups.flatMap((group) => group.notes), [groups]);

  const toggle = (note: Note) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(note.id)) next.delete(note.id);
      else next.add(note.id);
      return next;
    });
    anchor.current = note.id;
  };

  const selectRange = (note: Note) => {
    const from = ordered.findIndex((n) => n.id === anchor.current);
    const to = ordered.findIndex((n) => n.id === note.id);
    if (from === -1) return toggle(note);
    const [a, b] = from < to ? [from, to] : [to, from];
    setSelected((current) => new Set([...current, ...ordered.slice(a, b + 1).map((n) => n.id)]));
  };

  const handlers: CardHandlers = {
    onActivate: (note, e: MouseEvent | KeyboardEvent) => {
      if (selectable && e.shiftKey) {
        e.preventDefault();
        selectRange(note);
      } else if (selectable && (modKey(e) || (selecting && e.type === "click"))) {
        toggle(note);
      } else if (!modKey(e)) {
        onOpen(note);
      }
    },
    onToggle: selectable ? (note, e) => (e.shiftKey ? selectRange(note) : toggle(note)) : undefined,
  };

  const clear = () => {
    setSelected(new Set());
    anchor.current = null;
  };

  const run = (command: AiCommand, instruction?: string) => {
    const chosen = ordered.filter((note) => selected.has(note.id));
    if (chosen.length) setBatch({ command, instruction, notes: chosen });
  };

  // esc hebt die Auswahl auf, 1/2/3 starten einen KI-Befehl
  useEffect(() => {
    if (!selecting || batch) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      if ((e.target as HTMLElement).matches("input, textarea")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        clear();
      }
      const item = AI_COMMANDS.find(({ key }) => key === e.key);
      if (item) {
        e.preventDefault();
        run(item.command);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const empty = notes !== null && notes.length === 0 && !(showNewCard && layout === "cards");

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-[1rem] px-[3.1rem] pt-[2.4rem] pb-[0.6rem]">
        <h1 className="truncate text-title font-semibold tracking-[-0.015em]">{FILTER_LABELS[filter]}</h1>
        {selecting ? (
          <span className="text-label text-muted">
            {kbd("mod")}-Klick oder {kbd("shift")}-Klick wählt mehrere
          </span>
        ) : (
        <div className="flex items-center gap-[1.2rem]">
          <span className="text-label text-muted">Neueste zuerst</span>
          <Segmented
            label="Ansicht"
            value={layout}
            onChange={changeLayout}
            options={[
              { value: "cards", label: "Karten" },
              { value: "list", label: "Liste" },
            ]}
          />
        </div>
        )}
      </header>

      <div ref={scroller} className="@container min-h-0 flex-1 overflow-y-auto px-[3.1rem] pb-[7rem]" onKeyDown={moveFocus}>
        {empty && (
          <p className="pt-[3rem] text-body text-muted">
            {filter === "trash" ? "Der Papierkorb ist leer." : "Hier gibt es noch keine Notizen."}
          </p>
        )}
        {groups.map((group, index) => (
          <section key={group.key} aria-label={group.label}>
            <h2 className="pt-[1.6rem] pb-[1.1rem] pl-[0.3rem] text-meta font-medium text-muted">{group.label}</h2>
            {layout === "cards" ? (
              <div className="grid grid-cols-1 gap-[1.25rem] @min-[34rem]:grid-cols-2 @min-[54rem]:grid-cols-3 @min-[76rem]:grid-cols-4">
                {showNewCard && index === 0 && (
                  <div data-new-card className="grid">
                    <NewNoteCard onClick={onNew} />
                  </div>
                )}
                {group.notes.map((note) => (
                  <NoteCard key={note.id} note={note} selected={selected.has(note.id)} selecting={selecting} handlers={handlers} />
                ))}
              </div>
            ) : (
              <div className="mx-auto flex max-w-[68.75rem] flex-col gap-[0.8rem]">
                {group.notes.map((note) => (
                  <NoteRow key={note.id} note={note} selected={selected.has(note.id)} selecting={selecting} handlers={handlers} />
                ))}
              </div>
            )}
          </section>
        ))}
        {notes === null && <p className="pt-[3rem] text-body text-muted">Lädt …</p>}
      </div>

      {selecting && !batch && <SelectionBar count={selected.size} onRun={run} onClear={clear} />}
      {batch?.command === "summarize" && (
        <SummarizeDialog
          notes={batch.notes}
          onClose={() => setBatch(null)}
          onCreated={() => {
            setBatch(null);
            clear();
            onChanged();
          }}
        />
      )}
      {batch && batch.command !== "summarize" && (
        <TransformDialog
          notes={batch.notes}
          command={batch.command}
          instruction={batch.instruction}
          onClose={() => {
            setBatch(null);
            clear();
          }}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
