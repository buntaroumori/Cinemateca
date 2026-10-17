import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "@/lib/format";
import { IconClose } from "./Icons";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  className?: string;
  variant?: "sheet" | "lightbox";
  children: ReactNode;
  /** Devuelve el foco al elemento que abrió la capa. */
  restoreFocusTo?: HTMLElement | null;
}

/**
 * Capa modal accesible: bloqueo de scroll, foco atrapado, cierre con Escape,
 * clic en el velo y botón explícito. `variant="lightbox"` elimina el cromo.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  className,
  variant = "sheet",
  children,
  restoreFocusTo,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.classList.add("no-scroll");
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
    target?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("no-scroll");
      restoreFocusTo?.focus({ preventScroll: true });
    };
  }, [open, restoreFocusTo]);

  if (!open) return null;

  return (
    <div
      className={cx(
        "fixed inset-0 z-[80] flex",
        variant === "lightbox" ? "items-center justify-center bg-black/96" : "items-stretch justify-center",
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy ?? titleId}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
        className="fade-in absolute inset-0 h-full w-full cursor-default bg-black/80 backdrop-blur-[14px]"
        style={{ opacity: variant === "lightbox" ? 0 : undefined }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cx(
          "relative z-10 outline-none",
          variant === "lightbox" ? "h-full w-full" : "fade-rise h-full w-full",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalCloseButton({ onClose, label = "Cerrar" }: { onClose: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className="hairline flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-[#9d9da7] transition-[color,border-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
    >
      <IconClose size={16} />
    </button>
  );
}
