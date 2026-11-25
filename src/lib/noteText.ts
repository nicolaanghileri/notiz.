/** Abgeleiteter Titel und Vorschau (BRIEF 1.2): erster Satz der ersten Zeile. */

/** Punkte, die keinen Satz beenden („Dr. Keller“, „wg. Ostern“, „4. Dez“) */
const ABBREVIATION =
  /(?:^|[\s(])(?:Dr|Hr|Fr|Frau|Prof|St|Nr|ca|wg|evtl|vllt|bzw|usw|inkl|exkl|max|min|z\.\s?B|u\.\s?a|d\.\s?h|p\.\s?P|[A-Za-zÄÖÜäöü]|\d+)\.$/;

function firstSentenceEnd(line: string): number {
  const re = /[.!?…]+(?=\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line))) {
    const end = match.index + match[0].length;
    if (match[0] === "." && ABBREVIATION.test(line.slice(0, end))) continue;
    if (end < line.length) return end;
  }
  return line.length;
}

export interface Derived {
  title: string;
  /** Rest des Texts, Zeilen zu Fliesstext zusammengezogen */
  preview: string;
}

/** Zeilenumbrüche für einzeilige Anzeigen: „vormittags\nevtl.“ → „vormittags. evtl.“ */
export function joinLines(text: string): string {
  return text
    .trim()
    .replace(/\s*\n\s*/g, (_, offset: number, whole: string) =>
      /[.!?:;,…–-]$/.test(whole.slice(0, offset).trimEnd()) ? " " : ". ",
    );
}

export function deriveTitle(text: string): Derived {
  const trimmed = text.replace(/^\s+/, "");
  if (!trimmed.trim()) return { title: "Leere Notiz", preview: "" };
  const newline = trimmed.indexOf("\n");
  const line = (newline === -1 ? trimmed : trimmed.slice(0, newline)).trimEnd();
  const end = firstSentenceEnd(line);
  const title = line.slice(0, end).trim();
  const rest = (line.slice(end) + (newline === -1 ? "" : trimmed.slice(newline))).trim();
  return { title, preview: joinLines(rest) };
}

export const wordCount = (text: string) =>
  text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu)?.length ?? 0;
