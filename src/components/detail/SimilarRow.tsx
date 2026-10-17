import { memo, useCallback, useRef } from "react";
import { useSettings } from "@/app/settings";
import { openFilmWithHero } from "@/app/hero";
import { toCatalogItem } from "@/lib/tmdb";
import type { CatalogItem, TmdbMovieSummary } from "@/lib/types";
import { PosterCard } from "../PosterCard";
import { IconChevronLeft, IconChevronRight } from "../ui/Icons";

export interface SimilarRowProps {
  title: string;
  movies: TmdbMovieSummary[];
  palettes: Map<number, CatalogItem>;
}

/** Carrusel horizontal de vecindad con desplazamiento por rueda y teclado. */
export const SimilarRow = memo(function SimilarRow({ title, movies, palettes }: SimilarRowProps) {
  const { reducedMotion } = useSettings();
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = useCallback(
    (direction: number) => {
      const track = trackRef.current;
      if (!track) return;
      track.scrollBy({ left: direction * Math.max(320, track.clientWidth * 0.8), behavior: reducedMotion ? "auto" : "smooth" });
    },
    [reducedMotion],
  );

  const items = movies
    .filter((movie) => Boolean(movie.poster_path))
    .slice(0, 20)
    .map((movie) => palettes.get(movie.id) ?? toCatalogItem(movie));

  if (items.length === 0) return null;

  const handleOpen = useCallback((item: CatalogItem, posterEl: HTMLElement | null) => {
    openFilmWithHero(item.id, posterEl);
  }, []);

  return (
    <section className="border-t border-white/6 py-14" aria-labelledby="vecindad-title">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4 px-4 sm:px-8 lg:px-12">
        <div>
          <p className="type-eyebrow text-[9px]">Vecindad</p>
          <h2 id="vecindad-title" className="type-display mt-3 text-[clamp(22px,2.8vw,32px)] text-[#f4f1ea]">
            {title}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Desplazar a la izquierda"
            className="hairline flex h-9 w-9 items-center justify-center rounded-full text-[#9d9da7] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-x-[2px] hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
          >
            <IconChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Desplazar a la derecha"
            className="hairline flex h-9 w-9 items-center justify-center rounded-full text-[#9d9da7] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:translate-x-[2px] hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
          >
            <IconChevronRight size={15} />
          </button>
        </div>
      </header>

      <div
        ref={trackRef}
        tabIndex={0}
        role="group"
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") scrollBy(1);
          if (event.key === "ArrowLeft") scrollBy(-1);
        }}
        className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-3 sm:px-8 lg:px-12"
      >
        {items.map((item, index) => (
          <div key={item.id} className="w-[148px] shrink-0 snap-start sm:w-[176px]">
            <PosterCard item={item} index={index + 40} onOpen={handleOpen} />
          </div>
        ))}
      </div>
    </section>
  );
});
