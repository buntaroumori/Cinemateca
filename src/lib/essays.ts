import { LIMITS } from "./constants";
import { toCatalogItem, getMovieDetails, getRecommendations, getSimilar } from "./tmdb";
import { getPaletteForPoster } from "./palette";
import { readEssay, writeEssay, loadSeedBundle } from "./seed";
import { generateEssay, llmConfigFromSettings } from "./llm";
import {
  composeLocalEssay,
  scoreAffinity,
  type AffinityScore,
  type FilmFingerprint,
} from "./essay-engine";
import type { AppSettings, Essay, Palette, TmdbMovieDetails, TmdbMovieSummary } from "./types";

export interface Soulmate {
  fingerprint: FilmFingerprint;
  score: AffinityScore;
  summary: TmdbMovieSummary;
}

function crewRole(details: TmdbMovieDetails, job: string): string | null {
  const crew = details.credits?.crew ?? [];
  const member = crew.find((c) => c.job === job) ?? crew.find((c) => c.department === job);
  return member?.name ?? null;
}

export async function buildFingerprint(
  details: TmdbMovieDetails,
  palette: Palette | null,
): Promise<FilmFingerprint> {
  return {
    id: details.id,
    title: details.title ?? "",
    year: toCatalogItem(details).year,
    overview: details.overview ?? "",
    tagline: details.tagline ?? null,
    runtime: details.runtime ?? null,
    rating: details.vote_average ?? 0,
    keywords: details.keywords?.keywords ?? [],
    genres: details.genres ?? [],
    palette,
    family: palette?.dominantFamily ?? "neutro",
    director: crewRole(details, "Director"),
    cinematographer: crewRole(details, "Director of Photography"),
    posterPath: details.poster_path ?? null,
  };
}

async function fingerprintOf(
  summary: TmdbMovieSummary,
): Promise<{ fingerprint: FilmFingerprint | null; summary: TmdbMovieSummary }> {
  const palette = await getPaletteForPoster(summary.poster_path);
  const details = await getMovieDetails(summary.id);
  if (details) {
    const fingerprint = await buildFingerprint(details, palette);
    return { fingerprint, summary };
  }
  // Última instancia: huella con lo que el sumario ya sabe (géneros reales del
  // índice, año, voto y paleta extraída del póster). Nunca deja un hueco.
  const seed = await loadSeedBundle();
  const genres = (summary.genre_ids ?? [])
    .map((genreId) => seed.genres.find((genre) => genre.id === genreId))
    .filter((genre): genre is NonNullable<typeof genre> => Boolean(genre));
  const fingerprint: FilmFingerprint = {
    id: summary.id,
    title: summary.title ?? "",
    year: toCatalogItem(summary).year,
    overview: summary.overview ?? "",
    tagline: null,
    runtime: null,
    rating: summary.vote_average ?? 0,
    keywords: [],
    genres,
    palette,
    family: palette?.dominantFamily ?? "neutro",
    director: null,
    cinematographer: null,
    posterPath: summary.poster_path ?? null,
  };
  return { fingerprint, summary };
}

/**
 * Motor sensorial: mezcla recomendaciones y similares de TMDB, hidrata sus
 * keywords y paletas, y puntúa la afinidad real (semántica + cromática).
 */
export async function getSoulmates(
  details: TmdbMovieDetails,
  sourcePalette: Palette | null,
  limit = LIMITS.graphNodes,
): Promise<Soulmate[]> {
  const source = await buildFingerprint(details, sourcePalette);
  const [recommendations, similar] = await Promise.all([
    getRecommendations(details.id),
    getSimilar(details.id),
  ]);

  const seen = new Set<number>([details.id]);
  const candidates: TmdbMovieSummary[] = [];
  for (const item of [...recommendations, ...similar]) {
    if (!item || seen.has(item.id) || !item.poster_path) continue;
    seen.add(item.id);
    candidates.push(item);
  }

  const pool = candidates.slice(0, limit + 6);
  const fingerprints = await Promise.all(pool.map((item) => fingerprintOf(item)));
  const scored: Soulmate[] = [];
  for (const entry of fingerprints) {
    if (!entry.fingerprint) continue;
    const score = scoreAffinity(source, entry.fingerprint);
    scored.push({ fingerprint: entry.fingerprint, score, summary: entry.summary });
  }
  scored.sort((a, b) => b.score.total - a.score.total);
  return scored.slice(0, limit);
}

export function essayCacheKey(sourceId: number, targetId: number): string {
  return `essay:v1:${sourceId}:${targetId}`;
}

export interface EssayResolution {
  essay: Essay;
  origin: Essay["source"];
}

/**
 * Orden de resolución de un ensayo:
 *  1. Semilla pre-generada en CI (0 ms, sin red).
 *  2. Caché persistente IndexedDB (película ya analizada).
 *  3. LLM configurado por el usuario en el panel de Configuración.
 *  4. Motor local determinista (siempre disponible, sin coste ni red).
 */
export async function resolveEssay(
  source: FilmFingerprint,
  soulmate: Soulmate,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<EssayResolution> {
  const key = essayCacheKey(source.id, soulmate.fingerprint.id);

  const seed = await loadSeedBundle();
  const seeded = seed.essays.find(
    (essay) => essay.filmId === source.id && essay.targetId === soulmate.fingerprint.id,
  );
  if (seeded) return { essay: seeded, origin: "seed" };

  const cached = await readEssay(key);
  if (cached) return { essay: cached, origin: cached.source };

  const config = llmConfigFromSettings(settings);
  if (config.apiKey && config.provider) {
    try {
      const draft = await generateEssay(
        config,
        {
          source: {
            title: source.title,
            year: source.year,
            overview: source.overview,
            tagline: source.tagline,
            director: source.director,
            cinematographer: source.cinematographer,
            keywords: source.keywords.map((k) => k.name),
            genres: source.genres.map((g) => g.name),
            palette: source.palette,
            runtime: source.runtime,
          },
          target: {
            id: soulmate.fingerprint.id,
            title: soulmate.fingerprint.title,
            year: soulmate.fingerprint.year,
            overview: soulmate.fingerprint.overview,
            keywords: soulmate.fingerprint.keywords.map((k) => k.name),
            genres: soulmate.fingerprint.genres.map((g) => g.name),
            palette: soulmate.fingerprint.palette,
            runtime: soulmate.fingerprint.runtime,
          },
          language: settings.language,
        },
        signal,
      );
      if (draft) {
        const essay: Essay = {
          filmId: source.id,
          targetId: soulmate.fingerprint.id,
          targetTitle: soulmate.fingerprint.title,
          targetYear: soulmate.fingerprint.year,
          targetPosterPath: soulmate.fingerprint.posterPath,
          headline: draft.headline,
          lines: draft.lines,
          source: "llm",
          model: draft.model,
        };
        await writeEssay(key, essay);
        return { essay, origin: "llm" };
      }
    } catch {
      /* caída controlada al motor local */
    }
  }

  const local = composeLocalEssay({
    source,
    target: soulmate.fingerprint,
    score: soulmate.score,
  });
  const essay: Essay = {
    filmId: source.id,
    targetId: soulmate.fingerprint.id,
    targetTitle: soulmate.fingerprint.title,
    targetYear: soulmate.fingerprint.year,
    targetPosterPath: soulmate.fingerprint.posterPath,
    headline: local.headline,
    lines: local.lines,
    source: "local",
  };
  await writeEssay(key, essay);
  return { essay, origin: "local" };
}
