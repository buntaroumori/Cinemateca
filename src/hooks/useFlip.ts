import { useEffect, useRef, type RefObject } from "react";
import type { Route } from "@/lib/types";

const SPRING_EASING = "cubic-bezier(0.34, 1.42, 0.5, 1)";

/**
 * FLIP (First-Last-Invert-Play) con curva elástica: al cambiar el orden de la
 * rejilla, cada póster vuela desde su posición anterior a la nueva a 60 fps,
 * sin recalcular layout más de dos veces por transición.
 */
export function useFlipList<T>({
  containerRef,
  items,
  keyOf,
  route,
  enabled = true,
  duration = 560,
}: {
  containerRef: RefObject<HTMLElement | null>;
  items: T[];
  keyOf: (item: T) => string | number;
  route: Route;
  enabled?: boolean;
  duration?: number;
}) {
  const first = useRef<Map<string | number, DOMRect>>(new Map());
  const signature = useRef<string>("");
  const entered = useRef<Set<string | number>>(new Set());

  const nextSignature = `${route.path}|${items.map(keyOf).join(",")}`;
  if (signature.current !== nextSignature) {
    const node = containerRef.current;
    first.current.clear();
    if (node && enabled) {
      const children = node.querySelectorAll<HTMLElement>("[data-flip-key]");
      children.forEach((child) => {
        const key = child.dataset.flipKey;
        if (!key) return;
        first.current.set(key, child.getBoundingClientRect());
      });
    }
    signature.current = nextSignature;
  }

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !enabled) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const children = Array.from(node.querySelectorAll<HTMLElement>("[data-flip-key]"));
    const animations: Animation[] = [];

    for (const child of children) {
      const key = child.dataset.flipKey;
      if (!key) continue;
      const before = first.current.get(key);
      const after = child.getBoundingClientRect();

      if (before) {
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6) continue;
        const animation = child.animate(
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.972)`, opacity: 0.82 },
            { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
          ],
          { duration, easing: SPRING_EASING, fill: "none" },
        );
        animations.push(animation);
      } else if (!entered.current.has(key)) {
        entered.current.add(key);
        const animation = child.animate(
          [
            { opacity: 0, transform: "translate3d(0, 16px, 0) scale(0.96)", filter: "blur(6px)" },
            { opacity: 1, transform: "none", scale: 1, filter: "blur(0px)" },
          ],
          { duration: Math.round(duration * 0.85), easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "none" },
        );
        animations.push(animation);
      }
    }

    first.current.clear();
    return () => {
      for (const animation of animations) animation.cancel();
    };
  });
}
