import { Check, Plus } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { formatDayHeading, formatRelative, formatTime } from "../lib/dates";
import { deriveTitle } from "../lib/noteText";
import { kbd } from "../lib/platform";
import type { Note } from "../lib/types";
import { cx } from "./ui";

export interface CardHandlers {
  onActivate: (note: Note, e: MouseEvent | KeyboardEvent) => void;
  onToggle?: (note: Note, e: MouseEvent | KeyboardEvent) => void;
}

function SelectCircle({
  selected,
  visible,
  onClick,
}: {
  selected: boolean;
  visible: boolean;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <span
      role="checkbox"
      aria-checked={selected}
      aria-label="Auswählen"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cx(
        "absolute top-[1.35rem] right-[1.35rem] flex size-[1.65rem] items-center justify-center rounded-full border-[1.5px] transition-opacity",
        selected ? "border-accent bg-accent text-white" : "border-border-strong bg-card",
        visible || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      {selected && <Check size={14} strokeWidth={3} />}
    </span>
  );
}

export function NoteCard({
  note,
  selected,
  selecting,
  handlers,
}: {
  note: Note;
  selected: boolean;
  selecting: boolean;
  handlers: CardHandlers;
}) {
  const { title, preview } = deriveTitle(note.text);
  return (
    <div
      role="button"
      tabIndex={0}
      data-note-id={note.id}
      aria-pressed={handlers.onToggle ? selected : undefined}
      onClick={(e) => handlers.onActivate(note, e)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handlers.onActivate(note, e);
        if (e.key === " " && handlers.onToggle) {
          e.preventDefault();
          handlers.onToggle(note, e);
        }
      }}
      className={cx(
        "group relative flex h-[15.3rem] flex-col rounded-card border p-[1.75rem] text-left transition-colors outline-offset-2",
        selected
          ? "border-accent bg-selected ring-1 ring-accent"
          : "border-border bg-card hover:border-border-strong",
      )}
    >
      {handlers.onToggle && (
        <SelectCircle
          selected={selected}
          visible={selecting}
          onClick={(e) => handlers.onToggle!(note, e)}
        />
      )}
      <h3 className={cx("line-clamp-2 text-card-title font-semibold text-text", handlers.onToggle && "pr-[2rem]")}>
        {title}
      </h3>
      <p className="mt-[0.6rem] line-clamp-3 text-body text-text/90 [overflow-wrap:anywhere]">{preview}</p>
      <time dateTime={note.createdAt} className="mt-auto pt-[0.6rem] text-meta text-muted">
        {formatRelative(note.createdAt)}
      </time>
    </div>
  );
}

export function NewNoteCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-[15.3rem] flex-col rounded-card border-[1.5px] border-dashed border-border-strong p-[1.75rem] text-left transition-colors hover:bg-hover/50"
    >
      <span className="flex size-[2.9rem] items-center justify-center rounded-full bg-hover text-muted transition-colors group-hover:bg-border">
        <Plus size={20} strokeWidth={1.5} />
      </span>
      <span className="mt-auto text-card-title font-medium text-text">Einfach losschreiben</span>
      <span className="mt-[0.2rem] text-meta text-muted">{kbd("mod", "N")} · ohne Titel, ohne Ordner</span>
    </button>
  );
}

/** Ansicht „Liste“, angelehnt an Screen 1B: Uhrzeit links, voller Text rechts */
export function NoteRow({
  note,
  selected,
  selecting,
  handlers,
}: {
  note: Note;
  selected: boolean;
  selecting: boolean;
  handlers: CardHandlers;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-note-id={note.id}
      aria-pressed={handlers.onToggle ? selected : undefined}
      onClick={(e) => handlers.onActivate(note, e)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handlers.onActivate(note, e);
        if (e.key === " " && handlers.onToggle) {
          e.preventDefault();
          handlers.onToggle(note, e);
        }
      }}
      className={cx(
        "group relative flex gap-[2rem] rounded-card border py-[1.6rem] pr-[4rem] pl-[2.6rem] transition-colors",
        selected ? "border-accent bg-selected ring-1 ring-accent" : "border-border bg-card hover:border-border-strong",
      )}
    >
      <time dateTime={note.createdAt} className="w-[3rem] shrink-0 pt-[0.2rem] text-meta text-muted tabular-nums">
        {formatTime(note.createdAt)}
      </time>
      <p className="line-clamp-8 min-w-0 flex-1 text-editor whitespace-pre-line text-text [overflow-wrap:anywhere]">
        {note.text.trim() || <span className="text-muted">Leere Notiz</span>}
      </p>
      {handlers.onToggle && (
        <SelectCircle selected={selected} visible={selecting} onClick={(e) => handlers.onToggle!(note, e)} />
      )}
    </div>
  );
}

export { formatDayHeading };
