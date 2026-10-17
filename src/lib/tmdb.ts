import { cacheGet, cacheSet, dedupe } from "./cache";
import { LIMITS, STORAGE_KEYS, TTL_MS, TMDB_API_BASE } from "./constants";
import { normalize } from "./fuzzy";
import { runPool } from "./pool";
import { loadSeedBundle } from "./seed";
import type {
  CatalogItem,
  MoodDefinition,
  TmdbCredits,
  TmdbExternalIds,
  TmdbGenre,
  TmdbImagesWithStills,
  TmdbKeyword,
  TmdbMovieDetails,
  TmdbMovieSummary,
  TmdbPage,
} from "./types";
import { yearOf } from "./format";

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

export interface RuntimeCredentials {
  apiKey: string;
  readToken: string;
  language: string;
  corsProxy: string;
}

let credentials: RuntimeCredentials = {
  apiKey: "",
  readToken: "",
  language: "es-ES",
  corsProxy: "",
};

export function setRuntimeCredentials(next: Partial<RuntimeCredentials>): void {
  credentials = { ...credentials, ...next };
}

export function getRuntimeCredentials(): RuntimeCredentials {
  return { ...credentials };
}

export function hasCredentials(): boolean {
  return Boolean(credentials.readToken.trim() || credentials.apiKey.trim());
}

interface Query {
  [key: string]: string | number | boolean | undefined | null;
}

function buildUrl(path: string, query: Query = {}): string {
  const url = new URL(`${TMDB_API_BASE}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  if (!credentials.readToken) {
    url.searchParams.set("api_key", credentials.apiKey);
  }
  return url.toString();
}

interface CacheTtl {
  ttl: number;
}

async function request<T>(path: string, query: Query = {}, { ttl }: CacheTtl = { ttl: TTL_MS.details }): Promise<T> {
  const language = query.language ?? credentials.language;
  const cacheKey = `tmdb:v1:${path}:${new URLSearchParams(
    Object.entries({ ...query, language }).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v !== undefined && v !== null && v !== "") acc[k] = String(v);
      return acc;
    }, {}),
  ).toString()}`;

  const cached = await cacheGet<T>(cacheKey);
  if (cached !== undefined) return cached;

  const result = await dedupe(cacheKey, async () => {
    if (!hasCredentials()) {
      throw new TmdbError(
        "Sin credenciales TMDB. Añade tu clave en Configuración (⌘/Ctrl + ,).",
        0,
        7,
      );
    }
    const response = await fetch(buildUrl(path, query), {
      method: "GET",
      headers: credentials.readToken
        ? { Authorization: `Bearer ${credentials.readToken.trim()}`, Accept: "application/json" }
        : { Accept: "application/json" },
      mode: "cors",
      cache: "no-store",
    });
    if (!response.ok) {
      let message = `TMDB respondió ${response.status}`;
      let code: number | undefined;
      try {
        const body = (await response.json()) as { status_message?: string; status_code?: number };
        if (body.status_message) message = body.status_message;
        code = body.status_code;
      } catch {
        /* respuesta no JSON */
      }
      throw new TmdbError(message, response.status, code);
    }
    return (await response.json()) as T;
  });

  await cacheSet(cacheKey, result as object, ttl);
  return result;
}

/* -------------------------------------------------------------------------- */
/* Normalización                                                               */
/* -------------------------------------------------------------------------- */

export function toCatalogItem(movie: TmdbMovieSummary): CatalogItem {
  const year = yearOf(movie.release_date);
  return {
    id: movie.id,
    title: (movie.title ?? "").trim() || "Sin título",
    originalTitle: (movie.original_title ?? movie.title ?? "").trim(),
    overview: (movie.overview ?? "").trim(),
    posterPath: movie.poster_path ?? null,
    backdropPath: movie.backdrop_path ?? null,
    year,
    releaseDate: movie.release_date ?? null,
    rating: typeof movie.vote_average === "number" ? movie.vote_average : 0,
    voteCount: typeof movie.vote_count === "number" ? movie.vote_count : 0,
    genreIds: movie.genre_ids ?? [],
    popularity: typeof movie.popularity === "number" ? movie.popularity : 0,
    family: null,
    palette: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* -------------------------------------------------------------------------- */

export async function getGenres(): Promise<TmdbGenre[]> {
  const seed = await loadSeedBundle();
  if (seed.genres.length > 0) return seed.genres;
  if (!hasCredentials()) return [];
  try {
    const data = await request<{ genres: TmdbGenre[] }>(
      "/genre/movie/list",
      { language: credentials.language },
      { ttl: TTL_MS.keywords },
    );
    return data.genres ?? [];
  } catch {
    return [];
  }
}

export async function getTrending(page = 1): Promise<TmdbMovieSummary[]> {
  const seed = await loadSeedBundle();
  if (page === 1 && seed.trending.length > 0) return seed.trending;
  if (!hasCredentials()) return [];
  const data = await request<TmdbPage<TmdbMovieSummary>>(
    "/trending/movie/week",
    { page, language: credentials.language },
    { ttl: TTL_MS.trending },
  );
  return data.results ?? [];
}

export interface DiscoverOptions {
  mood?: MoodDefinition | null;
  year?: number | null;
  decade?: number | null;
  genres?: number[];
  sortBy?: string;
  minRating?: number;
  page?: number;
  signal?: AbortSignal;
}

export async function discoverMovies(options: DiscoverOptions): Promise<TmdbPage<TmdbMovieSummary>> {
  const { mood, year, decade, genres, sortBy, minRating, page = 1 } = options;
  const query: Query = {
    language: credentials.language,
    page,
    include_adult: false,
    sort_by: sortBy ?? mood?.sortBy ?? "popularity.desc",
    "vote_count.gte": minRating ?? mood?.minVoteCount ?? 120,
    with_genres: genres?.length ? genres.join(",") : mood?.genreIds.length ? mood.genreIds.join(",") : undefined,
    with_keywords: mood?.keywordIds.length ? mood.keywordIds.join("|") : undefined,
    "primary_release_year.gte": decade ? decade : undefined,
    "primary_release_year.lte": decade ? decade + 9 : undefined,
    "primary_release_date.gte": year && !decade ? `${year}-01-01` : undefined,
    "primary_release_date.lte": year && !decade ? `${year}-12-31` : undefined,
    "vote_average.gte": sortBy === "vote_average.desc" ? 6 : undefined,
  };
  return request<TmdbPage<TmdbMovieSummary>>("/discover/movie", query, { ttl: TTL_MS.discover });
}

const DETAIL_APPEND = [
  "credits",
  "images",
  "keywords",
  "external_ids",
  "recommendations",
  "similar",
  "videos",
  "release_dates",
].join(",");

export async function getMovieDetails(id: number, language?: string): Promise<TmdbMovieDetails | null> {
  const seed = await loadSeedBundle();
  const seeded = seed.films[String(id)];
  if (seeded) return seeded;
  if (!hasCredentials()) return null;
  try {
    return await request<TmdbMovieDetails>(
      `/movie/${id}`,
      {
        language: language ?? credentials.language,
        append_to_response: DETAIL_APPEND,
        include_image_language: "en,null,es,fr,it,de,ja,ko,zh",
      },
      { ttl: TTL_MS.details },
    );
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return null;
    throw error;
  }
}

export async function getMovieCredits(id: number): Promise<TmdbCredits | null> {
  const details = await getMovieDetails(id);
  if (details?.credits) return details.credits;
  if (!hasCredentials()) return null;
  return request<TmdbCredits>(`/movie/${id}/credits`, { language: credentials.language }, { ttl: TTL_MS.credits });
}

export async function getMovieImages(id: number): Promise<TmdbImagesWithStills | null> {
  const details = await getMovieDetails(id);
  if (details?.images) return details.images;
  if (!hasCredentials()) return null;
  return request<TmdbImagesWithStills>(
    `/movie/${id}/images`,
    { include_image_language: "en,null,es,fr,it,de,ja,ko,zh" },
    { ttl: TTL_MS.images },
  );
}

export async function getMovieKeywords(id: number): Promise<TmdbKeyword[]> {
  const details = await getMovieDetails(id);
  if (details?.keywords?.keywords) return details.keywords.keywords;
  if (!hasCredentials()) return [];
  try {
    const data = await request<{ id: number; keywords: TmdbKeyword[] }>(
      `/movie/${id}/keywords`,
      {},
      { ttl: TTL_MS.keywords },
    );
    return data.keywords ?? [];
  } catch {
    return [];
  }
}

export async function getExternalIds(id: number): Promise<TmdbExternalIds | null> {
  const details = await getMovieDetails(id);
  if (details?.external_ids) return details.external_ids;
  if (!hasCredentials()) return null;
  try {
    return await request<TmdbExternalIds>(`/movie/${id}/external_ids`, {}, { ttl: TTL_MS.external });
  } catch {
    return null;
  }
}

export async function getSimilar(id: number): Promise<TmdbMovieSummary[]> {
  const details = await getMovieDetails(id);
  if (details?.similar?.results?.length) return details.similar.results;
  if (!hasCredentials()) return [];
  try {
    const data = await request<TmdbPage<TmdbMovieSummary>>(
      `/movie/${id}/similar`,
      { language: credentials.language, page: 1 },
      { ttl: TTL_MS.similar },
    );
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function getRecommendations(id: number): Promise<TmdbMovieSummary[]> {
  const details = await getMovieDetails(id);
  if (details?.recommendations?.results?.length) return details.recommendations.results;
  if (!hasCredentials()) return [];
  try {
    const data = await request<TmdbPage<TmdbMovieSummary>>(
      `/movie/${id}/recommendations`,
      { language: credentials.language, page: 1 },
      { ttl: TTL_MS.similar },
    );
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function searchMovies(query: string, page = 1): Promise<TmdbMovieSummary[]> {
  const seed = await loadSeedBundle();
  const local = searchSeedBundle(seed, query);
  if (!hasCredentials()) return local;
  try {
    const data = await request<TmdbPage<TmdbMovieSummary>>(
      "/search/movie",
      { query, page, language: credentials.language, include_adult: false },
      { ttl: TTL_MS.search },
    );
    const remote = data.results ?? [];
    return mergeResults(local, remote).slice(0, LIMITS.searchResults * 2);
  } catch {
    return local;
  }
}

function searchSeedBundle(seed: Awaited<ReturnType<typeof loadSeedBundle>>, query: string): TmdbMovieSummary[] {
  const needle = normalize(query);
  if (!needle) return [];
  const pool: TmdbMovieSummary[] = [
    ...seed.trending,
    ...seed.moods.flatMap((mood) => mood.items),
    ...Object.values(seed.films).map((film) => ({
      id: film.id,
      title: film.title ?? "",
      original_title: film.original_title,
      overview: film.overview,
      poster_path: film.poster_path ?? null,
      backdrop_path: film.backdrop_path ?? null,
      release_date: film.release_date ?? null,
      vote_average: film.vote_average,
      vote_count: film.vote_count,
      genre_ids: film.genres?.map((g) => g.id),
      popularity: film.popularity,
    })),
  ];
  const seen = new Set<number>();
  const matches: { item: TmdbMovieSummary; score: number }[] = [];
  for (const item of pool) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    const title = normalize(item.title ?? "");
    const original = normalize(item.original_title ?? "");
    const year = String(yearOf(item.release_date) ?? "");
    let score = 0;
    if (title.startsWith(needle) || original.startsWith(needle)) score = 0.95;
    else if (title.includes(needle) || original.includes(needle)) score = 0.8;
    else if (year && year === needle) score = 0.6;
    else {
      const distance = Math.min(
        levenshteinBounded(needle, title),
        levenshteinBounded(needle, original),
      );
      if (distance <= 2 && needle.length > 3) score = 0.7 - distance * 0.1;
    }
    if (score > 0) matches.push({ item, score });
  }
  return matches
    .sort((a, b) => b.score - a.score || (b.item.popularity ?? 0) - (a.item.popularity ?? 0))
    .slice(0, LIMITS.searchResults)
    .map((m) => m.item);
}

function levenshteinBounded(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1),
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length];
}

function mergeResults(local: TmdbMovieSummary[], remote: TmdbMovieSummary[]): TmdbMovieSummary[] {
  const seen = new Set<number>();
  const out: TmdbMovieSummary[] = [];
  for (const item of [...local, ...remote]) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* FilmAffinity: resolución exacta de la ficha                                 */
/* -------------------------------------------------------------------------- */

/**
 * TMDB no expone el ID de FilmAffinity. Se resuelve de tres formas, en orden:
 *  1. Semilla estática generada en CI (scripts/generate-seeds.mjs).
 *  2. Proxy CORS configurado por el usuario (Configuración → Avanzado).
 *  3. Enlace a la búsqueda de FilmAffinity con título + año (siempre funciona).
 */
export async function resolveFilmAffinityId(
  title: string,
  year: number | null,
  originalTitle?: string,
): Promise<string | null> {
  const seed = await loadSeedBundle();
  const seedKey = normalize(`${title} ${year ?? ""}`);
  for (const [key, value] of Object.entries(seed.filmaffinity)) {
    if (normalize(key) === seedKey) return value;
  }

  if (!credentials.corsProxy) return null;

  const cacheKey = `fa:v1:${seedKey}`;
  const cached = await cacheGet<string | null>(cacheKey);
  if (cached !== undefined) return cached;

  const terms = [title, originalTitle].filter(Boolean) as string[];
  for (const term of terms) {
    const url = `${credentials.corsProxy}${encodeURIComponent(
      `https://www.filmaffinity.com/es/search.php?stype=title&stext=${encodeURIComponent(term)}`,
    )}`;
    try {
      const response = await fetch(url, {
        headers: { Accept: "text/html", "X-Requested-With": "CinematecaSensorial" },
        mode: "cors",
      });
      if (!response.ok) continue;
      const html = await response.text();
      const id = parseFilmAffinityId(html, year);
      if (id) {
        await cacheSet(cacheKey, id, TTL_MS.filmaffinity);
        return id;
      }
    } catch {
      continue;
    }
  }
  await cacheSet(cacheKey, null, TTL_MS.filmaffinity);
  return null;
}

export function parseFilmAffinityId(html: string, year: number | null): string | null {
  const pattern = /film(\d{5,7})\.html/gi;
  const ids = new Map<string, number>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const id = match[1];
    ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  if (ids.size === 0) return null;
  if (year) {
    const yearPattern = new RegExp(`film(\\d{5,7})\\.html[^]{0,900}?\\b${year}\\b`, "i");
    const yearMatch = yearPattern.exec(html);
    if (yearMatch) return yearMatch[1];
  }
  return [...ids.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/* -------------------------------------------------------------------------- */
/* Utilidades para el grafo y las paletas                                      */
/* -------------------------------------------------------------------------- */

export async function hydrateKeywords(
  candidates: TmdbMovieSummary[],
  limit = LIMITS.graphNodes,
): Promise<{ movie: TmdbMovieSummary; keywords: TmdbKeyword[] }[]> {
  const slice = candidates.slice(0, limit);
  return runPool(
    slice.map((movie) => async () => ({ movie, keywords: await getMovieKeywords(movie.id) })),
    4,
  );
}

export function readVisited(): number[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.visited);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}
