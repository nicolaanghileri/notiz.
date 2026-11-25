import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { dayKey, formatDayHeading, startOfWeek } from "../lib/dates";
import { modKey } from "../lib/platform";
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
}: {
  filter: Filter;
  notes: Note[] | null;
  onOpen: (note: Note) => void;
  onNew: () => void;
}) {
  const [layout, setLayout] = useState<Layout>(() =>
    localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "cards",
  );
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [filter]);

  const changeLayout = (value: Layout) => {
    setLayout(value);
    localStorage.setItem(LAYOUT_KEY, value);
  };

  const showNewCard = filter === "all" || filter === "today" || filter === "last7";
  const groups = useMemo(() => {
    if (!notes) return [];
    if (layout === "list") return groupByDay(notes);
    const grouped = groupByWeek(notes);
    return grouped.filter((group) => group.notes.length > 0 || (showNewCard && group.key === "week"));
  }, [notes, layout, showNewCard]);

  const handlers: CardHandlers = {
    onActivate: (note, e: MouseEvent | KeyboardEvent) => {
      if (modKey(e) || e.shiftKey) return;
      onOpen(note);
    },
  };

  const empty = notes !== null && notes.length === 0 && !(showNewCard && layout === "cards");

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-[1rem] px-[3.1rem] pt-[2.4rem] pb-[0.6rem]">
        <h1 className="truncate text-title font-semibold tracking-[-0.015em]">{FILTER_LABELS[filter]}</h1>
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
                  <NoteCard key={note.id} note={note} selected={false} selecting={false} handlers={handlers} />
                ))}
              </div>
            ) : (
              <div className="mx-auto flex max-w-[68.75rem] flex-col gap-[0.8rem]">
                {group.notes.map((note) => (
                  <NoteRow key={note.id} note={note} selected={false} selecting={false} handlers={handlers} />
                ))}
              </div>
            )}
          </section>
        ))}
        {notes === null && <p className="pt-[3rem] text-body text-muted">Lädt …</p>}
      </div>
    </div>
  );
}
