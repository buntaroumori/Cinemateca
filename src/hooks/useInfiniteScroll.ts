import { useEffect, useRef } from "react";

export interface InfiniteScrollOptions {
  enabled: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

/** Observa un centinela al final de la rejilla y dispara la página siguiente. */
export function useInfiniteScroll({ enabled, onLoadMore, rootMargin = "800px 0px" }: InfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onLoadMore);
  callbackRef.current = onLoadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) callbackRef.current();
        }
      },
      { root: null, rootMargin, threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
