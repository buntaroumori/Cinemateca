import { useCallback, useRef, useState } from "react";

export type ToastKind = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  detail?: string;
}

let nextId = 1;

export function useToasts(duration = 2400) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = "info", detail?: string) => {
      const id = nextId++;
      setToasts((current) => [...current.slice(-2), { id, message, kind, detail }]);
      const timer = window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        timers.current.delete(id);
      }, duration);
      timers.current.set(id, timer);
      return id;
    },
    [duration],
  );

  return { toasts, push, dismiss };
}
