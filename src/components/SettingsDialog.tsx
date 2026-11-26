import { X } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import * as api from "../lib/api";
import { DEFAULT_CAPTURE_SHORTCUT, formatAccelerator, isMac } from "../lib/platform";
import { applyTheme, type Theme } from "../lib/theme";
import type { Settings } from "../lib/types";
import { Modal } from "./ConfirmDialog";
import { errorText, useToast } from "./Toast";
import { Button, cx, IconButton, Segmented } from "./ui";

/** KeyboardEvent → Accelerator-String wie „Alt+Space“ / „Ctrl+Shift+K“ */
function toAccelerator(e: KeyboardEvent): string | null {
  const code = e.code;
  let key: string | null = null;
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit\d$/.test(code)) key = code.slice(5);
  else if (/^F\d{1,2}$/.test(code)) key = code;
  else if (code === "Space") key = "Space";
  else if (/^Arrow(Up|Down|Left|Right)$/.test(code)) key = code.slice(5);
  else if (["Comma", "Period", "Slash", "Semicolon", "Quote", "BracketLeft", "BracketRight", "Backslash", "Minus", "Equal", "Backquote"].includes(code)) key = code;
  if (!key) return null;
  const mods = [
    e.ctrlKey && "Ctrl",
    e.metaKey && (isMac ? "Cmd" : "Super"),
    e.altKey && "Alt",
    e.shiftKey && "Shift",
  ].filter(Boolean) as string[];
  // Ohne Modifier (oder nur Shift) würde der Shortcut normales Tippen blockieren
  if (mods.length === 0 || (mods.length === 1 && mods[0] === "Shift")) return null;
  return [...mods, key].join("+");
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <section className="border-t border-border py-[1.3rem] first:border-t-0 first:pt-0">
      <h3 className="mb-[0.7rem] text-label font-medium">{title}</h3>
      {children}
      {hint && <p className="mt-[0.6rem] text-meta text-muted">{hint}</p>}
    </section>
  );
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [key, setKey] = useState("");
  const [recording, setRecording] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKey("");
    setRecording(false);
    setShortcutError(null);
    api.settingsGet().then(setSettings, (e) => toast.show({ message: errorText(e), tone: "error" }));
  }, [open, toast]);

  const patch = async (partial: Partial<Omit<Settings, "hasApiKey">>) => {
    const before = settings;
    if (settings) setSettings({ ...settings, ...partial });
    try {
      await api.settingsSet(partial);
      return true;
    } catch (e) {
      setSettings(before);
      toast.show({ message: errorText(e), tone: "error" });
      return false;
    }
  };

  const setTheme = (theme: Theme) => {
    applyTheme(theme);
    void patch({ theme });
  };

  const setShortcut = async (accelerator: string) => {
    setRecording(false);
    if (!isMac && accelerator === "Alt+Space") {
      setShortcutError("Alt+Leertaste ist unter Windows vom System belegt.");
      return;
    }
    setShortcutError(null);
    await patch({ captureShortcut: accelerator });
  };

  const saveKey = async () => {
    if (!key.trim()) return;
    setBusy(true);
    try {
      await api.apiKeySet(key.trim());
      setKey("");
      setSettings(await api.settingsGet());
      toast.show({ message: "API-Key gespeichert" });
    } catch (e) {
      toast.show({ message: errorText(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => (recording ? setRecording(false) : onClose())} labelledBy="settings-title" className="w-[34rem] max-w-[92vw]">
      <div className="px-[1.9rem] pt-[1.5rem] pb-[1.6rem]">
        <div className="mb-[1.2rem] flex items-center justify-between">
          <h2 id="settings-title" className="text-card-title font-semibold">
            Einstellungen
          </h2>
          <IconButton label="Schliessen" onClick={onClose}>
            <X size={18} strokeWidth={1.5} />
          </IconButton>
        </div>

        {!settings ? (
          <p className="text-body text-muted">Lädt …</p>
        ) : (
          <>
            <Section title="Darstellung">
              <Segmented
                label="Darstellung"
                value={settings.theme}
                onChange={setTheme}
                options={[
                  { value: "light", label: "Hell" },
                  { value: "dark", label: "Dunkel" },
                  { value: "system", label: "System" },
                ]}
              />
            </Section>

            <Section
              title="Quick Capture"
              hint={shortcutError ? <span className="text-del">{shortcutError}</span> : "Öffnet überall ein Fenster für eine schnelle Notiz, auch wenn notiz. geschlossen ist."}
            >
              <div className="flex items-center gap-[0.6rem]">
                <button
                  type="button"
                  aria-label="Tastenkombination für Quick Capture"
                  onClick={() => {
                    setShortcutError(null);
                    setRecording(true);
                  }}
                  onBlur={() => setRecording(false)}
                  onKeyDown={(e) => {
                    if (!recording) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.key === "Escape") {
                      setRecording(false);
                      return;
                    }
                    const accelerator = toAccelerator(e);
                    if (accelerator) void setShortcut(accelerator);
                  }}
                  className={cx(
                    "flex h-[2.6rem] min-w-[12rem] items-center rounded-control border px-[1rem] text-label",
                    recording ? "border-accent text-muted" : "border-border hover:bg-hover",
                  )}
                >
                  {recording ? "Tastenkombination drücken …" : formatAccelerator(settings.captureShortcut)}
                </button>
                {settings.captureShortcut !== DEFAULT_CAPTURE_SHORTCUT && (
                  <Button variant="ghost" onClick={() => void setShortcut(DEFAULT_CAPTURE_SHORTCUT)}>
                    Zurücksetzen
                  </Button>
                )}
              </div>
            </Section>

            <Section
              title="Claude API-Key"
              hint="Wird im Schlüsselbund des Systems gespeichert. Notiztext geht nur an Claude, wenn du einen KI-Befehl ausführst oder in der Suche eine Frage stellst."
            >
              <p className={cx("mb-[0.6rem] text-meta", settings.hasApiKey ? "text-ins" : "text-muted")}>
                {settings.hasApiKey ? "● Hinterlegt" : "Noch kein API-Key hinterlegt"}
              </p>
              <form
                className="flex gap-[0.6rem]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveKey();
                }}
              >
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={settings.hasApiKey ? "Neuen Key eingeben, um ihn zu ersetzen" : "sk-ant-…"}
                  aria-label="API-Key"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-[2.6rem] min-w-0 flex-1 rounded-control border border-border bg-transparent px-[0.9rem] text-label outline-none focus:border-accent"
                />
                <Button type="submit" variant="primary" disabled={!key.trim() || busy}>
                  Speichern
                </Button>
              </form>
            </Section>
          </>
        )}
      </div>
    </Modal>
  );
}
