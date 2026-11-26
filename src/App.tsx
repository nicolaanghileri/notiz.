import { useCallback, useEffect, useState } from "react";
import { Editor } from "./components/Editor";
import { NotesView } from "./components/NotesView";
import { SearchView } from "./components/SearchView";
import { FILTER_LABELS, Sidebar } from "./components/Sidebar";
import { ToastProvider, errorText, useToast } from "./components/Toast";
import * as api from "./lib/api";
import { modKey } from "./lib/platform";
import { cx } from "./components/ui";
import { applyTheme } from "./lib/theme";
import type { Filter, Note, NoteCounts } from "./lib/types";

export type View =
  | { kind: "notes"; filter: Filter }
  | { kind: "editor"; id: string | null; back: Filter | "search"; session: number }
  | { kind: "search" };

let sessionCounter = 0;
/** Jede geöffnete Notiz bekommt einen eigenen Editor (key), auch wenn eine neue Notiz später ihre ID erhält */
const nextSession = () => ++sessionCounter;

const FILTER_SHORTCUTS: Filter[] = ["all", "today", "last7", "quick", "pinned"];

function useNotes(filter: Filter | null, version: number) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (!filter) return;
    let alive = true;
    api
      .notesList(filter)
      .then((list) => alive && setNotes(list))
      .catch((error) => toast.show({ message: errorText(error), tone: "error" }));
    return () => {
      alive = false;
    };
  }, [filter, version, toast]);
  // Beim Filterwechsel nicht kurz die alte Liste zeigen
  const [shownFilter, setShownFilter] = useState(filter);
  if (shownFilter !== filter) {
    setShownFilter(filter);
    setNotes(null);
  }
  return notes;
}

function Shell() {
  const [view, setView] = useState<View>({ kind: "notes", filter: "all" });
  const [lastFilter, setLastFilter] = useState<Filter>("all");
  const [version, setVersion] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  void settingsOpen;
  const [counts, setCounts] = useState<NoteCounts | null>(null);
  const toast = useToast();

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const listFilter = view.kind === "notes" ? view.filter : null;
  const notes = useNotes(listFilter, version);

  useEffect(() => {
    api.notesCounts().then(setCounts, () => {});
  }, [version]);

  useEffect(() => {
    api.settingsGet().then((settings) => applyTheme(settings.theme), () => {});
    const off = api.onNotesChanged(bump);
    return () => void off.then((unlisten) => unlisten());
  }, [bump]);

  const showFilter = useCallback((filter: Filter) => {
    setLastFilter(filter);
    setView({ kind: "notes", filter });
  }, []);

  const newNote = useCallback(() => {
    setView((current) => ({
      kind: "editor",
      id: null,
      session: nextSession(),
      back: current.kind === "notes" ? current.filter : current.kind === "search" ? "search" : current.back,
    }));
  }, []);

  const openNote = useCallback((note: Note, back: Filter | "search") => {
    setView({ kind: "editor", id: note.id, back, session: nextSession() });
  }, []);

  // Globale Shortcuts (BRIEF Abschnitt 9)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || !modKey(e) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        newNote();
      } else if (key === "k" && !e.shiftKey) {
        e.preventDefault();
        setView({ kind: "search" });
      } else if (!e.shiftKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        showFilter(FILTER_SHORTCUTS[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newNote, showFilter]);

  // ⌘Z ausserhalb von Textfeldern: Rückgängig des sichtbaren Toasts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !modKey(e) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea")) return;
      if (toast.undo()) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toast]);

  const goBack = useCallback(() => {
    setView((current) => {
      if (current.kind !== "editor") return current;
      return current.back === "search" ? { kind: "search" } : { kind: "notes", filter: current.back };
    });
  }, []);

  const searchMounted = view.kind === "search" || (view.kind === "editor" && view.back === "search");
  const active = view.kind === "notes" ? view.filter : view.kind === "search" ? "search" : view.back === "search" ? "search" : view.back;

  return (
    <div className="flex h-full p-[0.75rem] pl-0">
      <Sidebar
        active={active}
        counts={counts}
        onFilter={showFilter}
        onNew={newNote}
        onSearch={() => setView({ kind: "search" })}
        onSettings={() => setSettingsOpen(true)}
      />
      <main className="relative min-w-0 flex-1 overflow-hidden rounded-panel border border-border bg-panel">
        {view.kind === "notes" && (
          <NotesView
            filter={view.filter}
            notes={notes}
            onNew={newNote}
            onOpen={(note) => openNote(note, view.filter)}
          />
        )}
        {view.kind === "editor" && (
          <Editor
            onOpenSettings={() => setSettingsOpen(true)}
            key={view.session}
            noteId={view.id}
            backLabel={view.back === "search" ? "Suche" : FILTER_LABELS[view.back]}
            onBack={goBack}
            onChanged={bump}
            onCreated={(id) => setView((current) => (current.kind === "editor" ? { ...current, id } : current))}
            onOpen={(id) =>
              setView((current) => ({ kind: "editor", id, back: current.kind === "editor" ? current.back : "all", session: nextSession() }))
            }
          />
        )}
        {searchMounted && (
          <div className={cx("h-full", view.kind !== "search" && "hidden")}>
            <SearchView
              active={view.kind === "search"}
              onOpen={(note) => openNote(note, "search")}
              onClose={() => showFilter(lastFilter)}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
