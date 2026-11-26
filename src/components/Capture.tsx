import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { inTauri, kbd } from "../lib/platform";
import { applyTheme } from "../lib/theme";
import { errorText } from "./Toast";
import { Kbd } from "./ui";

/** Quick Capture (Screen 5): eigenes Fenster, Route /capture */
async function hideWindow() {
  if (!inTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().hide();
}

export function Capture() {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // Bei jedem Einblenden: Cursor sofort drin, Theme aktuell
  useEffect(() => {
    const onFocus = () => {
      area.current?.focus();
      api.settingsGet().then((settings) => applyTheme(settings.theme), () => {});
    };
    onFocus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const close = () => {
    setError(null);
    void hideWindow();
  };

  const save = async () => {
    if (saving) return;
    if (!text.trim()) {
      close();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.noteCreate(text, "quick");
      setText("");
      if (inTauri) close();
      else {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={inTauri ? "p-[1.5rem]" : "min-h-full bg-window px-[1.5rem] pt-[12vh]"}>
      <div className="mx-auto max-w-[59rem] overflow-hidden rounded-[24px] border border-border bg-float text-text shadow-[0_24px_60px_rgb(15_15_15/0.22),0_0_0_1px_rgb(15_15_15/0.04)]">
        <div className="flex gap-[1.1rem] px-[2.2rem] pt-[2rem] pb-[1.8rem]">
          <Pencil size={20} strokeWidth={1.5} className="mt-[0.55rem] shrink-0 text-muted" />
          <div className="grid max-h-[50vh] min-w-0 flex-1 overflow-y-auto text-capture">
            <div aria-hidden className="invisible col-start-1 row-start-1 break-words whitespace-pre-wrap">
              {text}
              {"​"}
            </div>
            <textarea
              ref={area}
              value={text}
              autoFocus
              aria-label="Neue Notiz"
              placeholder="Einfach losschreiben …"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void save();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                }
              }}
              className="col-start-1 row-start-1 resize-none overflow-hidden bg-transparent break-words whitespace-pre-wrap outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-[1.2rem] border-t border-border px-[2.2rem] py-[1rem] text-meta text-muted">
          <span className={error ? "text-del" : ""}>
            {error ?? (saved ? "Gespeichert in „Schnell erfasst“" : saving ? "Speichert …" : "Neue Notiz in notiz.")}
          </span>
          <span className="ml-auto flex items-center gap-[0.5rem]">
            <Kbd>↵</Kbd> sichern
          </span>
          <span className="flex items-center gap-[0.5rem]">
            <Kbd>{kbd("shift", "enter")}</Kbd> neue Zeile
          </span>
          <span className="flex items-center gap-[0.5rem]">
            <Kbd>{kbd("esc")}</Kbd> schliessen
          </span>
        </div>
      </div>
    </div>
  );
}
