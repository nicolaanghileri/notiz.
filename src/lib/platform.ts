/** macOS → ⌘, sonst Ctrl (BRIEF Abschnitt 9). */
export const isMac = /Mac|iPhone|iPad/.test(
  navigator.platform || navigator.userAgent,
);

export const inTauri = "__TAURI_INTERNALS__" in window;

/** ⌘ auf macOS, Ctrl auf Windows/Linux. Auf macOS ist Ctrl-Klick das Kontextmenü. */
export const modKey = (e: { metaKey: boolean; ctrlKey: boolean }) =>
  isMac ? e.metaKey : e.ctrlKey;

/** Anzeige eines Shortcuts, z. B. kbd("mod", "K") → "⌘K" bzw. "Ctrl+K" */
export function kbd(...keys: string[]): string {
  const names: Record<string, [string, string]> = {
    mod: ["⌘", "Ctrl"],
    shift: ["⇧", "Shift"],
    alt: ["⌥", "Alt"],
    enter: ["↵", "Enter"],
    esc: ["esc", "Esc"],
    backspace: ["⌫", "Backspace"],
    space: ["Leertaste", "Leertaste"],
  };
  const parts = keys.map((key) => names[key]?.[isMac ? 0 : 1] ?? key);
  return isMac ? parts.join("") : parts.join("+");
}

/** Accelerator-String (Settings.captureShortcut) lesbar machen: „⌥ Leertaste“ bzw. „Ctrl+Shift+Leertaste“ */
export function formatAccelerator(accelerator: string): string {
  const mods: Record<string, [string, string]> = {
    Alt: ["⌥", "Alt"], Option: ["⌥", "Alt"], Shift: ["⇧", "Shift"],
    Ctrl: ["⌃", "Ctrl"], Control: ["⌃", "Ctrl"],
    Cmd: ["⌘", "Win"], Command: ["⌘", "Win"], Super: ["⌘", "Win"],
    CmdOrCtrl: ["⌘", "Ctrl"], CommandOrControl: ["⌘", "Ctrl"],
  };
  const parts = accelerator.split("+").filter(Boolean);
  const key = parts.pop() ?? "";
  const keyName = key === "Space" ? "Leertaste" : key;
  const modNames = parts.map((part) => mods[part]?.[isMac ? 0 : 1] ?? part);
  if (!isMac) return [...modNames, keyName].join("+");
  return modNames.join("") + (keyName.length > 1 ? " " : "") + keyName;
}

export const DEFAULT_CAPTURE_SHORTCUT = isMac ? "Alt+Space" : "Ctrl+Shift+Space";
