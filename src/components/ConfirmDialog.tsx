import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./ui";

/** Modaler Dialog auf Basis von <dialog>: Fokus bleibt drin, esc schliesst. */
export function Modal({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={
        "m-auto rounded-panel border border-border bg-float p-0 text-text shadow-float backdrop:bg-black/30 " + (className ?? "")
      }
    >
      {open && children}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-title" className="w-[26rem]">
      <div className="p-[1.75rem]">
        <h2 id="confirm-title" className="text-card-title font-semibold">
          {title}
        </h2>
        <p className="mt-[0.5rem] text-body text-muted">{message}</p>
        <div className="mt-[1.5rem] flex justify-end gap-[0.6rem]">
          <Button autoFocus onClick={onCancel}>
            Abbrechen
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
