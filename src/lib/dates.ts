/** Datumsanzeige wie in den Screenshots (lokale Zeitzone, de-CH). */

const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS_SHORT = ["Jan", "Feb", "März", "Apr", "Mai", "Juni", "Juli", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const pad = (n: number) => String(n).padStart(2, "0");
const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Montag 00:00 der Woche von `d` */
export function startOfWeek(d: Date = new Date()): Date {
  const day = startOfDay(d);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

/** Ganze Kalendertage zwischen `d` und heute (0 = heute) */
function daysAgo(d: Date, now: Date): number {
  return Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
}

const dayMonth = (d: Date, now: Date) =>
  `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}` +
  (d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : "");

/**
 * Karten: „Heute, 09:14“, „Gestern, 22:47“, „Mo, 16:05“ (diese Woche),
 * „Fr, 20. Nov“ (letzte Woche), älter „12. Nov“.
 */
export function formatRelative(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const ago = daysAgo(d, now);
  if (ago === 0) return `Heute, ${time(d)}`;
  if (ago === 1) return `Gestern, ${time(d)}`;
  const week = startOfWeek(now);
  if (d >= week) return `${WEEKDAYS_SHORT[d.getDay()]}, ${time(d)}`;
  const lastWeek = new Date(week);
  lastWeek.setDate(lastWeek.getDate() - 7);
  if (d >= lastWeek) return `${WEEKDAYS_SHORT[d.getDay()]}, ${dayMonth(d, now)}`;
  return dayMonth(d, now);
}

/** Suche, Quellen: „Gestern, 24. Nov · 17:20“, „Sa, 3. Okt · 11:05“ */
export function formatSource(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const ago = daysAgo(d, now);
  const prefix = ago === 0 ? "Heute" : ago === 1 ? "Gestern" : WEEKDAYS_SHORT[d.getDay()];
  return `${prefix}, ${dayMonth(d, now)} · ${time(d)}`;
}

/** Suche, „Weniger passend“: „Heute“, „Gestern“, „Mo“, „12. Nov“ */
export function formatShort(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const ago = daysAgo(d, now);
  if (ago === 0) return "Heute";
  if (ago === 1) return "Gestern";
  if (d >= startOfWeek(now)) return WEEKDAYS_SHORT[d.getDay()];
  return dayMonth(d, now);
}

/** Vorschau: „Dienstag, 24. November 2026 · 17:20“ */
export function formatFull(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${time(d)}`;
}

/** Liste: „Heute · Mittwoch, 25. November“, „Gestern“, „Montag, 23. November“ */
export function formatDayHeading(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const ago = daysAgo(d, now);
  const full =
    `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}` +
    (d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : "");
  if (ago === 0) return `Heute · ${full}`;
  if (ago === 1) return "Gestern";
  return full;
}

export const formatTime = (iso: string) => time(new Date(iso));

export const dayKey = (iso: string) => startOfDay(new Date(iso)).getTime();
