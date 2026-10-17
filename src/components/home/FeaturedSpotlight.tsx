import { memo, useEffect, useMemo, useState } from "react";
import { cx, formatScore, truncate } from "@/lib/format";
import { withAlpha } from "@/lib/colors";
import { imageSources } from "@/lib/images";
import { toCatalogItem } from "@/lib/tmdb";
import { useSettings } from "@/app/settings";
import type { CatalogItem } from "@/lib/types";
import { IconArrowRight, IconPlay } from "../ui/Icons";

export interface FeaturedSpotlightProps {
  items: CatalogItem[];
  onOpen: (item: CatalogItem, posterEl: HTMLElement | null) => void;
}

const ROTATION_MS = 9000;

/**
 * Hero inyectado como JSON en el HTML durante el build (item TMDB en crudo del
 * primer film por «esencia»). Permite pintar la portada real en el primer
 * commit de React, sin esperar al catálogo: LCP mínimo y cero desplazamientos.
 */
function readInlineHero(): CatalogItem | null {
  if (typeof document === "undefined") return null;
  try {
    const node = document.getElementById("cinemateca-hero");
    const text = node?.textContent?.trim();
    if (!text) return null;
    return toCatalogItem(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * Portada editorial rotatoria: fondo a sangre con degradado, glow derivado de
 * la paleta extraída del póster y tipografía serif de gran cuerpo.
 */
export const FeaturedSpotlight = memo(function FeaturedSpotlight({ items, onOpen }: FeaturedSpotlightProps) {
  const { settings, reducedMotion } = useSettings();
  const inlineHero = useMemo(() => readInlineHero(), []);
  // Mientras el feed no llega, el hero inline sostiene la portada; en cuanto
  // hay items, el primero por «esencia» es exactamente el mismo film.
  const effective = items.length > 0 ? items : inlineHero ? [inlineHero] : [];
  const pool = effective.slice(0, 6);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (pool.length < 2 || reducedMotion || !settings.heavyAnimations) return;
    const timer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % pool.length);
        setVisible(true);
      }, 420);
    }, ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [pool.length, reducedMotion, settings.heavyAnimations]);

  const film = pool[index];
  if (!film) {
    /* Esqueleto con la geometría exacta del hero real (-mt y alto clamp idénticos):
       reserva el espacio para que la llegada de los datos no desplace la página (CLS 0). */
    return (
      <section
        className="relative -mt-[62px] w-full overflow-hidden sm:-mt-[70px]"
        aria-label="Película destacada"
        aria-busy="true"
      >
        <div className="relative h-[clamp(440px,72vh,760px)] w-full">
          <div className="shimmer absolute inset-0 overflow-hidden bg-[#0a0a0c]" aria-hidden="true" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.42) 34%, rgba(0,0,0,0.92) 82%, #000000 100%)",
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 mx-auto flex h-full w-full max-w-[1680px] flex-col justify-end px-5 pb-12 sm:px-8 lg:px-12 lg:pb-16">
            <div className="max-w-[720px]">
              <span className="shimmer block h-[9px] w-[190px] overflow-hidden rounded-[2px] bg-[#101013]" />
              <span className="shimmer mt-4 block h-[clamp(34px,6.4vw,74px)] w-3/4 overflow-hidden rounded-[2px] bg-[#101013]" />
              <span className="shimmer mt-6 block h-[13px] w-full max-w-[60ch] overflow-hidden rounded-[2px] bg-[#101013]" />
              <span className="shimmer mt-2 block h-[13px] w-2/3 max-w-[42ch] overflow-hidden rounded-[2px] bg-[#101013]" />
              <span className="shimmer mt-8 block h-[42px] w-[230px] overflow-hidden rounded-[999px] bg-[#101013]" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const backdrop = imageSources({
    path: film.backdropPath ?? film.posterPath,
    kind: "backdrop",
    quality: settings.imageQuality,
  });
  const accent = film.palette?.accentHex ?? "#c9a227";

  return (
    <section className="relative -mt-[62px] w-full overflow-hidden sm:-mt-[70px]" aria-label="Película destacada">
      <div className="relative h-[clamp(440px,72vh,760px)] w-full">
        {backdrop.jpeg ? (
          <img
            key={backdrop.jpeg}
            src={backdrop.jpeg}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            referrerPolicy="no-referrer"
            className={cx(
              "absolute inset-0 h-full w-full scale-[1.04] object-cover transition-opacity duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              visible ? "opacity-45" : "opacity-0",
            )}
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.42) 34%, rgba(0,0,0,0.92) 82%, #000000 100%)",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            opacity: visible ? 1 : 0,
            background: `radial-gradient(72% 52% at 18% 78%, ${withAlpha(accent, 0.2)} 0%, transparent 68%)`,
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[1680px] flex-col justify-end px-5 pb-12 sm:px-8 lg:px-12 lg:pb-16">
          <div className={cx("max-w-[720px] transition-all duration-[620ms] ease-[cubic-bezier(0.22,1,0.36,1)]", visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
            <p className="type-eyebrow flex flex-wrap items-center gap-3 text-[9px]">
              <span className="accent-text">En proyección</span>
              <span className="h-[3px] w-[3px] rounded-full bg-[#3a3a42]" />
              <span>{film.year ?? "s.a."}</span>
              {film.rating > 0 ? (
                <>
                  <span className="h-[3px] w-[3px] rounded-full bg-[#3a3a42]" />
                  <span className="type-mono">{formatScore(film.rating)} TMDB</span>
                </>
              ) : null}
              {film.palette ? (
                <>
                  <span className="h-[3px] w-[3px] rounded-full bg-[#3a3a42]" />
                  <span className="type-mono flex gap-1">
                    {film.palette.colors.slice(0, 5).map((color) => (
                      <span key={color.hex} className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: color.hex }} />
                    ))}
                  </span>
                </>
              ) : null}
            </p>

            <h1 className="type-display mt-4 text-[clamp(34px,6.4vw,74px)] text-[#f7f4ed] text-balance">{film.title}</h1>

            {film.overview ? (
              <p className="type-body mt-5 max-w-[60ch] text-[#b6b1a6]">{truncate(film.overview, 260)}</p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onOpen(film, null)}
                className="group flex items-center gap-3 rounded-[2px] px-6 py-3.5 font-mono text-[10px] uppercase tracking-[0.24em] text-black transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:gap-5"
                style={{ backgroundColor: accent, boxShadow: `0 22px 60px -28px ${withAlpha(accent, 0.95)}` }}
              >
                Deep dive
                <IconArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => onOpen(film, null)}
                className="hairline flex items-center gap-2.5 rounded-[2px] px-5 py-3.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#d9d5cc] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
              >
                <IconPlay size={12} />
                Abrir ficha
              </button>
            </div>
          </div>

          {pool.length > 1 ? (
            <div className="mt-10 flex items-center gap-2" role="tablist" aria-label="Películas destacadas">
              {pool.map((entry, dotIndex) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={dotIndex === index}
                  aria-label={`Destacada ${dotIndex + 1}: ${entry.title}`}
                  onClick={() => {
                    setIndex(dotIndex);
                    setVisible(true);
                  }}
                  className={cx(
                    "h-[2px] rounded-full transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    dotIndex === index ? "w-10 bg-[color:var(--accent)]" : "w-5 bg-white/18 hover:bg-white/35",
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
});
