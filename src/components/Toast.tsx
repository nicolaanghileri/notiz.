import { Undo2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { kbd } from "../lib/platform";
import { cx } from "./ui";

export interface ToastOptions {
  message: string;
  /** „Rückgängig“: auch per ⌘Z, solange der Toast sichtbar ist */
  undo?: () => void;
  action?: { label: string; run: () => void };
  tone?: "info" | "error";
  duration?: number;
}

interface ToastApi {
  show: (options: ToastOptions) => void;
  hide: () => void;
  /** Führt das Rückgängig des sichtbaren Toasts aus. false, wenn keins da ist. */
  undo: () => boolean;
}

const ToastContext = createContext<ToastApi | null>(null);

export const useToast = () => useContext(ToastContext)!;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const current = useRef(toast);
  current.current = toast;
  const timer = useRef<number>(undefined);

  const hide = useCallback(() => setToast(null), []);

  const show = useCallback((options: ToastOptions) => {
    window.clearTimeout(timer.current);
    setToast({ ...options, key: Date.now() });
    const duration = options.duration ?? (options.tone === "error" ? 7000 : 5000);
    timer.current = window.setTimeout(() => setToast(null), duration);
  }, []);

  const undo = useCallback(() => {
    const undoFn = current.current?.undo;
    if (!undoFn) return false;
    setToast(null);
    undoFn();
    return true;
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ show, hide, undo }}>
      {children}
      {toast && (
        <div
          key={toast.key}
          role="status"
          className="appear pointer-events-auto fixed bottom-[2rem] left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-[1rem] rounded-full bg-toast py-[0.45rem] pr-[0.45rem] pl-[1.6rem] text-label text-white shadow-float"
          onMouseEnter={() => window.clearTimeout(timer.current)}
          onMouseLeave={() => {
            timer.current = window.setTimeout(() => setToast(null), 2500);
          }}
        >
          <span className={cx("py-[0.45rem]", toast.tone === "error" && "text-[#ffb4ae]")}>
            {toast.message}
          </span>
          {toast.undo && (
            <button
              type="button"
              onClick={undo}
              className="flex items-center gap-[0.55rem] rounded-full bg-white/10 px-[1.1rem] py-[0.45rem] hover:bg-white/20"
            >
              <Undo2 size={16} strokeWidth={2} />
              Rückgängig {kbd("mod", "Z")}
            </button>
          )}
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                setToast(null);
                toast.action!.run();
              }}
              className="rounded-full bg-white/10 px-[1.1rem] py-[0.45rem] hover:bg-white/20"
            >
              {toast.action.label}
            </button>
          )}
          {!toast.undo && !toast.action && <span className="w-[0.8rem]" />}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/** Fehlertext aus einem Tauri-Command (String) oder Error */
export const errorText = (error: unknown) =>
  typeof error === "string" ? error : error instanceof Error ? error.message : "Unbekannter Fehler";
