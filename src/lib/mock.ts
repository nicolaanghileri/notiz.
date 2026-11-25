/**
 * Mock-Backend im Speicher: gleiche Schnittstelle wie die echten Commands,
 * inkl. simuliertem KI-Streaming. Alles geht beim Neuladen verloren.
 *
 * Zum Testen von Fehlern: eine eigene Anweisung, die „fehler“ enthält, löst
 * `ai://error` aus. Ebenso jeder KI-Befehl nach `apiKeySet("")`.
 */
import type { NotizApi } from "./api";
import { createMockNotes } from "./mockData";
import type {
  AiCommand,
  EventMap,
  Filter,
  Note,
  Range,
  SearchHit,
  Settings,
} from "./types";

const LATENCY_MS = 60;
const AI_START_MS = 500;
const AI_CHUNK_MS = 35;
const MAX_SOURCES = 3;

type Handler = (payload: never) => void;

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

// --- Zeiträume ------------------------------------------------------------

/** Lokale Mitternacht vor `daysAgo` Tagen */
function startOfDay(daysAgo = 0): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function matchesFilter(note: Note, filter: Filter): boolean {
  if (filter === "trash") return note.deletedAt !== null;
  if (note.deletedAt !== null) return false;
  switch (filter) {
    case "all":
      return true;
    case "today":
      return new Date(note.createdAt) >= startOfDay();
    case "last7":
      return new Date(note.createdAt) >= startOfDay(6);
    case "quick":
      return note.source === "quick";
    case "pinned":
      return note.pinned;
  }
}

function matchesRange(note: Note, range: Range): boolean {
  const created = new Date(note.createdAt);
  switch (range) {
    case "all":
      return true;
    case "lastMonth":
      return created >= startOfDay(30);
    case "thisYear":
      return created.getFullYear() === new Date().getFullYear();
  }
}

const newestFirst = (a: Note, b: Note) =>
  b.createdAt.localeCompare(a.createdAt);

// --- Suche ----------------------------------------------------------------

const STOPWORDS = new Set(
  (
    "aber als am an auch auf aus bei bin bis da das dem den der die ein eine " +
    "einen er es für hab habe hast hat ich im in ist mal mein meine mit nicht " +
    "noch notiert notiz notizen oder sie und vom von wann war was wegen welche " +
    "wer wie wo zu zum zur"
  ).split(" "),
);

const QUESTION_START =
  /^(wo|was|wann|wer|wie|warum|wieso|weshalb|welche[rsmn]?|wem|wen|wohin|woher|womit)\s/i;

const isQuestion = (query: string) =>
  query.endsWith("?") || QUESTION_START.test(query);

const tokenize = (query: string) =>
  (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (word) => word.length > 1 && !STOPWORDS.has(word),
  );

function findRanges(text: string, needle: string): [number, number][] {
  const ranges: [number, number][] = [];
  const haystack = text.toLowerCase();
  const search = needle.toLowerCase();
  let start = haystack.indexOf(search);
  while (start !== -1) {
    ranges.push([start, start + search.length]);
    start = haystack.indexOf(search, start + search.length);
  }
  return ranges;
}

/** Sortiert und fasst überlappende Bereiche zusammen */
function mergeRanges(ranges: [number, number][]): [number, number][] {
  const merged: [number, number][] = [];
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** „Semantische“ Treffer aus Screen 4, die reine Wortsuche nicht findet */
const HEATING_HITS: {
  id: string;
  phrases: string[];
  tier: SearchHit["tier"];
  answer?: string;
}[] = [
  {
    id: "heizung-bad",
    phrases: ["Heizung Bad klackert wieder.", "Heizung"],
    tier: "match",
    answer:
      "Zuletzt gestern: Das Ventil im Bad klackert wieder, du wolltest Hr. Brunner anrufen – nur vormittags",
  },
  {
    id: "brunner-monteur",
    phrases: ["Monteur kommt nächste Woche wegen Ventil im Bad"],
    tier: "match",
    answer: "Am 3. Oktober hatte er einen Monteur angekündigt",
  },
  {
    id: "nebenkosten",
    phrases: ["Heizkosten fast 30% höher"],
    tier: "match",
    answer:
      "Im September sind dir die um fast 30 % höheren Heizkosten aufgefallen",
  },
  { id: "velo-service", phrases: [], tier: "weak" },
  { id: "router-passwort", phrases: [], tier: "weak" },
];

const isHeatingQuery = (query: string) => /heiz/i.test(query);

function searchNotes(notes: Note[], query: string): SearchHit[] {
  if (isHeatingQuery(query)) {
    return HEATING_HITS.flatMap(({ id, phrases, tier }, index) => {
      const note = notes.find((candidate) => candidate.id === id);
      if (!note) return [];
      const highlights = mergeRanges(
        phrases.flatMap((phrase) => findRanges(note.text, phrase)),
      );
      return [{ note, highlights, score: 0.95 - index * 0.15, tier }];
    });
  }

  const words = tokenize(query);
  if (words.length === 0) return [];
  return notes
    .map((note): SearchHit => {
      const perWord = words.map((word) => findRanges(note.text, word));
      const score =
        perWord.filter((ranges) => ranges.length > 0).length / words.length;
      return {
        note,
        highlights: mergeRanges(perWord.flat()),
        score,
        tier: score >= 0.5 ? "match" : "weak",
      };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || newestFirst(a.note, b.note));
}

/** Kurzantwort mit Quellen-Badges [1] [2] [3] in Reihenfolge der Treffer */
function shortAnswer(query: string, sources: SearchHit[]): string {
  if (isHeatingQuery(query)) {
    const sentences = sources.map((hit, index) => {
      const scripted = HEATING_HITS.find(({ id }) => id === hit.note.id);
      return `${scripted?.answer ?? firstSentence(hit.note.text)} [${index + 1}].`;
    });
    const intro =
      sources.length === 3 ? "Du hast die Heizung dreimal notiert. " : "";
    return intro + sentences.join(" ");
  }
  return sources
    .map((hit, index) => `${firstSentence(hit.note.text)} [${index + 1}].`)
    .join(" ");
}

// --- KI-Texte -------------------------------------------------------------

const TESSIN_SOURCE =
  "oder Wochenende Tessin, aber Hotel muss bald gebucht werden wg. Ostern\nBudget max 400";
const TESSIN_IMPROVED =
  "Oder ein Wochenende im Tessin – dann muss das Hotel aber bald gebucht werden, wegen Ostern.\nBudget: max. 400 Fr.";

function firstSentence(text: string): string {
  const line = text.trim().split("\n")[0];
  return (line.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? line).replace(/[.!?]+$/, "");
}

const mapLines = (text: string, change: (line: string) => string) =>
  text
    .split("\n")
    .map((line) => (line.trim() ? change(line) : line))
    .join("\n");

function correct(text: string): string {
  return mapLines(text, (line) =>
    line
      .replace(/\bvllt\b/g, "vielleicht")
      .replace(/\bwg\./g, "wegen")
      .replace(/\bevtl\./g, "eventuell")
      .replace(/([!?])\1+/g, "$1")
      .replace(/^\s*\p{Ll}/u, (start) => start.toUpperCase()),
  );
}

function improve(text: string): string {
  if (text.trim() === TESSIN_SOURCE) return TESSIN_IMPROVED;
  return mapLines(correct(text), (line) =>
    /[.!?:…]\s*$/.test(line) ? line : `${line.trimEnd()}.`,
  );
}

function transform(
  command: AiCommand,
  text: string,
  instruction: string,
): string {
  switch (command) {
    case "correct":
      return correct(text);
    case "improve":
      return improve(text);
    case "summarize":
      return `${firstSentence(correct(text))}.`;
    case "custom":
      return /to-?do|liste/i.test(instruction)
        ? mapLines(correct(text), (line) => `- ${line.trim()}`)
        : improve(text);
  }
}

// --- API ------------------------------------------------------------------

export function createMockApi(): NotizApi {
  const notes = new Map(createMockNotes().map((note) => [note.id, note]));
  const settings: Settings = {
    theme: "system",
    captureShortcut: "Alt+Space",
    hasApiKey: true,
  };
  const handlers = new Map<keyof EventMap, Set<Handler>>();
  /** Laufende KI-Anfragen. Fehlt die ID, wurde abgebrochen. */
  const running = new Set<string>();
  /** Auch vor dem Streaming-Start abgebrochen: danach kein Event mehr. */
  const cancelled = new Set<string>();

  function emit<E extends keyof EventMap>(event: E, payload: EventMap[E]) {
    handlers.get(event)?.forEach((handler) => handler(payload as never));
  }

  function find(id: string): Note {
    const note = notes.get(id);
    if (!note) throw "Notiz nicht gefunden";
    return note;
  }

  function change(id: string, patch: Partial<Note>): Note {
    const note = { ...find(id), ...patch };
    notes.set(id, note);
    return { ...note };
  }

  const list = (filter: Filter) =>
    [...notes.values()]
      .filter((note) => matchesFilter(note, filter))
      .sort(newestFirst)
      .map((note) => ({ ...note }));

  /** Schickt `text` Wort für Wort als Events. Läuft im Hintergrund weiter. */
  async function stream(requestId: string, text: string, sources?: string[]) {
    if (cancelled.has(requestId)) return;
    running.add(requestId);
    await wait(AI_START_MS);
    if (!running.has(requestId)) return;
    if (!settings.hasApiKey) {
      running.delete(requestId);
      emit("ai://error", { requestId, message: "Kein API-Key hinterlegt" });
      return;
    }
    for (const delta of text.match(/\S+\s*|\s+/g) ?? []) {
      if (!running.has(requestId)) return;
      emit("ai://chunk", { requestId, delta });
      await wait(AI_CHUNK_MS);
    }
    if (!running.delete(requestId)) return;
    emit("ai://done", { requestId, text, ...(sources && { sources }) });
  }

  async function fail(requestId: string, message: string) {
    if (cancelled.has(requestId)) return;
    running.add(requestId);
    await wait(AI_START_MS);
    if (running.delete(requestId)) emit("ai://error", { requestId, message });
  }

  return {
    async notesList(filter) {
      await wait(LATENCY_MS);
      return list(filter);
    },

    async notesCounts() {
      await wait(LATENCY_MS);
      return {
        all: list("all").length,
        today: list("today").length,
        last7: list("last7").length,
        quick: list("quick").length,
        pinned: list("pinned").length,
        trash: list("trash").length,
      };
    },

    async noteGet(id) {
      await wait(LATENCY_MS);
      return { ...find(id) };
    },

    async noteCreate(text, source) {
      await wait(LATENCY_MS);
      const now = new Date().toISOString();
      const note: Note = {
        id: crypto.randomUUID(),
        text,
        createdAt: now,
        updatedAt: now,
        pinned: false,
        source,
        deletedAt: null,
      };
      notes.set(note.id, note);
      if (source === "quick") emit("notes://changed", { id: note.id });
      return { ...note };
    },

    async noteUpdate(id, text) {
      await wait(LATENCY_MS);
      return change(id, { text, updatedAt: new Date().toISOString() });
    },

    async noteSetPinned(id, pinned) {
      await wait(LATENCY_MS);
      return change(id, { pinned });
    },

    async noteDelete(id) {
      await wait(LATENCY_MS);
      change(id, { deletedAt: new Date().toISOString() });
    },

    async noteRestore(id) {
      await wait(LATENCY_MS);
      change(id, { deletedAt: null });
    },

    async noteDeleteForever(id) {
      await wait(LATENCY_MS);
      find(id);
      notes.delete(id);
    },

    async search(requestId, query, range) {
      await wait(LATENCY_MS * 2);
      const trimmed = query.trim();
      const candidates = list("all").filter((note) =>
        matchesRange(note, range),
      );
      const hits = searchNotes(candidates, trimmed);
      const sources = hits
        .filter((hit) => hit.tier === "match")
        .slice(0, MAX_SOURCES);
      if (!isQuestion(trimmed) || sources.length === 0) {
        return { hits, answerRequestId: null };
      }

      void stream(
        requestId,
        shortAnswer(trimmed, sources),
        sources.map((hit) => hit.note.id),
      );
      return { hits, answerRequestId: requestId };
    },

    async aiTransform(requestId, command, text, instruction = "") {
      await wait(LATENCY_MS);
      if (command === "custom" && /fehler/i.test(instruction)) {
        void fail(requestId, "Simulierter Fehler (Mock)");
      } else {
        void stream(requestId, transform(command, text, instruction));
      }
    },

    async aiSummarizeNotes(requestId, ids) {
      await wait(LATENCY_MS);
      const lines = ids.map((id) => `- ${firstSentence(find(id).text)}`);
      void stream(requestId, `Zusammenfassung\n${lines.join("\n")}`);
    },

    async aiCancel(requestId) {
      cancelled.add(requestId);
      running.delete(requestId);
    },

    async settingsGet() {
      await wait(LATENCY_MS);
      return { ...settings };
    },

    async settingsSet(partial) {
      await wait(LATENCY_MS);
      Object.assign(settings, partial);
    },

    async apiKeySet(key) {
      await wait(LATENCY_MS);
      settings.hasApiKey = key.trim() !== "";
    },

    async on(event, handler) {
      const set = handlers.get(event) ?? new Set<Handler>();
      handlers.set(event, set);
      set.add(handler as Handler);
      return () => {
        set.delete(handler as Handler);
      };
    },
  };
}
