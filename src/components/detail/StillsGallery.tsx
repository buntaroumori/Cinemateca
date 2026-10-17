import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { LIMITS } from "@/lib/constants";
import { imageSources, tmdbImageUrl } from "@/lib/images";
import { useSettings } from "@/app/settings";
import type { ImageQuality, TmdbImage } from "@/lib/types";
import { Modal } from "../ui/Modal";
import { IconChevronLeft, IconChevronRight, IconClose, IconExpand, IconFilm } from "../ui/Icons";

export interface StillsGalleryProps {
  title: string;
  stills: TmdbImage[];
  backdrops: TmdbImage[];
}

function sortImages(images: TmdbImage[]): TmdbImage[] {
  return [...images].sort((a, b) => {
    const scoreA = a.vote_average * 2 + Math.min(a.vote_count, 40) / 20;
    const scoreB = b.vote_average * 2 + Math.min(b.vote_count, 40) / 20;
    return scoreB - scoreA || b.width * b.height - a.width * a.height;
  });
}

function Lightbox({
  images,
  index,
  quality,
  title,
  onClose,
  onIndexChange,
}: {
  images: TmdbImage[];
  index: number;
  quality: ImageQuality;
  title: string;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const current = images[index];

  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + images.length) % images.length;
      onIndexChange(next);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!current) return null;
  const source = imageSources({ path: current.file_path, kind: "still", quality });

  return (
    <Modal open onClose={onClose} variant="lightbox">
      <div
        className="relative flex h-full w-full flex-col"
        onTouchStart={(event) => {
          touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          if (!start) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          else if (dy > 90) onClose();
          touchStart.current = null;
        }}
      >
        <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <p className="type-mono text-[10px] uppercase tracking-[0.22em] text-[#8b8b95]">
            {title} · fotograma {index + 1} / {images.length}
          </p>
          <div className="flex items-center gap-2">
            <span className="type-mono hidden text-[9.5px] uppercase tracking-[0.18em] text-[#7e7e88] sm:block">
              {current.width}×{current.height} · ← → · swipe
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar visor"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-[#9d9da7] transition-all duration-300 hover:rotate-90 hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
            >
              <IconClose size={16} />
            </button>
          </div>
        </header>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden px-3 pb-4 sm:px-10">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Fotograma anterior"
            className="absolute left-2 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-[#d9d5cc] backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)] sm:left-6"
          >
            <IconChevronLeft size={20} />
          </button>

          <picture key={current.file_path} className="fade-in relative flex max-h-full max-w-full items-center justify-center">
            {source.avif ? <source srcSet={source.avif} type="image/avif" /> : null}
            {source.webp ? <source srcSet={source.webp} type="image/webp" /> : null}
            <img
              src={source.jpeg ?? undefined}
              alt={`Fotograma de ${title}`}
              decoding="async"
              referrerPolicy="no-referrer"
              className="max-h-[74vh] w-auto max-w-full rounded-[2px] object-contain shadow-[0_50px_120px_-50px_rgba(0,0,0,1)]"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </picture>

          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Fotograma siguiente"
            className="absolute right-2 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-[#d9d5cc] backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)] sm:right-6"
          >
            <IconChevronRight size={20} />
          </button>
        </div>

        <footer className="hide-scrollbar flex gap-2 overflow-x-auto px-5 pb-5 sm:px-8">
          {images.slice(0, 40).map((image, thumbIndex) => {
            const thumb = tmdbImageUrl({ path: image.file_path, kind: "still", quality, size: "w185" });
            return (
              <button
                key={image.file_path}
                type="button"
                onClick={() => onIndexChange(thumbIndex)}
                aria-label={`Ver fotograma ${thumbIndex + 1}`}
                className={cx(
                  "relative h-[46px] w-[82px] shrink-0 overflow-hidden rounded-[2px] border transition-all duration-300",
                  thumbIndex === index ? "border-[color:var(--accent)] opacity-100" : "border-white/8 opacity-45 hover:opacity-80",
                )}
              >
                {thumb ? (
                  <img src={thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : null}
              </button>
            );
          })}
        </footer>
      </div>
    </Modal>
  );
}

/** Galería masonry de fotogramas con visor a pantalla completa. */
export const StillsGallery = memo(function StillsGallery({ title, stills, backdrops }: StillsGalleryProps) {
  const { settings } = useSettings();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const images = useMemo(() => {
    const combined = sortImages([...stills, ...backdrops]);
    const unique = new Map<string, TmdbImage>();
    for (const image of combined) unique.set(image.file_path, image);
    return [...unique.values()].slice(0, settings.reduceDataUsage ? Math.round(LIMITS.stills / 2) : LIMITS.stills);
  }, [stills, backdrops, settings.reduceDataUsage]);

  const mark = useCallback((path: string) => setRevealed((current) => ({ ...current, [path]: true })), []);

  if (images.length === 0) {
    return (
      <section className="border-t border-white/6 py-14">
        <p className="type-eyebrow mb-3 text-[9px]">Galería de fotogramas</p>
        <p className="max-w-[52ch] font-serif text-[17px] italic leading-relaxed text-[#8a8a94]">
          TMDB aún no conserva fotogramas de esta película. La ficha se apoya en su cartel y en su paleta cromática.
        </p>
      </section>
    );
  }

  const openAt = lightboxIndex === null ? null : images[lightboxIndex];

  return (
    <section className="border-t border-white/6 py-14" aria-labelledby="stills-title">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-eyebrow flex items-center gap-2 text-[9px]">
            <IconFilm size={12} />
            Galería de fotogramas
          </p>
          <h2 id="stills-title" className="type-display mt-3 text-[clamp(24px,3.2vw,38px)] text-[#f4f1ea]">
            El film por dentro
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="hairline flex items-center gap-2 rounded-[2px] px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#d9d5cc] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
        >
          <IconExpand size={12} />
          Ver a pantalla completa · {images.length}
        </button>
      </header>

      <div className="still-masonry">
        {images.map((image, index) => {
          const source = imageSources({ path: image.file_path, kind: "still", quality: settings.imageQuality });
          const revealedFlag = revealed[image.file_path] ?? false;
          const ratio = image.aspect_ratio > 0 ? image.aspect_ratio : 16 / 9;
          return (
            <figure key={image.file_path} className="relative overflow-hidden rounded-[3px] bg-[#0a0a0c]">
              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="group relative block w-full"
                aria-label={`Ampliar fotograma ${index + 1} de ${title}`}
                style={{ aspectRatio: `${ratio}` }}
              >
                <picture className="absolute inset-0 block">
                  {source.avif ? <source srcSet={source.avif} type="image/avif" /> : null}
                  {source.webp ? <source srcSet={source.webp} type="image/webp" /> : null}
                  <img
                    src={source.jpeg ?? undefined}
                    alt={`Fotograma de ${title}`}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onLoad={() => mark(image.file_path)}
                    className={cx(
                      "h-full w-full object-cover transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]",
                      revealedFlag ? "opacity-100" : "opacity-0",
                    )}
                  />
                </picture>
                <span
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(0,0,0,0.72)_100%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  aria-hidden="true"
                />
                <span className="pointer-events-none absolute bottom-2 right-2 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  <span className="type-mono rounded-full border border-white/12 bg-black/70 px-2 py-1 text-[8.5px] tracking-[0.12em] text-[#e3dfd6]">
                    {image.width}×{image.height}
                  </span>
                </span>
              </button>
            </figure>
          );
        })}
      </div>

      {openAt ? (
        <Lightbox
          images={images}
          index={lightboxIndex ?? 0}
          quality={settings.imageQuality}
          title={title}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </section>
  );
});
