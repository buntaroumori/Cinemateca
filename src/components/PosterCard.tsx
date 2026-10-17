import { memo, useEffect, useRef, useState } from "react";
import { cx, formatScore } from "@/lib/format";
import { COLOR_FAMILY_MAP } from "@/lib/constants";
import { buildUrl } from "@/app/router";
import { useSettings } from "@/app/settings";
import type { CatalogItem } from "@/lib/types";
import { SmartImage } from "./ui/SmartImage";

export interface PosterCardProps {
  item: CatalogItem;
  index: number;
  eager?: boolean;
  onOpen: (item: CatalogItem, posterEl: HTMLElement | null) => void;
  registerRef?: (id: number, el: HTMLElement | null) => void;
  activeId?: number | null;
}

/**
 * Celda de la cuadrícula infinita. Expone `data-flip-key` para la animación de
 * reordenamiento y `data-poster-id` para la transición de héroe hacia la ficha.
 */
export const PosterCard = memo(function PosterCard({ item, index, eager = false, onOpen, registerRef, activeId }: PosterCardProps) {
  const { settings } = useSettings();
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const family = item.family ? COLOR_FAMILY_MAP[item.family] : null;
  const paletteColors = item.palette?.colors ?? [];
  const accent = item.palette?.accentHex ?? family?.hex ?? "#c9a227";

  useEffect(() => {
    registerRef?.(item.id, posterRef.current);
    return () => registerRef?.(item.id, null);
  }, [item.id, registerRef]);

  const open = () => onOpen(item, posterRef.current);

  return (
    <article
      data-flip-key={item.id}
      className="group relative flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <a
        href={buildUrl(`/film/${item.id}`)}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          open();
        }}
        className="relative block"
        aria-label={`Abrir la ficha de ${item.title}${item.year ? ` (${item.year})` : ""}`}
      >
        <span
          className="pointer-events-none absolute -inset-2 z-0 rounded-[6px] opacity-0 blur-[26px] transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-70"
          style={{ background: `radial-gradient(60% 55% at 50% 45%, ${accent}55 0%, transparent 72%)` }}
          aria-hidden="true"
        />
        <div
          ref={posterRef}
          data-poster-id={item.id}
          className={cx(
            "clip-poster relative z-[1] w-full overflow-hidden rounded-[3px] bg-[#0a0a0c] transition-[transform,box-shadow] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]",
            hovered ? "-translate-y-[6px] shadow-[0_38px_70px_-38px_rgba(0,0,0,1)]" : "translate-y-0",
            activeId === item.id ? "opacity-0" : "opacity-100",
          )}
          style={{ aspectRatio: "2 / 3" }}
        >
          <SmartImage
            path={item.posterPath}
            kind={index < 8 ? "poster" : "posterSmall"}
            quality={settings.imageQuality}
            alt={`Póster de ${item.title}`}
            width={342}
            height={513}
            sizes="(max-width: 640px) 40vw, (max-width: 1100px) 24vw, 190px"
            eager={eager}
            wrapperClassName="absolute inset-0"
            placeholderGradient={
              family
                ? `linear-gradient(165deg, ${family.hex}22 0%, rgba(0,0,0,0.94) 78%)`
                : undefined
            }
          />
          <span
            className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,transparent_46%,rgba(0,0,0,0.88)_100%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            aria-hidden="true"
          />
          {item.rating > 0 ? (
            <span className="pointer-events-none absolute right-2 top-2 z-[3] rounded-full border border-white/12 bg-black/70 px-2 py-[3px] font-mono text-[9px] tracking-[0.1em] text-[#e3dfd6] backdrop-blur-sm">
              {formatScore(item.rating)}
            </span>
          ) : null}
          {paletteColors.length > 0 ? (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] flex h-[3px] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              {paletteColors.map((color) => (
                <span key={color.hex} className="h-full flex-1" style={{ backgroundColor: color.hex }} />
              ))}
            </span>
          ) : null}
        </div>
      </a>

      <div className="relative z-[1] mt-3 flex flex-col gap-1 px-[1px]">
        <h3
          className={cx(
            "line-clamp-2 font-serif text-[15px] leading-[1.24] tracking-[0.005em] transition-colors duration-400",
            hovered ? "text-[#f4f1ea]" : "text-[#cfcbc2]",
          )}
        >
          {item.title}
        </h3>
        <p className="type-mono flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-[#7e7e88]">
          <span>{item.year ?? "s.a."}</span>
          {family ? (
            <>
              <span className="h-[3px] w-[3px] rounded-full bg-[#2f2f37]" />
              <span className="flex items-center gap-1.5">
                <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: family.hex }} />
                {family.label}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <button
        type="button"
        onClick={open}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-20 focus:rounded-[2px] focus:bg-black/85 focus:px-3 focus:py-2 focus:font-mono focus:text-[10px] focus:uppercase focus:tracking-[0.2em] focus:text-[color:var(--accent)]"
      >
        Ver {item.title}
      </button>
    </article>
  );
});
