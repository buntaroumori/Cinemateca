import { useCallback, useEffect, useRef, useState } from "react";
import { LIMITS } from "@/lib/constants";
import { MOOD_MAP } from "@/lib/moods";
import { discoverMovies, getTrending, toCatalogItem, TmdbError } from "@/lib/tmdb";
import { getPaletteForPoster } from "@/lib/palette";
import { loadSeedBundle } from "@/lib/seed";
import type { CatalogItem, ColorFamilyId, MoodId } from "@/lib/types";

export type SortMode = "essence" | "rating" | "recent" | "popularity" | "az";

export interface FeedFilters {
  mood: MoodId | null;
  year: number | null;
  decade: number | null;
  family: ColorFamilyId | null;
  sort: SortMode;
  /** Usa únicamente el catálogo precargado (modo sin credenciales). */
  seedOnly: boolean;
}

export interface FilmFeed {
  items: CatalogItem[];
  totalLoaded: number;
  page: number;
  totalPages: number;
  loading: boolean;
  refreshing: boolean;
  exhausted: boolean;
  error: string | null;
  analyzed: number;
  familyCounts: Partial<Record<ColorFamilyId, number>>;
  loadMore: () => void;
  reload: () => void;
  setFilters: (patch: Partial<FeedFilters>) => void;
  filters: FeedFilters;
}

const SORT_TO_TMDB: Record<SortMode, string | undefined> = {
  essence: undefined,
  rating: "vote_average.desc",
  recent: "primary_release_date.desc",
  popularity: "popularity.desc",
  az: "title.asc",
};

function sortByMode(items: CatalogItem[], sort: SortMode): CatalogItem[] {
  const copy = [...items];
  switch (sort) {
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating || b.voteCount - a.voteCount);
    case "recent":
      return copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.popularity - a.popularity);
    case "popularity":
      return copy.sort((a, b) => b.popularity - a.popularity);
    case "az":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "es"));
    case "essence":
    default:
      return copy.sort((a, b) => b.popularity * 0.35 + b.rating * 12 - (a.popularity * 0.35 + a.rating * 12));
  }
}

function mergeUnique(current: CatalogItem[], incoming: CatalogItem[]): CatalogItem[] {
  const seen = new Set(current.map((item) => item.id));
  const out = [...current];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Catálogo infinito: semilla estática (0 ms, sin red) + descubrimiento TMDB
 * paginado. Cada póster se analiza cromáticamente en segundo plano para
 * alimentar el filtro por color dominante y los glows de la cuadrícula.
 */
export function useFilmFeed(initial: FeedFilters, hasCredentials: boolean): FilmFeed {
  const [filters, setFiltersState] = useState<FeedFilters>(initial);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(0);

  const requestId = useRef(0);
  const busy = useRef(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const itemsRef = useRef<CatalogItem[]>([]);
  itemsRef.current = items;
  const analyzedRef = useRef(0);

  const analyzeItem = useCallback((item: CatalogItem): Promise<CatalogItem> => {
    if (item.palette || !item.posterPath) return Promise.resolve(item);
    return getPaletteForPoster(item.posterPath).then((palette) =>
      palette ? { ...item, palette, family: palette.dominantFamily } : item,
    );
  }, []);

  const analyzeBatch = useCallback(
    (batch: CatalogItem[]) => {
      const pending = batch.filter((item) => !item.palette && item.posterPath);
      if (pending.length === 0) return;
      let completed = 0;
      for (const item of pending) {
        void analyzeItem(item)
          .then((updated) => {
            if (!updated.palette) return;
            setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
          })
          .catch(() => undefined)
          .finally(() => {
            completed += 1;
            analyzedRef.current += 1;
            setAnalyzed(analyzedRef.current);
          });
      }
    },
    [analyzeItem],
  );

  const fetchPage = useCallback(
    async (targetPage: number, reset: boolean) => {
      const id = ++requestId.current;
      busy.current = true;
      if (reset) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const active = filtersRef.current;
      try {
        let incoming: CatalogItem[] = [];
        let nextTotalPages = 1;
        const fastHome = !active.mood && targetPage === 1 && !active.year && !active.decade;

        // La semilla precargada aporta contenido instantáneo (0 ms) también en
        // modo con credenciales: el descubrimiento en vivo la amplía después.
        let seedBase: CatalogItem[] = [];
        if (reset && !active.seedOnly) {
          const seed = await loadSeedBundle();
          const pool = active.mood
            ? (seed.moods.find((entry) => entry.id === active.mood)?.items ?? [])
            : fastHome
              ? seed.trending
              : [];
          seedBase = pool.map((movie) => toCatalogItem(movie));
        }

        if (reset && active.seedOnly) {
          const seed = await loadSeedBundle();
          const pool = active.mood
            ? (seed.moods.find((mood) => mood.id === active.mood)?.items ?? [])
            : seed.trending.length > 0
              ? seed.trending
              : seed.moods.flatMap((mood) => mood.items);
          // Las páginas de tendencias pueden solapar títulos: sin deduplicado
          // nacen claves React repetidas y nodos huérfanos en la rejilla.
          incoming = mergeUnique([], pool.map((movie) => toCatalogItem(movie)));
          nextTotalPages = 1;
        } else if (fastHome) {
          const [trending, discover] = await Promise.all([
            getTrending(1).catch(() => [] as Awaited<ReturnType<typeof getTrending>>),
            discoverMovies({ sortBy: SORT_TO_TMDB[active.sort], page: 1 }).catch(() => null),
          ]);
          if (id !== requestId.current) return;
          incoming = mergeUnique(
            trending.map((movie) => toCatalogItem(movie)),
            discover ? (discover.results ?? []).map((movie) => toCatalogItem(movie)) : [],
          );
          nextTotalPages = discover ? Math.min(discover.total_pages || 1, LIMITS.gridMaxPages) : 1;
        } else {
          const mood = active.mood ? MOOD_MAP[active.mood] : null;
          const result = await discoverMovies({
            mood,
            year: active.year,
            decade: active.decade,
            sortBy: SORT_TO_TMDB[active.sort] ?? mood?.sortBy,
            page: targetPage,
          });
          if (id !== requestId.current) return;
          incoming = (result.results ?? []).map((movie) => toCatalogItem(movie));
          nextTotalPages = Math.min(result.total_pages || 1, LIMITS.gridMaxPages);
        }

        if (id !== requestId.current) return;
        incoming = mergeUnique(seedBase, incoming);

        const merged = reset ? incoming : mergeUnique(itemsRef.current, incoming);
        setItems(sortByMode(merged, active.sort));
        setPage(targetPage);
        setTotalPages(nextTotalPages);
        setExhausted(incoming.length === 0 || targetPage >= nextTotalPages);
        setLoading(false);
        setRefreshing(false);
        analyzeBatch(incoming);
      } catch (caught) {
        if (id !== requestId.current) return;
        setError(
          caught instanceof TmdbError
            ? caught.status === 0
              ? caught.message
              : `TMDB ${caught.status}: ${caught.message}`
            : "No se pudo cargar la cartelera.",
        );
        setLoading(false);
        setRefreshing(false);
        setExhausted(true);
      } finally {
        if (id === requestId.current) busy.current = false;
      }
    },
    [analyzeBatch],
  );

  const setFilters = useCallback(
    (patch: Partial<FeedFilters>) => {
      const previous = filtersRef.current;
      const next = { ...previous, ...patch };
      filtersRef.current = next;
      setFiltersState(next);

      const structural =
        next.mood !== previous.mood ||
        next.year !== previous.year ||
        next.decade !== previous.decade ||
        next.sort !== previous.sort ||
        next.seedOnly !== previous.seedOnly;

      if (structural) {
        setItems([]);
        setPage(0);
        setExhausted(false);
        analyzedRef.current = 0;
        setAnalyzed(0);
        void fetchPage(1, true);
        return;
      }
      if (next.family !== previous.family) {
        void (async () => {
          const pending = itemsRef.current.filter((item) => !item.palette && item.posterPath);
          const resolved = await Promise.all(
            pending.map((item) => analyzeItem(item).catch(() => item)),
          );
          const byId = new Map(resolved.filter((item) => item.palette).map((item) => [item.id, item]));
          if (byId.size > 0) {
            setItems((current) => current.map((entry) => byId.get(entry.id) ?? entry));
          }
        })();
      }
    },
    [fetchPage, analyzeItem],
  );

  const loadMore = useCallback(() => {
    if (busy.current || exhausted || filtersRef.current.seedOnly) return;
    if (page >= totalPages) return;
    void fetchPage(page + 1, false);
  }, [exhausted, page, totalPages, fetchPage]);

  const reload = useCallback(() => {
    setItems([]);
    setPage(0);
    setExhausted(false);
    void fetchPage(1, true);
  }, [fetchPage]);

  useEffect(() => {
    void fetchPage(1, true);
  }, [hasCredentials, fetchPage]);

  const visible = filters.family ? items.filter((item) => item.family === filters.family) : items;

  // Sin memoizar a propósito: el menú cromático y la rejilla deben derivar del
  // mismo array en el mismo render (colecciones acotadas: coste despreciable).
  const familyCounts: Partial<Record<ColorFamilyId, number>> = {};
  for (const item of items) {
    if (!item.family) continue;
    familyCounts[item.family] = (familyCounts[item.family] ?? 0) + 1;
  }

  return {
    items: visible,
    totalLoaded: items.length,
    familyCounts,
    page,
    totalPages,
    loading,
    refreshing,
    exhausted,
    error,
    analyzed,
    loadMore,
    reload,
    setFilters,
    filters,
  };
}

export function initialFilters(seedOnly = false): FeedFilters {
  return { mood: null, year: null, decade: null, family: null, sort: "essence", seedOnly };
}
