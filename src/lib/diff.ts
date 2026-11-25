/**
 * Wortbasierter Diff fürs Frontend (BRIEF Abschnitt 14).
 * Tokens: Wörter, Leerraum, einzelne Satzzeichen. LCS nach Abschneiden von
 * gemeinsamem Anfang/Ende; sehr lange Texte fallen auf „alles ersetzt“ zurück.
 */
export type DiffPart = { type: "equal" | "delete" | "insert"; text: string };

const TOKEN = /\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;
const MAX_CELLS = 4_000_000;

const tokenize = (text: string) => text.match(TOKEN) ?? [];

function lcsDiff(a: string[], b: string[]): DiffPart[] {
  const n = a.length;
  const m = b.length;
  if (n * m > MAX_CELLS) {
    return [
      { type: "delete", text: a.join("") },
      { type: "insert", text: b.join("") },
    ];
  }
  // table[i][j] = LCS-Länge von a[i..] und b[j..]
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      parts.push({ type: "equal", text: a[i++] });
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      parts.push({ type: "delete", text: a[i++] });
    } else {
      parts.push({ type: "insert", text: b[j++] });
    }
  }
  while (i < n) parts.push({ type: "delete", text: a[i++] });
  while (j < m) parts.push({ type: "insert", text: b[j++] });
  return parts;
}

/** Gleiche Typen zusammenfassen, je Änderungsblock erst „entfernt“, dann „eingefügt“ */
function normalize(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  let del = "";
  let ins = "";
  const flushChange = () => {
    if (del) out.push({ type: "delete", text: del });
    if (ins) out.push({ type: "insert", text: ins });
    del = ins = "";
  };
  for (const part of parts) {
    if (part.type === "delete") del += part.text;
    else if (part.type === "insert") ins += part.text;
    else {
      flushChange();
      const last = out[out.length - 1];
      if (last?.type === "equal") last.text += part.text;
      else out.push({ ...part });
    }
  }
  flushChange();
  return out;
}

/** Kleine Gleichheiten zwischen zwei Änderungen (nur Leerraum oder ein kurzes Wort) in die Änderung ziehen */
function absorbSmallEquals(parts: DiffPart[]): DiffPart[] {
  let changed = true;
  let current = parts;
  while (changed) {
    changed = false;
    const next: DiffPart[] = [];
    for (let k = 0; k < current.length; k++) {
      const part = current[k];
      const prev = next[next.length - 1];
      const after = current[k + 1];
      const small = part.type === "equal" && !part.text.includes("\n") && (/^\s+$/.test(part.text) || part.text.trim().length <= 1);
      if (small && prev && prev.type !== "equal" && after && after.type !== "equal") {
        next.push({ type: "delete", text: part.text }, { type: "insert", text: part.text });
        changed = true;
      } else {
        next.push(part);
      }
    }
    current = normalize(next);
  }
  return current;
}

export function diffWords(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ type: "equal", text: before }] : [];
  const a = tokenize(before);
  const b = tokenize(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const parts = ([
    { type: "equal", text: a.slice(0, start).join("") },
    ...lcsDiff(a.slice(start, endA), b.slice(start, endB)),
    { type: "equal", text: a.slice(endA).join("") },
  ] as DiffPart[]).filter((part) => part.text !== "");
  return absorbSmallEquals(normalize(parts));
}

/** Anzahl zusammenhängender Änderungen */
export const changeCount = (parts: DiffPart[]) =>
  parts.filter((part, k) => part.type !== "equal" && (k === 0 || parts[k - 1].type === "equal")).length;
