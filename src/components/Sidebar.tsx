import { Clock, FileText, Pencil, Pin, Search, Settings, Sun, Trash2, Zap, type LucideIcon } from "lucide-react";
import { kbd } from "../lib/platform";
import type { Filter, NoteCounts } from "../lib/types";
import { cx, Kbd } from "./ui";

export const FILTER_LABELS: Record<Filter, string> = {
  all: "Alle Notizen",
  today: "Heute",
  last7: "Letzte 7 Tage",
  quick: "Schnell erfasst",
  pinned: "Angeheftet",
  trash: "Papierkorb",
};

export const NAV: { filter: Filter; icon: LucideIcon }[] = [
  { filter: "all", icon: FileText },
  { filter: "today", icon: Sun },
  { filter: "last7", icon: Clock },
  { filter: "quick", icon: Zap },
  { filter: "pinned", icon: Pin },
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("font-semibold tracking-[-0.01em] text-text", className)}>
      notiz<span className="text-accent">.</span>
    </span>
  );
}

function NavItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  shortcut,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cx(
        "flex h-[2.85rem] w-full items-center gap-[0.9rem] rounded-small px-[1.1rem] text-left text-body transition-colors",
        active ? "bg-hover font-medium text-text" : "text-text hover:bg-hover",
      )}
    >
      <Icon size={18} strokeWidth={1.5} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-meta font-normal text-muted tabular-nums">{count}</span>}
    </button>
  );
}

export function Sidebar({
  active,
  counts,
  onFilter,
  onNew,
  onSearch,
  onSettings,
}: {
  active: Filter | "search" | null;
  counts: NoteCounts | null;
  onFilter: (filter: Filter) => void;
  onNew: () => void;
  onSearch: () => void;
  onSettings: () => void;
}) {
  return (
    <aside className="flex h-full w-[18.75rem] shrink-0 flex-col px-[1rem] pt-[1.4rem] pb-[1rem]">
      <div className="flex h-[2.5rem] items-center justify-between pr-[0.4rem] pl-[0.75rem]">
        <Logo className="text-[1.25rem]" />
        <button
          type="button"
          onClick={onNew}
          aria-label="Neue Notiz"
          title={`Neue Notiz (${kbd("mod", "N")})`}
          className="flex size-9 items-center justify-center rounded-small text-text hover:bg-hover"
        >
          <Pencil size={18} strokeWidth={1.5} />
        </button>
      </div>

      <button
        type="button"
        onClick={onSearch}
        className={cx(
          "mt-[1rem] mb-[1rem] flex h-[3.4rem] w-full items-center gap-[0.8rem] rounded-control border border-border px-[1rem] text-left text-body text-muted transition-colors",
          active === "search" ? "bg-hover" : "bg-panel hover:bg-hover",
        )}
      >
        <Search size={18} strokeWidth={1.5} className="shrink-0" />
        <span className="flex-1 leading-tight">Suchen oder fragen</span>
        <Kbd>{kbd("mod", "K")}</Kbd>
      </button>

      <nav className="flex flex-col gap-[0.25rem]" aria-label="Filter">
        {NAV.map(({ filter, icon }, index) => (
          <NavItem
            key={filter}
            icon={icon}
            label={FILTER_LABELS[filter]}
            count={counts?.[filter]}
            active={active === filter}
            onClick={() => onFilter(filter)}
            shortcut={kbd("mod", String(index + 1))}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-[0.25rem]">
        <NavItem
          icon={Trash2}
          label="Papierkorb"
          active={active === "trash"}
          onClick={() => onFilter("trash")}
        />
        <NavItem icon={Settings} label="Einstellungen" active={false} onClick={onSettings} shortcut={kbd("mod", ",")} />
      </div>
    </aside>
  );
}
