import { memo, useRef } from "react";
import { useFlipList } from "@/hooks/useFlip";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import type { Route } from "@/lib/types";
import type { CatalogItem } from "@/lib/types";
import { PosterCard } from "@/components/PosterCard";
import { GridSkeleton } from "../ui/Skeleton";
import { IconLoader } from "../ui/Icons";

export interface PosterGridProps {
  items: CatalogItem[];
  loading: boolean;
  refreshing: boolean;
  exhausted: boolean;
  route: Route;
  animationsEnabled: boolean;
  activeFilmId: number | null;
  onLoadMore: () => void;
  onOpen: (item: CatalogItem, posterEl: HTMLElement | null) => void;
  emptyState?: React.ReactNode;
}

export const PosterGrid = memo(function PosterGrid({
  items,
  loading,
  refreshing,
  exhausted,
  route,
  animationsEnabled,
  activeFilmId,
  onLoadMore,
  onOpen,
  emptyState,
}: PosterGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const sentinel = useInfiniteScroll({
    enabled: !loading && !exhausted && items.length > 0,
    onLoadMore,
    rootMargin: "1200px 0px",
  });

  useFlipList({
    containerRef: gridRef,
    items,
    keyOf: (item) => item.id,
    route,
    enabled: animationsEnabled,
    duration: 620,
  });

  if (loading && items.length === 0) {
    return (
      <div className="fade-in">
        <GridSkeleton count={24} />
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return <div className="fade-rise py-20">{emptyState ?? null}</div>;
  }

  return (
    <div>
      <div ref={gridRef} className="poster-grid">
        {items.map((item, index) => (
          <PosterCard
            key={item.id}
            item={item}
            index={index}
            eager={index < 6}
            activeId={activeFilmId}
            onOpen={onOpen}
          />
        ))}
      </div>

      <div ref={sentinel} className="h-px w-full" aria-hidden="true" />

      <div className="mt-12 flex h-16 items-center justify-center">
        {refreshing ? (
          <span className="flex items-center gap-3">
            <span className="pulse-soft accent-text">
              <IconLoader size={14} />
            </span>
            <span className="type-eyebrow text-[9px]">Cargando más metraje</span>
          </span>
        ) : exhausted && items.length > 0 ? (
          <span className="type-eyebrow text-[9px] text-[#7e7e88]">
            Fin del rollo · {items.length} títulos proyectados
          </span>
        ) : null}
      </div>
    </div>
  );
});
