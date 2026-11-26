import { ArrowDown, ArrowUp, CornerDownLeft, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as api from "../lib/api";
import { runAi, type AiRequest } from "../lib/ai";
import { formatFull, formatShort, formatSource } from "../lib/dates";
import { deriveTitle } from "../lib/noteText";
import { kbd } from "../lib/platform";
import type { Note, Range, SearchHit, SearchResult } from "../lib/types";
import { errorText } from "./Toast";
import { cx, Kbd } from "./ui";

const RANGES: { value: Range; label: string }[] = [
  { value: "all", label: "Alle Zeiträume" },
  { value: "lastMonth", label: "Letzter Monat" },
  { value: "thisYear", label: "Dieses Jahr" },
];

interface Answer {
  status: "loading" | "streaming" | "done" | "error";
  text: string;
  sources?: string[];
  error?: string;
}

// --- Hervorhebungen -------------------------------------------------------

/** Zeilenumbruch → „. “ bzw. „ “ (wie joinLines), mit Blick auf den Text davor */
function flattenPiece(full: string, offset: number, piece: string): string {
  return piece.replace(/\s*\n\s*/g, (_match, index: number) => {
    const before = (full.slice(0, offset) + piece.slice(0, index)).trimEnd();
    if (before === "") return "";
    return /[.!?:;,…–-]$/.test(before) ? " " : ". ";
  });
}

export function Highlighted({
  text,
  ranges,
  flat = false,
}: {
  text: string;
  ranges: [number, number][];
  flat?: boolean;
}) {
  const nodes: ReactNode[] = [];
  let pos = 0;
  const sorted = [...ranges].filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const push = (from: number, to: number, mark: boolean) => {
    if (to <= from) return;
    const raw = text.slice(from, to);
    const piece = flat ? flattenPiece(text, from, raw) : raw;
    nodes.push(
      mark ? (
        <mark key={from} className="hl">
          {piece}
        </mark>
      ) : (
        <span key={from}>{piece}</span>
      ),
    );
  };
  for (const [start, end] of sorted) {
    const s = Math.max(start, pos);
    const e = Math.min(end, text.length);
    if (e <= s) continue;
    push(pos, s, false);
    push(s, e, true);
    pos = e;
  }
  push(pos, text.length, false);
  return <>{nodes}</>;
}

/** Antworttext mit Quellen-Badges [1] [2] … */
function AnswerText({ text, streaming, onBadge, count }: { text: string; streaming: boolean; onBadge: (index: number) => void; count: number }) {
  const clean = streaming ? text.replace(/\[\d*$/, "") : text;
  const parts = clean.split(/\s?\[(\d+)\]/);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) return <span key={index}>{part}</span>;
        const n = Number(part);
        if (n < 1 || n > count) return null;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onBadge(n - 1)}
            aria-label={`Quelle ${n}`}
            className="mx-[0.3rem] inline-flex h-[1.5rem] min-w-[1.9rem] translate-y-[-0.1rem] items-center justify-center rounded-full bg-hover px-[0.45rem] align-middle text-badge font-medium text-muted hover:bg-border hover:text-text"
          >
            {n}
          </button>
        );
      })}
      {streaming && <span className="thinking ml-[0.15em] inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-accent" />}
    </>
  );
}

// --- Ansicht --------------------------------------------------------------

export function SearchView({
  active,
  onOpen,
  onClose,
  onOpenSettings,
}: {
  active: boolean;
  onOpen: (note: Note) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [searched, setSearched] = useState<{ query: string; range: Range } | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [answerHidden, setAnswerHidden] = useState(false);
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const request = useRef<AiRequest<SearchResult> | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (active) input.current?.focus();
  }, [active]);

  useEffect(() => () => request.current?.cancel(), []);

  /** Notiztext geht nur bei aktivem Absenden (↵, Filter-Chip) an die Suche → KI (AGENTS.md) */
  const runSearch = useCallback((q: string, r: Range) => {
    const trimmed = q.trim();
    request.current?.cancel();
    request.current = null;
    const gen = ++generation.current;
    setSearched({ query: q, range: r });
    setSelected(0);
    setAnswer(null);
    setAnswerHidden(false);
    setError(null);
    if (!trimmed) {
      setResult(null);
      return;
    }
    setLoading(true);
    let gotResult = false;
    const update = (patch: Partial<Answer>) => {
      if (gen === generation.current) setAnswer((current) => ({ status: "loading", text: "", ...current, ...patch }));
    };
    const req = runAi((id) => api.search(id, trimmed, r), {
      chunk: (text) => update({ status: "streaming", text }),
      done: (text, sources) => update({ status: "done", text, sources }),
      error: (message) => {
        if (gen !== generation.current) return;
        if (gotResult) update({ status: "error", error: message });
        else {
          setError(message);
          setLoading(false);
        }
      },
    });
    request.current = req;
    void req.started.then((res) => {
      if (gen !== generation.current || !res) return;
      gotResult = true;
      setResult(res);
      setLoading(false);
      if (res.answerRequestId === null) req.forget();
      else setAnswer((current) => current ?? { status: "loading", text: "" });
    }, (e) => setError(errorText(e)));
  }, []);

  const hits = result?.hits ?? [];
  const matches = useMemo(() => hits.map((hit, index) => ({ hit, index })).filter(({ hit }) => hit.tier === "match"), [hits]);
  const weak = useMemo(() => hits.map((hit, index) => ({ hit, index })).filter(({ hit }) => hit.tier === "weak"), [hits]);
  /** Reihenfolge für ↑ ↓: erst Quellen, dann „Weniger passend“ */
  const order = useMemo(() => [...matches, ...weak].map(({ index }) => index), [matches, weak]);
  const current: SearchHit | undefined = hits[order[selected] ?? -1];

  const select = (position: number) => {
    setSelected(position);
    requestAnimationFrame(() =>
      list.current?.querySelector(`[data-pos="${position}"]`)?.scrollIntoView({ block: "nearest" }),
    );
  };

  const dirty = !searched || searched.query !== query || searched.range !== range;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (order.length === 0) return;
      select(Math.max(0, Math.min(order.length - 1, selected + (e.key === "ArrowDown" ? 1 : -1))));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (dirty) runSearch(query, range);
      else if (current) onOpen(current.note);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  // ↑ ↓ ↵ esc auch, wenn der Fokus nicht im Feld ist
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.target === input.current || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("button") && e.key === "Enter") return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (order.length) select(Math.max(0, Math.min(order.length - 1, selected + (e.key === "ArrowDown" ? 1 : -1))));
      } else if (e.key === "Enter" && current) {
        e.preventDefault();
        onOpen(current.note);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const sourceCount = answer?.sources?.length ?? new Set(answer?.text.match(/\[(\d+)\]/g) ?? []).size;

  return (
    <div className="flex h-full gap-[2.5rem] py-[2rem] pr-[1.5rem] pl-[2.5rem]">
      {/* Linke Spalte */}
      <div className="flex min-w-0 flex-[1.4] flex-col">
        <div className="flex h-[4.75rem] items-center gap-[1rem] rounded-control border-[1.5px] border-focus px-[1.6rem]">
          <Search size={20} strokeWidth={1.5} className="shrink-0 text-text" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Suchen oder fragen …"
            aria-label="Suchen oder fragen"
            className="min-w-0 flex-1 bg-transparent text-[1.4rem] outline-none"
          />
          {dirty && query.trim() ? (
            <span className="flex shrink-0 items-center gap-[0.4rem] text-meta text-muted">
              <Kbd>↵</Kbd> suchen
            </span>
          ) : (
            <Kbd>{kbd("esc")}</Kbd>
          )}
        </div>

        <div className="mt-[1.4rem] flex flex-wrap items-center gap-[0.6rem]">
          {RANGES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => {
                setRange(value);
                if (searched?.query.trim()) runSearch(query, value);
                input.current?.focus();
              }}
              className={cx(
                "h-[2.6rem] rounded-full border px-[1rem] text-label transition-colors",
                range === value ? "border-hover bg-hover text-text" : "border-border text-text hover:bg-hover",
              )}
            >
              {label}
            </button>
          ))}
          {result && (
            <span className="ml-auto text-meta text-muted">
              Wörter + Bedeutung · {hits.length} {hits.length === 1 ? "Treffer" : "Treffer"}
            </span>
          )}
        </div>

        <div ref={list} className="mt-[1.5rem] min-h-0 flex-1 overflow-y-auto pr-[0.25rem] pb-[1rem]">
          {!searched?.query.trim() && (
            <p className="pt-[1rem] text-body text-muted">
              Stichwort oder Frage eingeben, z. B. „wo war das mit dem Risotto?“ · <Kbd>↵</Kbd> sucht
            </p>
          )}
          {loading && <p className="thinking pt-[1rem] text-body text-muted">Sucht …</p>}
          {error && <p className="pt-[1rem] text-body text-del">{error}</p>}
          {result && !loading && hits.length === 0 && <p className="pt-[1rem] text-body text-muted">Nichts gefunden.</p>}

          {answer && !answerHidden && (
            <section aria-label="Kurzantwort" className="mb-[2rem] rounded-card bg-window px-[1.9rem] pt-[1.5rem] pb-[1.6rem]">
              <div className="mb-[0.6rem] flex items-center justify-between text-meta text-muted">
                <span>
                  {answer.status === "done" ? `Kurzantwort aus ${sourceCount} ${sourceCount === 1 ? "Notiz" : "Notizen"}` : "Kurzantwort"}
                </span>
                <button type="button" className="hover:text-text" onClick={() => setAnswerHidden(true)}>
                  Ausblenden
                </button>
              </div>
              {answer.status === "loading" && <p className="thinking text-body text-muted">Liest die Treffer …</p>}
              {answer.status === "error" && (
                <p className="text-body text-del">
                  {answer.error}
                  {/api.?key/i.test(answer.error ?? "") && (
                    <>
                      {" · "}
                      <button type="button" className="underline underline-offset-2" onClick={onOpenSettings}>
                        Einstellungen öffnen
                      </button>
                    </>
                  )}
                </p>
              )}
              {(answer.status === "streaming" || answer.status === "done") && (
                <p className="text-body leading-[1.95] text-text" aria-live="polite">
                  <AnswerText
                    text={answer.text}
                    streaming={answer.status === "streaming"}
                    count={hits.length}
                    onBadge={(index) => select(Math.max(0, order.indexOf(index)))}
                  />
                </p>
              )}
            </section>
          )}
          {answer && answerHidden && (
            <button type="button" className="mb-[1rem] text-meta text-muted hover:text-text" onClick={() => setAnswerHidden(false)}>
              Kurzantwort einblenden
            </button>
          )}

          {matches.length > 0 && (
            <section aria-label="Quellen">
              <h2 className="mb-[1rem] pl-[0.3rem] text-meta font-medium text-muted">{answer ? "Quellen" : "Treffer"}</h2>
              <div className="flex flex-col gap-[1.1rem]">
                {matches.map(({ hit, index }, position) => (
                  <div
                    key={hit.note.id}
                    role="option"
                    aria-selected={selected === position}
                    data-pos={position}
                    onClick={() => setSelected(position)}
                    onDoubleClick={() => onOpen(hit.note)}
                    className={cx(
                      "flex gap-[1.1rem] rounded-card border px-[1.4rem] pt-[1.1rem] pb-[1.2rem] transition-colors",
                      selected === position ? "border-focus" : "border-border hover:border-border-strong",
                    )}
                  >
                    <span className="mt-[0.15rem] flex size-[2.1rem] shrink-0 items-center justify-center rounded-full bg-hover text-badge font-medium text-text">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-meta text-muted">{formatSource(hit.note.createdAt)}</div>
                      <p className="mt-[0.2rem] line-clamp-3 text-body text-text">
                        <Highlighted text={hit.note.text} ranges={hit.highlights} flat />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {weak.length > 0 && (
            <section aria-label="Weniger passend" className="mt-[2rem]">
              <h2 className="mb-[0.4rem] pl-[0.3rem] text-meta font-medium text-muted">Weniger passend</h2>
              {weak.map(({ hit }, k) => {
                const position = matches.length + k;
                const { title, preview } = deriveTitle(hit.note.text);
                const line = [title.replace(/[.:]$/, ""), preview].filter(Boolean).join(", ");
                return (
                  <div
                    key={hit.note.id}
                    role="option"
                    aria-selected={selected === position}
                    data-pos={position}
                    onClick={() => setSelected(position)}
                    onDoubleClick={() => onOpen(hit.note)}
                    className={cx(
                      "flex items-center gap-[1rem] rounded-small border px-[0.75rem] py-[0.7rem] text-body",
                      selected === position ? "border-focus" : "border-transparent hover:bg-hover",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{line.length > 42 ? `${line.slice(0, 42).replace(/[\s,.;:]+\S*$/, "")} …` : line}</span>
                    <span className="shrink-0 text-meta text-muted">{formatShort(hit.note.createdAt)}</span>
                  </div>
                );
              })}
            </section>
          )}
        </div>

        <div className="flex items-center gap-[0.6rem] pt-[0.8rem] text-meta text-muted">
          <Kbd>
            <ArrowUp size={12} />
          </Kbd>
          <Kbd>
            <ArrowDown size={12} />
          </Kbd>
          <span className="mr-[1rem]">auswählen</span>
          <Kbd>
            <CornerDownLeft size={12} />
          </Kbd>
          <span>öffnen</span>
        </div>
      </div>

      {/* Rechte Spalte: Vorschau */}
      <aside aria-label="Vorschau" className="flex min-w-0 flex-1 flex-col rounded-card bg-window px-[2.4rem] py-[1.8rem]">
        {current ? (
          <>
            <div className="flex items-center justify-between gap-[1rem]">
              <span className="truncate text-meta text-muted">{formatFull(current.note.createdAt)}</span>
              <button
                type="button"
                onClick={() => onOpen(current.note)}
                className="flex shrink-0 items-center gap-[0.5rem] rounded-full bg-panel px-[1rem] py-[0.4rem] text-label text-text hover:bg-hover"
              >
                Öffnen <Kbd>↵</Kbd>
              </button>
            </div>
            <p className="selectable mt-[1.6rem] min-h-0 overflow-y-auto text-editor break-words whitespace-pre-wrap text-text">
              <Highlighted text={current.note.text} ranges={current.highlights} />
            </p>
          </>
        ) : (
          <p className="m-auto text-meta text-muted">Keine Auswahl</p>
        )}
      </aside>
    </div>
  );
}
