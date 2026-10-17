import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildUrl, navigateBack, useRoute } from "@/app/router";
import { useSettings } from "@/app/settings";
import { useTheme } from "@/app/theme";
import { consumeHero } from "@/app/hero";
import { getPaletteForPoster } from "@/lib/palette";
import { getSoulmates, resolveEssay, type Soulmate } from "@/lib/essays";
import { TmdbError, getMovieDetails } from "@/lib/tmdb";
import { trailerUrl, useFilmAffinityId } from "@/lib/links";
import { readVisitedFilms, writeVisitedFilms } from "@/lib/seed";
import { MOODS, moodAffinityScore } from "@/lib/moods";
import {
  formatDate,
  formatMoney,
  formatRuntime,
  formatScore,
  truncate,
} from "@/lib/format";
import { LIMITS, STORAGE_KEYS } from "@/lib/constants";
import { imageSources } from "@/lib/images";
import { withAlpha } from "@/lib/colors";
import type { CatalogItem, Essay, Palette, TmdbMovieDetails } from "@/lib/types";
import { DetailSkeleton } from "@/components/ui/Skeleton";
import { ExternalLink } from "@/components/Link";
import { ChromaticAnalysis } from "@/components/detail/ChromaticAnalysis";
import { CreditsStrip } from "@/components/detail/CreditsStrip";
import { ExternalLinksRow } from "@/components/detail/ExternalLinks";
import { SimilarRow } from "@/components/detail/SimilarRow";
import { Soulmates } from "@/components/detail/Soulmates";
import { StillsGallery } from "@/components/detail/StillsGallery";
import { AffinityGraph } from "@/components/graph/AffinityGraph";
import {
  IconAperture,
  IconArrowLeft,
  IconCalendar,
  IconClock,
  IconExpand,
  IconPlay,
  IconStar,
} from "@/components/ui/Icons";

export interface FilmDetailProps {
  id: number;
  onNotify: (message: string, kind?: "info" | "success" | "error", detail?: string) => void;
  onOpenSettings: () => void;
  onActiveFilm: (id: number | null, title: string) => void;
  onProgress: (percent: number) => void;
}

function crewName(details: TmdbMovieDetails | null, job: string): string | null {
  const crew = details?.credits?.crew ?? [];
  return crew.find((member) => member.job === job)?.name ?? null;
}

export function FilmDetail({ id, onNotify, onOpenSettings, onActiveFilm, onProgress }: FilmDetailProps) {
  const route = useRoute();
  const { settings, hasTmdbCredentials, reducedMotion } = useSettings();
  const { setPalette, clearPalette } = useTheme();

  const [details, setDetails] = useState<TmdbMovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posterPalette, setPosterPalette] = useState<Palette | null>(null);
  const [soulmates, setSoulmates] = useState<Soulmate[]>([]);
  const [soulmatesLoading, setSoulmatesLoading] = useState(true);
  const [essays, setEssays] = useState<(Essay | null)[]>([]);
  const [heroDone, setHeroDone] = useState(false);
  const [similarPalettes, setSimilarPalettes] = useState<Map<number, CatalogItem>>(new Map());

  const posterRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef(consumeHero(id));
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const activeFilmRef = useRef(onActiveFilm);
  activeFilmRef.current = onActiveFilm;
  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  const filmAffinityId = useFilmAffinityId(
    details?.title ?? "",
    details?.release_date ? Number(details.release_date.slice(0, 4)) || null : null,
    details?.original_title,
  );

  /* ------------------------------ datos ------------------------------ */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetails(null);
    setPosterPalette(null);
    setSoulmates([]);
    setEssays([]);
    setSoulmatesLoading(true);
    setSimilarPalettes(new Map());
    setHeroDone(false);
    heroRef.current = consumeHero(id);
    progressRef.current(8);

    void (async () => {
      try {
        const data = await getMovieDetails(id, settings.language);
        if (cancelled) return;
        if (!data) {
          setDetails(null);
          setLoading(false);
          progressRef.current(100);
          return;
        }
        setDetails(data);
        setLoading(false);
        progressRef.current(60);

        const palette = await getPaletteForPoster(data.poster_path);
        if (cancelled) return;
        if (palette) {
          setPosterPalette(palette);
          setPalette(palette);
        }
        progressRef.current(100);
      } catch (caught) {
        if (cancelled) return;
        setLoading(false);
        setError(
          caught instanceof TmdbError
            ? caught.status === 0
              ? caught.message
              : `TMDB ${caught.status}: ${caught.message}`
            : "No se pudo abrir la ficha.",
        );
        progressRef.current(100);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, settings.language, setPalette]);

  /* --------------------- historial + metadatos ----------------------- */
  useEffect(() => {
    if (!details) return;
    const visited = readVisitedFilms();
    const next = [details.id, ...visited.filter((entry) => entry !== details.id)].slice(0, 400);
    writeVisitedFilms(next);
    try {
      localStorage.setItem(STORAGE_KEYS.lastRoute, buildUrl(`/film/${details.id}`));
    } catch {
      /* almacenamiento no disponible */
    }
    activeFilmRef.current(details.id, details.title ?? "");
    const year = details.release_date ? details.release_date.slice(0, 4) : "";
    document.title = `${details.title ?? "Ficha"}${year ? ` (${year})` : ""} · Cinemateca Sensorial`;
    const description = truncate(details.overview ?? details.tagline ?? "", 158);
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description || "Deep dive sensorial de la película en Cinemateca Sensorial.";
  }, [details]);

  useEffect(() => {
    return () => {
      clearPalette();
      document.title = "Cinemateca Sensorial — Explorador de cine por esencia";
    };
  }, [clearPalette]);

  /* ------------------------ transición de héroe ---------------------- */
  useEffect(() => {
    const snapshot = heroRef.current;
    if (!snapshot || loading || !details || !posterRef.current) {
      setHeroDone(true);
      return;
    }
    if (reducedMotion || !settings.heavyAnimations) {
      setHeroDone(true);
      return;
    }

    const target = posterRef.current.getBoundingClientRect();
    const source = imageSources({ path: details.poster_path, kind: "poster", quality: settings.imageQuality });
    if (!source.jpeg) {
      setHeroDone(true);
      return;
    }

    const clone = document.createElement("div");
    clone.setAttribute("aria-hidden", "true");
    clone.style.cssText = [
      "position:fixed",
      `top:${snapshot.top}px`,
      `left:${snapshot.left}px`,
      `width:${snapshot.width}px`,
      `height:${snapshot.height}px`,
      "z-index:75",
      "pointer-events:none",
      "border-radius:3px",
      "overflow:hidden",
      "background:#0a0a0c",
      `box-shadow:0 40px 90px -40px ${withAlpha(posterPalette?.accentHex ?? "#c9a227", 0.9)}`,
    ].join(";");
    const image = document.createElement("img");
    image.src = source.jpeg;
    image.alt = "";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
    clone.appendChild(image);
    document.body.appendChild(clone);

    const dx = target.left - snapshot.left;
    const dy = target.top - snapshot.top;
    const sx = target.width / Math.max(1, snapshot.width);
    const sy = target.height / Math.max(1, snapshot.height);

    const veil = document.createElement("div");
    veil.setAttribute("aria-hidden", "true");
    veil.style.cssText =
      "position:fixed;inset:0;z-index:74;background:#000;opacity:0;pointer-events:none;transition:opacity 420ms cubic-bezier(0.22,1,0.36,1)";
    document.body.appendChild(veil);
    window.requestAnimationFrame(() => {
      veil.style.opacity = "0.55";
    });

    const animation = clone.animate(
      [
        { transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`, opacity: 1 },
      ],
      { duration: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );

    const finish = () => {
      animation.cancel();
      clone.remove();
      veil.style.opacity = "0";
      window.setTimeout(() => veil.remove(), 460);
      setHeroDone(true);
    };
    animation.onfinish = finish;
    animation.oncancel = finish;
    const safety = window.setTimeout(finish, 1400);

    return () => {
      window.clearTimeout(safety);
      animation.cancel();
      clone.remove();
      veil.remove();
    };
  }, [loading, details, reducedMotion, settings.heavyAnimations, settings.imageQuality, posterPalette, id]);

  /* -------------------------- motor sensorial ------------------------- */
  useEffect(() => {
    if (!details || !posterPalette) return;
    let cancelled = false;
    setSoulmatesLoading(true);
    void getSoulmates(details, posterPalette)
      .then((result) => {
        if (cancelled) return;
        setSoulmates(result);
        setSoulmatesLoading(false);
      })
      .catch(() => {
        if (!cancelled) setSoulmatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [details, posterPalette]);

  useEffect(() => {
    if (!details || !posterPalette || soulmates.length === 0) return;
    const controller = new AbortController();
    const source = soulmates.length
      ? {
          id: details.id,
          title: details.title ?? "",
          year: details.release_date ? Number(details.release_date.slice(0, 4)) || null : null,
          overview: details.overview ?? "",
          tagline: details.tagline ?? null,
          runtime: details.runtime ?? null,
          rating: details.vote_average ?? 0,
          keywords: details.keywords?.keywords ?? [],
          genres: details.genres ?? [],
          palette: posterPalette,
          family: posterPalette.dominantFamily,
          director: crewName(details, "Director"),
          cinematographer: crewName(details, "Director of Photography"),
          posterPath: details.poster_path ?? null,
        }
      : null;
    if (!source) return;

    setEssays(new Array(Math.min(3, soulmates.length)).fill(null));
    soulmates.slice(0, 3).forEach((soulmate, index) => {
      void resolveEssay(source, soulmate, settings, controller.signal)
        .then(({ essay }) => {
          setEssays((current) => {
            const next = [...current];
            next[index] = essay;
            return next;
          });
        })
        .catch(() => undefined);
    });

    return () => controller.abort();
  }, [details, posterPalette, soulmates, settings]);

  /* --------------------- paletas de la vecindad ----------------------- */
  useEffect(() => {
    if (!details) return;
    const pool = [...(details.similar?.results ?? []), ...(details.recommendations?.results ?? [])].filter(
      (movie) => Boolean(movie.poster_path),
    );
    let cancelled = false;
    const queue = pool.slice(0, 14);
    let index = 0;
    const step = async () => {
      while (index < queue.length && !cancelled) {
        const movie = queue[index];
        index += 1;
        const palette = await getPaletteForPoster(movie.poster_path).catch(() => null);
        if (cancelled) return;
        const item: CatalogItem = {
          id: movie.id,
          title: movie.title ?? "",
          originalTitle: movie.original_title ?? movie.title ?? "",
          overview: movie.overview ?? "",
          posterPath: movie.poster_path ?? null,
          backdropPath: movie.backdrop_path ?? null,
          year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
          releaseDate: movie.release_date ?? null,
          rating: movie.vote_average ?? 0,
          voteCount: movie.vote_count ?? 0,
          genreIds: movie.genre_ids ?? [],
          popularity: movie.popularity ?? 0,
          family: palette?.dominantFamily ?? null,
          palette,
        };
        setSimilarPalettes((current) => new Map(current).set(item.id, item));
      }
    };
    void step();
    return () => {
      cancelled = true;
    };
  }, [details]);

  /* ------------------------------ estados ----------------------------- */
  const matchedMoods = useMemo(() => {
    if (!details) return [];
    return MOODS.map((mood) => ({ mood, score: moodAffinityScore(details.genre_ids ?? details.genres?.map((g) => g.id), mood) }))
      .filter((entry) => entry.score >= 0.34)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [details]);

  const stills = useMemo(() => details?.images?.stills ?? [], [details]);
  const backdrops = useMemo(() => (details?.images?.backdrops ?? []).slice(0, LIMITS.backdrops), [details]);
  const trailer = useMemo(() => trailerUrl(details?.videos), [details]);
  const year = details?.release_date ? Number(details.release_date.slice(0, 4)) || null : null;

  const handleNotify = useCallback(
    (message: string, kind: "info" | "success" | "error" = "info", detail?: string) => {
      notifyRef.current(message, kind, detail);
    },
    [],
  );

  if (loading) return <DetailSkeleton />;

  if (!details) {
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-center px-6 pb-28 pt-[22vh] text-center">
        <span className="text-[#7e7e88]">
          <IconAperture size={34} />
        </span>
        <p className="type-eyebrow mt-8 text-[9px]">Ficha no localizada</p>
        <h1 className="type-display mt-4 text-[clamp(28px,5vw,48px)] text-[#f4f1ea]">
          El identificador {id} no existe en el índice
        </h1>
        <p className="type-body mt-6 max-w-[54ch]">
          {error ??
            (hasTmdbCredentials
              ? "TMDB no devolvió ninguna película con ese ID. Puede que se haya fusionado con otra ficha."
              : "Sin credenciales TMDB solo están disponibles las fichas precargadas en el build.")}
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigateBack("/")}
            className="group flex items-center gap-2.5 rounded-[2px] bg-[color:var(--accent)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-black transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:gap-4"
          >
            <IconArrowLeft size={13} />
            Volver a la cartelera
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="hairline rounded-[2px] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d9d5cc] transition-colors duration-300 hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
          >
            Revisar credenciales
          </button>
        </div>
      </div>
    );
  }

  const poster = imageSources({ path: details.poster_path, kind: "poster", quality: settings.imageQuality });
  const heroBackdrop = imageSources({
    path: details.backdrop_path ?? details.images?.backdrops?.[0]?.file_path ?? null,
    kind: "backdrop",
    quality: settings.imageQuality,
  });
  const accent = posterPalette?.accentHex ?? "#c9a227";

  const facts: { icon: typeof IconCalendar; label: string; value: string }[] = [
    { icon: IconCalendar, label: "Estreno", value: formatDate(details.release_date) },
    { icon: IconClock, label: "Duración", value: formatRuntime(details.runtime) },
    { icon: IconStar, label: "Valoración TMDB", value: `${formatScore(details.vote_average)} / 10` },
    {
      icon: IconAperture,
      label: "Producción",
      value:
        details.production_companies?.[0]?.name ??
        details.production_countries?.[0]?.name ??
        (details.original_language ?? "—").toUpperCase(),
    },
  ];

  return (
    <article className="relative" key={`${details.id}-${route.path}`}>
      {/* Fondo ambiental */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[82vh] overflow-hidden" aria-hidden="true">
        {heroBackdrop.jpeg ? (
          <img
            src={heroBackdrop.jpeg}
            alt=""
            fetchPriority="high"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full scale-105 object-cover opacity-[0.26]"
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.5) 38%, rgba(0,0,0,0.94) 78%, #000000 100%)",
          }}
        />
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ background: `radial-gradient(76% 56% at 22% 34%, ${withAlpha(accent, 0.18)} 0%, transparent 70%)` }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-[1560px] px-4 pb-10 pt-[86px] sm:px-8 sm:pt-[104px] lg:px-12">
        <button
          type="button"
          onClick={() => navigateBack("/")}
          className="group mb-8 flex items-center gap-2.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-[#8b8b95] transition-colors duration-300 hover:text-[color:var(--accent)]"
        >
          <span className="transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-x-1">
            <IconArrowLeft size={13} />
          </span>
          Volver a la cartelera
        </button>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          {/* ---------------------- columna del póster ---------------------- */}
          <div className="lg:sticky lg:top-[96px] lg:self-start">
            <div
              ref={posterRef}
              className="clip-poster relative w-full overflow-hidden rounded-[4px] bg-[#0a0a0c] transition-opacity duration-300"
              style={{
                aspectRatio: "2 / 3",
                opacity: heroDone ? 1 : 0,
                boxShadow: `0 60px 120px -60px ${withAlpha(accent, 0.9)}, 0 0 0 1px rgba(255,255,255,0.07)`,
              }}
            >
              {poster.jpeg ? (
                <picture className="absolute inset-0 block">
                  {poster.avif ? <source srcSet={poster.avif} type="image/avif" /> : null}
                  {poster.webp ? <source srcSet={poster.webp} type="image/webp" /> : null}
                  <img
                    src={poster.jpeg}
                    alt={`Póster de ${details.title}`}
                    width={500}
                    height={750}
                    fetchPriority="high"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </picture>
              ) : (
                <span className="absolute inset-0 grid place-items-center text-[#7e7e88]">
                  <IconAperture size={36} />
                </span>
              )}
              {posterPalette ? (
                <span className="absolute inset-x-0 bottom-0 flex h-[4px]" aria-hidden="true">
                  {posterPalette.colors.map((color) => (
                    <span key={color.hex} className="h-full flex-1" style={{ backgroundColor: color.hex }} />
                  ))}
                </span>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {trailer ? (
                <ExternalLink
                  href={trailer}
                  className="group flex items-center justify-center gap-2.5 rounded-[2px] px-5 py-3.5 font-mono text-[10px] uppercase tracking-[0.22em] text-black transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:gap-4"
                  style={{ backgroundColor: accent, boxShadow: `0 22px 60px -30px ${withAlpha(accent, 0.95)}` }}
                >
                  <IconPlay size={12} />
                  Ver tráiler
                </ExternalLink>
              ) : null}
              {stills.length + backdrops.length > 0 ? (
                <a
                  href="#galeria"
                  className="hairline flex items-center justify-center gap-2.5 rounded-[2px] px-5 py-3.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d9d5cc] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
                >
                  <IconExpand size={12} />
                  {stills.length + backdrops.length} fotogramas
                </a>
              ) : null}
            </div>

            <dl className="mt-7 flex flex-col gap-3.5 border-t border-white/6 pt-6">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-start gap-3">
                  <dt className="flex w-[112px] shrink-0 items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#7e7e88]">
                    <fact.icon size={11} />
                    {fact.label}
                  </dt>
                  <dd className="min-w-0 flex-1 font-serif text-[15px] leading-snug text-[#ddd8ce]">{fact.value}</dd>
                </div>
              ))}
              {details.budget && details.budget > 0 ? (
                <div className="flex items-start gap-3">
                  <dt className="flex w-[112px] shrink-0 items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#7e7e88]">
                    Presupuesto
                  </dt>
                  <dd className="type-mono flex-1 text-[12px] text-[#ddd8ce]">{formatMoney(details.budget)}</dd>
                </div>
              ) : null}
              {details.revenue && details.revenue > 0 ? (
                <div className="flex items-start gap-3">
                  <dt className="flex w-[112px] shrink-0 items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#7e7e88]">
                    Taquilla
                  </dt>
                  <dd className="type-mono flex-1 text-[12px] text-[#ddd8ce]">{formatMoney(details.revenue)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {/* ------------------------ columna narrativa ------------------------ */}
          <div className="min-w-0">
            {matchedMoods.length > 0 ? (
              <div className="mb-5 flex flex-wrap gap-2">
                {matchedMoods.map((entry) => (
                  <span
                    key={entry.mood.id}
                    className="rounded-full border px-3 py-[6px] font-mono text-[8.5px] uppercase tracking-[0.2em]"
                    style={{
                      borderColor: withAlpha(entry.mood.accent, 0.45),
                      color: entry.mood.accent,
                      backgroundColor: withAlpha(entry.mood.accent, 0.07),
                    }}
                    title={entry.mood.description}
                  >
                    {entry.mood.label} · {(entry.score * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            ) : null}

            <h1 className="type-display fade-rise text-[clamp(32px,5.6vw,68px)] text-[#f7f4ed] text-balance">
              {details.title}
            </h1>
            {details.original_title && details.original_title !== details.title ? (
              <p className="type-mono mt-3 text-[10px] uppercase tracking-[0.2em] text-[#7e7e88]">
                Título original · {details.original_title}
              </p>
            ) : null}
            {details.tagline ? (
              <p className="type-display mt-6 max-w-[46ch] text-[clamp(18px,2.2vw,26px)] italic leading-snug text-[#a8a399]">
                «{details.tagline}»
              </p>
            ) : null}

            {details.genres && details.genres.length > 0 ? (
              <div className="mt-7 flex flex-wrap items-center gap-2">
                {details.genres.map((genre) => (
                  <span
                    key={genre.id}
                    className="hairline rounded-full px-3 py-[6px] font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#8b8b95]"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            ) : null}

            {details.overview ? (
              <p className="type-body mt-8 max-w-[74ch] text-pretty text-[#c3beb3]">{details.overview}</p>
            ) : (
              <p className="type-body mt-8 max-w-[74ch] italic text-[#8a8a94]">
                TMDB no conserva sinopsis en {settings.language}. Consulta la ficha original en los enlaces externos.
              </p>
            )}

            <div className="mt-10">
              <ExternalLinksRow
                imdbId={details.imdb_id ?? details.external_ids?.imdb_id ?? null}
                title={details.title ?? ""}
                originalTitle={details.original_title ?? details.title ?? ""}
                year={year}
                tmdbId={details.id}
              />
              {!filmAffinityId ? (
                <p className="mt-3 max-w-[68ch] font-mono text-[8.5px] uppercase leading-relaxed tracking-[0.14em] text-[#7e7e88]">
                  FilmAffinity enlaza a su buscador con título y año. Para apuntar a la ficha exacta, configura un proxy
                  CORS en Ajustes → Avanzado o genera las semillas con `npm run seed` en tu CI.
                </p>
              ) : null}
            </div>

            {details.keywords?.keywords && details.keywords.keywords.length > 0 ? (
              <div className="mt-10 border-t border-white/6 pt-8">
                <p className="type-eyebrow mb-4 text-[9px]">Keywords profundas · tropos</p>
                <div className="flex flex-wrap gap-1.5">
                  {details.keywords.keywords.slice(0, 22).map((keyword) => (
                    <span
                      key={keyword.id}
                      className="rounded-[2px] border border-white/7 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[9px] lowercase tracking-[0.08em] text-[#8b8b95] transition-colors duration-300 hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
                    >
                      {keyword.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <CreditsStrip credits={details.credits ?? null} />

        <ChromaticAnalysis
          posterPalette={posterPalette}
          backdropPath={details.backdrop_path ?? details.images?.backdrops?.[0]?.file_path ?? null}
          onNotify={handleNotify}
        />

        <div id="grafo">
          <AffinityGraph
            centerId={details.id}
            centerTitle={details.title ?? ""}
            centerYear={year}
            centerPosterPath={details.poster_path}
            soulmates={soulmates}
            quality={settings.imageQuality}
          />
        </div>

        <Soulmates
          sourceTitle={details.title ?? ""}
          soulmates={soulmates}
          essays={essays}
          loading={soulmatesLoading}
          filmIds={soulmates.map((entry) => entry.fingerprint.id)}
        />

        <div id="galeria" className="scroll-mt-24">
          <StillsGallery title={details.title ?? ""} stills={stills} backdrops={backdrops} />
        </div>
      </div>

      <SimilarRow
        title="Se proyecta junto a"
        movies={[...(details.recommendations?.results ?? []), ...(details.similar?.results ?? [])]}
        palettes={similarPalettes}
      />
    </article>
  );
}
