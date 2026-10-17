import { memo } from "react";
import { cx } from "@/lib/format";
import type { ToastItem } from "@/app/useToasts";
import { IconAlert, IconCheck, IconInfo } from "./Icons";

export interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const KIND_STYLE: Record<ToastItem["kind"], { ring: string; icon: typeof IconInfo }> = {
  info: { ring: "border-white/12", icon: IconInfo },
  success: { ring: "border-[color:var(--accent-line)]", icon: IconCheck },
  error: { ring: "border-[#e2483d]/45", icon: IconAlert },
};

export const ToastViewport = memo(function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-4 pb-[max(18px,env(safe-area-inset-bottom))] sm:items-end sm:px-8"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => {
        const style = KIND_STYLE[toast.kind];
        const Icon = style.icon;
        return (
          <button
            key={toast.id}
            type="button"
            onClick={() => onDismiss(toast.id)}
            className={cx(
              "scale-in pointer-events-auto glass flex max-w-[92vw] items-start gap-3 rounded-[3px] border px-4 py-3 text-left",
              style.ring,
            )}
            style={{ boxShadow: "0 24px 60px -30px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03) inset" }}
          >
            <span className="mt-[2px] accent-text">
              <Icon size={15} />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[10.5px] uppercase tracking-[0.28em] text-[#d9d5cc]">
                {toast.message}
              </span>
              {toast.detail ? (
                <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[#8a8a94]">
                  {toast.detail}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
});
