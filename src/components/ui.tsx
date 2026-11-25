import type { ButtonHTMLAttributes, ReactNode } from "react";

export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

/** Shortcut-Badge: kleine Box mit Border, 12 px, grau */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-[1.4rem] min-w-[1.4rem] items-center justify-center rounded-[6px] border border-border px-[0.35rem] font-sans text-badge font-medium text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function IconButton({
  label,
  className,
  children,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-small text-muted transition-colors hover:bg-hover hover:text-text disabled:opacity-40",
        active && "text-accent hover:text-accent",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Segment-Toggle, voll rund (Karten | Liste, Änderungen | Ergebnis | Original) */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 rounded-full bg-hover p-[0.2rem]"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          // Fokus bleibt, wo er war (z. B. ↵ = Annehmen in der Vorschau)
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(option.value)}
          className={cx(
            "rounded-full transition-colors",
            size === "md" ? "px-[1.15rem] py-[0.4rem] text-label" : "px-[1rem] py-[0.3rem] text-[1rem]",
            option.value === value
              ? "bg-toggle text-text shadow-segment"
              : "text-muted hover:text-text",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex h-[2.6rem] shrink-0 items-center justify-center gap-[0.6rem] rounded-control px-[1.1rem] text-label font-medium transition-colors disabled:opacity-50",
        variant === "primary" && "bg-accent text-white hover:bg-accent-hover",
        variant === "secondary" && "border border-border bg-panel text-text hover:bg-hover",
        variant === "ghost" && "text-muted hover:bg-hover hover:text-text",
        variant === "danger" && "bg-del text-white hover:opacity-90",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Badge innerhalb eines blauen Buttons (↵) */
export function KbdOnPrimary({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[1.4rem] min-w-[1.6rem] items-center justify-center rounded-[6px] border border-white/40 px-[0.3rem] font-sans text-badge text-white/90">
      {children}
    </kbd>
  );
}
