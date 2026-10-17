import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildUrl, useRoute } from "@/app/router";
import { on } from "@/app/bus";
import { openFilmWithHero } from "@/app/hero";
import { useSettings } from "@/app/settings";
import { useTheme } from "@/app/theme";
import { initialFilters, useFilmFeed, type SortMode } from "@/hooks/useFilmFeed";
import { getPaletteForPoster } from "@/lib/palette";
import { loadSeedBundle } from "@/lib/seed";
import { MOODS } from "@/lib/moods";
import { APP_NAME } from "@/lib/constants";
import type { CatalogItem, ColorFamilyId, MoodId } from "@/lib/types";
import { FeaturedSpotlight } from "@/components/home/FeaturedSpotlight";
import { FilterBar } from "@/components/home/FilterBar";
import { Onboarding } from "@/components/home/Onboarding";
import { PosterGrid } from "@/components/home/PosterGrid";
import { IconAperture } from "@/components/ui/Icons";

export interface HomeProps {
  onOpenSettings: () => void;
  onProgress: (percent: number) => void;
  onActiveFilm: (id: number | null) => void;
}

function readFiltersFromQuery(search: URLSearchParams) {
  const moodParam = search.get("vibra");
  const mood = moodParam && MOODS.some((entry) => entry.id === moodParam) ? (moodParam as MoodId) : null;
  const yearParam = Number.parseInt(search.get("anio") ?? "", 10);
  const decadeParam = Number.parseInt(search.get("decada") ?? "", 10);
  const familyParam = search.get("color");
  const sortParam = search.get("orden") as SortMode | null;
  return {
    mood,
    year: Number.isFinite(yearParam) && yearParam > 1800 ? yearParam : null,
    decade: Number.isFinite(decadeParam) && decadeParam > 1800 ? Math.floor(decadeParam / 10) * 10 : null,
    family: familyParam && familyParam !== "null" ? (familyParam as ColorFamilyId) : null,
    sort: sortParam && ["essence", "rating", "recent", "popularity", "az"].includes(sortParam) ? sortParam : "essence",
  };
}

export function Home({ onOpenSettings, onProgress, onActiveFilm }: HomeProps) {
  const route = useRoute();
  const { settings, hasTmdbCredentials, reducedMotion } = useSettings();
  const { setPalette } = useTheme();
  const [seedInfo, setSeedInfo] = useState({ available: false, count: 0, loaded: false });
  const [forcedSeeds, setForcedSeeds] = useState(false);
  const filterBarRef = useRef<HTMLDivElement | null>(null);
  const appliedQuery = useRef(false);

  const fromQuery = useMemo(() => readFiltersFromQuery(route.query), [route.query]);
  const seedOnly = !hasTmdbCredentials;
  const feed = useFilmFeed(initialFilters(seedOnly), hasTmdbCredentials);

  /* --- carga del estado de las semillas --- */
  useEffect(() => {
    let cancelled = false;
    void loadSeedBundle().then((seed) => {
      if (cancelled) return;
      const count =
        seed.trending.length + seed.moods.reduce((total, mood) => total + mood.items.length, 0) + Object.keys(seed.films).length;
      setSeedInfo({ available: seed.available || count > 0, count, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* --- sincroniza filtros cuando la disponibilidad de semillas cambia --- */
  useEffect(() => {
    if (!seedInfo.loaded) return;
    if (!hasTmdbCredentials && !feed.filters.seedOnly) {
      feed.setFilters({ seedOnly: true });
    } else if (hasTmdbCredentials && feed.filters.seedOnly && !forcedSeeds) {
      feed.setFilters({ seedOnly: false });
    }
  }, [seedInfo.loaded, hasTmdbCredentials, forcedSeeds, feed]);

  /* --- aplica los filtros de la URL una sola vez --- */
  useEffect(() => {
    if (appliedQuery.current || !seedInfo.loaded) return;
    appliedQuery.current = true;
    const hasQueryFilters = fromQuery.mood || fromQuery.year || fromQuery.decade || fromQuery.family || fromQuery.sort !== "essence";
    if (hasQueryFilters) feed.setFilters(fromQuery);
  }, [fromQuery, seedInfo.loaded, feed]);

  /* --- refleja los filtros en la URL (enlaces compartibles) --- */
  useEffect(() => {
    const query: Record<string, string | number | undefined> = {
      vibra: feed.filters.mood ?? undefined,
      anio: feed.filters.year ?? undefined,
      decada: feed.filters.decade ?? undefined,
      color: feed.filters.family ?? undefined,
      orden: feed.filters.sort !== "essence" ? feed.filters.sort : undefined,
    };
    const target = buildUrl("/", query);
    const current = `${window.location.pathname}${window.location.search}`;
    if (target !== current) window.history.replaceState({ path: "/" }, "", target);
  }, [feed.filters]);

  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const activeFilmRef = useRef(onActiveFilm);
  activeFilmRef.current = onActiveFilm;

  useEffect(() => {
    const total = Math.max(1, feed.totalPages);
    progressRef.current(Math.min(100, (feed.page / total) * 100));
  }, [feed.page, feed.totalPages]);

  useEffect(() => {
    activeFilmRef.current(null);
  }, []);

  /* --- evento "Vibras" desde la cabecera --- */
  useEffect(
    () =>
      on("moods:reveal", () => {
        filterBarRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      }),
    [reducedMotion],
  );

  const handleOpen = useCallback(
    (item: CatalogItem, posterEl: HTMLElement | null) => {
      if (item.palette) setPalette(item.palette);
      else void getPaletteForPoster(item.posterPath).then((palette) => palette && setPalette(palette));
      openFilmWithHero(item.id, posterEl);
    },
    [setPalette],
  );

  const reset = useCallback(() => {
    setForcedSeeds(false);
    feed.setFilters({ ...initialFilters(seedOnly), sort: "essence" });
  }, [feed, seedOnly]);

  const showOnboarding = !hasTmdbCredentials && seedInfo.loaded && seedInfo.count === 0;
  const activeMood = feed.filters.mood ? MOODS.find((entry) => entry.id === feed.filters.mood) : null;

  if (showOnboarding) {
    return (
      <Onboarding
        onOpenSettings={onOpenSettings}
        onExploreSeeds={() => setForcedSeeds(true)}
        seedsAvailable={false}
        seedCount={0}
      />
    );
  }

  return (
    <div className="relative">
      <FeaturedSpotlight items={feed.items} onOpen={handleOpen} />

      <div className="mx-auto w-full max-w-[1680px] px-4 pb-10 sm:px-8 lg:px-12">
        <div ref={filterBarRef}>
          <FilterBar
            mood={feed.filters.mood}
            year={feed.filters.year}
            decade={feed.filters.decade}
            family={feed.filters.family}
            sort={feed.filters.sort}
            resultCount={feed.items.length}
            analyzed={feed.analyzed}
            familyCounts={feed.familyCounts}
            onMood={(mood) => feed.setFilters({ mood })}
            onYear={(year) => feed.setFilters({ year })}
            onDecade={(decade) => feed.setFilters({ decade })}
            onFamily={(family) => feed.setFilters({ family })}
            onSort={(sort) => feed.setFilters({ sort })}
            onReset={reset}
          />
        </div>

        {activeMood ? (
          <div className="fade-rise mb-10 flex flex-col gap-3 border-l border-[color:var(--accent-line)] pl-5">
            <p className="type-eyebrow text-[9px]" style={{ color: activeMood.accent }}>
              Vibra seleccionada
            </p>
            <h2 className="type-display text-[clamp(24px,3.4vw,40px)] text-[#f4f1ea]">{activeMood.label}</h2>
            <p className="type-body max-w-[70ch] text-[#a8a399]">{activeMood.description}</p>
          </div>
        ) : (
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="type-eyebrow text-[9px]">{APP_NAME}</p>
              <h2 className="type-display mt-2.5 text-[clamp(22px,3vw,34px)] text-[#eeeae1]">Cartelera sensorial</h2>
            </div>
            <p className="max-w-[46ch] font-mono text-[9.5px] uppercase leading-[1.9] tracking-[0.16em] text-[#7e7e88]">
              {feed.analyzed > 0
                ? `${feed.analyzed} pósters analizados · el filtro cromático se afina en vivo`
                : "Analizando la paleta de cada póster en tu navegador"}
            </p>
          </div>
        )}

        {feed.error ? (
          <div className="hairline mb-8 flex flex-col gap-3 rounded-[3px] bg-[#0c0c0e] px-5 py-5">
            <p className="type-eyebrow text-[9px] text-[#f0938a]">Incidencia</p>
            <p className="font-serif text-[17px] text-[#d9d5cc]">{feed.error}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={feed.reload}
                className="hairline rounded-[2px] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d9d5cc] transition-colors duration-300 hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-[2px] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8b8b95] transition-colors duration-300 hover:text-[#f4f1ea]"
              >
                Revisar credenciales
              </button>
            </div>
          </div>
        ) : null}

        {!hasTmdbCredentials && seedInfo.count > 0 ? (
          <div className="hairline mb-8 flex flex-col gap-3 rounded-[3px] bg-gradient-to-r from-[#0b0b0d] to-transparent px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[68ch] font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-[#8b8b95]">
              Estás viendo la colección sensorial precargada ({seedInfo.count} títulos). Conecta tu clave TMDB para
              acceder al índice mundial completo.
            </p>
            <button
              type="button"
              onClick={onOpenSettings}
              className="shrink-0 rounded-[2px] border border-[color:var(--accent-line)] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[color:var(--accent)] hover:text-black"
            >
              Conectar TMDB
            </button>
          </div>
        ) : null}

        <PosterGrid
          items={feed.items}
          loading={feed.loading}
          refreshing={feed.refreshing}
          exhausted={feed.exhausted}
          route={route}
          animationsEnabled={settings.heavyAnimations && !reducedMotion}
          activeFilmId={null}
          onLoadMore={feed.loadMore}
          onOpen={handleOpen}
          emptyState={
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="text-[#7e7e88]">
                <IconAperture size={30} />
              </span>
              <p className="type-display text-[26px] text-[#d9d5cc]">Ningún film con ese cromatismo… todavía</p>
              <p className="max-w-[52ch] font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-[#7e7e88]">
                El color dominante se extrae póster a póster. Desplázate para analizar más títulos o limpia el filtro
                cromático.
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-2 hairline rounded-[2px] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d9d5cc] transition-colors duration-300 hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
              >
                Limpiar filtros
              </button>
            </div>
          }
        />

        {!hasTmdbCredentials && seedInfo.count > 0 ? (
          <div className="mt-14 flex flex-col items-center gap-4 text-center">
            <p className="type-eyebrow text-[9px]">Colección precargada agotada</p>
            <p className="max-w-[56ch] font-serif text-[18px] italic leading-relaxed text-[#8b8b95]">
              El índice mundial espera al otro lado de una clave gratuita de TMDB.
            </p>
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-[2px] bg-[color:var(--accent)] px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-black transition-transform duration-400 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:scale-[1.03]"
            >
              Introducir mi clave
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
