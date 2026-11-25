import type { Settings } from "./types";

export type Theme = Settings["theme"];

const STORAGE_KEY = "notiz.theme";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

let current: Theme = readCached();

/** Letztes Theme, damit beim Start nichts aufblitzt. Massgebend ist settings_get. */
function readCached(): Theme {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

function paint() {
  const dark = current === "dark" || (current === "system" && systemDark.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  current = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  paint();
}

export function initTheme() {
  paint();
  systemDark.addEventListener("change", paint);
}
