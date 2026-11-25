import { Check, CornerDownLeft, RotateCw, TextAlignStart, WandSparkles, type LucideIcon } from "lucide-react";
import { forwardRef, type KeyboardEvent, type ReactNode } from "react";
import { type DiffPart } from "../lib/diff";
import { kbd } from "../lib/platform";
import type { AiCommand } from "../lib/types";
import { Button, cx, Kbd, KbdOnPrimary, Segmented } from "./ui";

/** Überall gleiche Reihenfolge: Verbessern 1, Korrigieren 2, Zusammenfassen 3 */
export const AI_COMMANDS: { command: Exclude<AiCommand, "custom">; label: string; icon: LucideIcon; key: string }[] = [
  { command: "improve", label: "Verbessern", icon: WandSparkles, key: "1" },
  { command: "correct", label: "Korrigieren", icon: Check, key: "2" },
  { command: "summarize", label: "Zusammenfassen", icon: TextAlignStart, key: "3" },
];

export const commandLabel = (command: AiCommand) =>
  command === "custom" ? "Eigene Anweisung" : AI_COMMANDS.find((item) => item.command === command)!.label;

// --- Menü auf Markierung (Screen 2) ---------------------------------------

export const AiMenu = forwardRef<
  HTMLInputElement,
  {
    style: React.CSSProperties;
    active: number;
    onActive: (index: number) => void;
    onRun: (command: AiCommand, instruction?: string) => void;
    instruction: string;
    onInstruction: (value: string) => void;
    onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  }
>(function AiMenu({ style, active, onActive, onRun, instruction, onInstruction, onInputKeyDown }, inputRef) {
  return (
    <div
      role="menu"
      aria-label="KI-Befehle"
      style={style}
      // Fokus bleibt in der Textarea, damit die Markierung erhalten bleibt
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      }}
      className="appear absolute z-20 w-[29.5rem] rounded-[16px] border border-border bg-float p-[0.6rem] text-text shadow-float"
    >
      {AI_COMMANDS.map(({ command, label, icon: Icon, key }, index) => (
        <button
          key={command}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onMouseEnter={() => onActive(index)}
          onClick={() => onRun(command)}
          className={cx(
            "flex h-[3.1rem] w-full items-center gap-[0.9rem] rounded-small px-[0.9rem] text-left text-body",
            active === index && "bg-hover",
          )}
        >
          <Icon size={18} strokeWidth={1.5} className="text-muted" />
          <span className="flex-1">{label}</span>
          <Kbd>{key}</Kbd>
        </button>
      ))}
      <div className="mx-[0.3rem] my-[0.55rem] border-t border-border" />
      <label
        className={cx(
          "flex h-[3.1rem] items-center gap-[0.6rem] rounded-small px-[0.9rem]",
          active === 3 && "bg-hover",
        )}
      >
        <input
          ref={inputRef}
          value={instruction}
          onChange={(e) => onInstruction(e.target.value)}
          onKeyDown={onInputKeyDown}
          onFocus={() => onActive(3)}
          placeholder="Eigene Anweisung … z. B. „als To-do-Liste“"
          aria-label="Eigene Anweisung"
          className="min-w-0 flex-1 bg-transparent text-body outline-none"
        />
        <CornerDownLeft size={16} strokeWidth={1.5} className="shrink-0 text-muted" />
      </label>
      <p className="px-[0.9rem] pt-[0.5rem] pb-[0.4rem] text-meta text-muted">Ändert nichts, bevor du die Vorschau annimmst</p>
    </div>
  );
});

// --- Diff / Vorschau (Screen 3) -------------------------------------------

export type PreviewMode = "changes" | "result" | "original";

export function DiffText({ parts }: { parts: DiffPart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.type === "equal" ? (
          <span key={index}>{part.text}</span>
        ) : (
          <span key={index} className={part.type === "delete" ? "diff-del" : "diff-ins"}>
            {part.text}
          </span>
        ),
      )}
    </>
  );
}

export interface PreviewState {
  status: "loading" | "streaming" | "done" | "error";
  original: string;
  result: string;
  error?: string;
}

/** Inhalt der umrandeten Box je nach Modus */
export function PreviewBody({ state, mode, parts }: { state: PreviewState; mode: PreviewMode; parts: DiffPart[] }) {
  if (state.status === "loading") return <span className="thinking text-muted">{state.original}</span>;
  if (state.status === "error") return <span>{state.original}</span>;
  if (state.status === "streaming")
    return (
      <span>
        {state.result}
        <span className="thinking ml-[0.1em] inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-accent" />
      </span>
    );
  if (mode === "original") return <span>{state.original}</span>;
  if (mode === "result") return <span>{state.result}</span>;
  return <DiffText parts={parts} />;
}

export function PreviewPanel({
  title,
  subtitle,
  state,
  mode,
  onMode,
  onRegenerate,
  onDiscard,
  onAccept,
  acceptLabel = "Annehmen",
  discardLabel = "Verwerfen",
  extra,
  showModes = true,
  onOpenSettings,
}: {
  title: string;
  subtitle: string;
  state: PreviewState;
  mode: PreviewMode;
  onMode: (mode: PreviewMode) => void;
  onRegenerate: () => void;
  onDiscard: () => void;
  onAccept: () => void;
  acceptLabel?: string;
  discardLabel?: string;
  extra?: ReactNode;
  showModes?: boolean;
  onOpenSettings?: () => void;
}) {
  const busy = state.status === "loading" || state.status === "streaming";
  const noKey = state.status === "error" && /api.?key/i.test(state.error ?? "");
  return (
    <div className="appear rounded-[16px] border border-border bg-float px-[1.5rem] pt-[1.1rem] pb-[1.25rem] text-text shadow-float" data-preview-panel>
      <div className="flex items-start gap-[1rem]">
        <div className="min-w-0 flex-1">
          <h3 className="text-body leading-snug font-medium">{title}</h3>
          <p className={cx("text-meta", state.status === "error" ? "text-del" : "text-muted")}>
            {state.status === "error" ? state.error : busy ? "KI arbeitet …" : subtitle}
            {noKey && onOpenSettings && (
              <>
                {" · "}
                <button type="button" className="underline underline-offset-2" onClick={onOpenSettings}>
                  Einstellungen öffnen
                </button>
              </>
            )}
          </p>
        </div>
        {showModes && (
          <Segmented
            label="Ansicht"
            size="sm"
            value={mode}
            onChange={onMode}
            options={[
              { value: "changes", label: "Änderungen" },
              { value: "result", label: "Ergebnis" },
              { value: "original", label: "Original" },
            ]}
          />
        )}
        <button
          type="button"
          aria-label="Neu generieren"
          title="Neu generieren"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRegenerate}
          className="flex size-9 shrink-0 items-center justify-center rounded-small text-muted hover:bg-hover hover:text-text"
        >
          <RotateCw size={17} strokeWidth={1.5} />
        </button>
      </div>
      {extra}
      <div className="mt-[0.9rem] flex items-center gap-[0.75rem]">
        <Button onClick={onDiscard} className="rounded-full pr-[0.75rem]">
          {discardLabel} <Kbd>{kbd("esc")}</Kbd>
        </Button>
        <Button variant="primary" data-accept disabled={state.status !== "done"} onClick={onAccept} className="rounded-full pr-[0.75rem]">
          {acceptLabel} <KbdOnPrimary>↵</KbdOnPrimary>
        </Button>
      </div>
    </div>
  );
}

export function DiffLegend() {
  return (
    <div className="flex gap-[1.25rem] text-meta">
      <span className="diff-del">entfernt</span>
      <span className="diff-ins">eingefügt</span>
    </div>
  );
}

/**
 * ↵ = Annehmen, esc = Verwerfen, solange eine Vorschau offen ist.
 * Fokus auf einem anderen Button: ↵ löst diesen aus.
 */
export function previewKeyHandler(onAccept: () => void, onDiscard: () => void) {
  return (e: globalThis.KeyboardEvent) => {
    if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onDiscard();
    } else if (e.key === "Enter" && !e.shiftKey) {
      if (target instanceof HTMLButtonElement && !target.hasAttribute("data-accept")) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      e.stopPropagation();
      onAccept();
    }
  };
}
