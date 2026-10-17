import { useEffect } from "react";
import { isApplePlatform } from "@/lib/env";

export interface ShortcutHandlers {
  onSearch: () => void;
  onSettings: () => void;
  onClose: () => void;
  onHome: () => void;
  onBack: () => void;
  onForward: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

/**
 * Atajos globales:
 *   ⌘/Ctrl + K  → buscador omnímodo
 *   ⌘/Ctrl + ,  → panel de configuración
 *   Esc         → cerrar capa activa / retroceder
 *   g → h       → ir a la cartelera
 *   ←/→         → navegación entre películas visibles (fuera de campos de texto)
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const apple = isApplePlatform();
    let lastKey = "";
    let lastKeyAt = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      const mod = apple ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === "k") {
        event.preventDefault();
        handlers.onSearch();
        return;
      }
      if (mod && (key === "," || event.code === "Comma")) {
        event.preventDefault();
        handlers.onSettings();
        return;
      }
      if (key === "escape") {
        handlers.onClose();
        return;
      }
      if (isTypingTarget(event.target) || mod || event.altKey) return;

      const now = Date.now();
      if (lastKey === "g" && key === "h" && now - lastKeyAt < 900) {
        event.preventDefault();
        handlers.onHome();
        lastKey = "";
        return;
      }
      lastKey = key;
      lastKeyAt = now;

      if (key === "arrowleft") handlers.onBack();
      if (key === "arrowright") handlers.onForward();
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
