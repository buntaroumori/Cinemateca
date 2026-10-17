/**
 * Helper puro compartido entre el cliente y el build (`vite.config.ts`):
 * elige la película que ocupa el hero destacado cuando el catálogo se ordena
 * por «esencia», de forma que el HTML pueda precargar exactamente la imagen
 * que será el LCP de la portada.
 *
 * Debe replicar la lógica de `toCatalogItem` (rating y popularity en crudo) y
 * de `sortByMode("essence")` en `useFilmFeed` (popularity·0.35 + rating·12,
 * descendente, ordenación estable). Si alguna de las dos cambia, esta también.
 */

export interface HeroCandidate {
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number | null;
  popularity?: number | null;
}

/** Puntuación «esencia»: idéntica fórmula que el orden por defecto del feed. */
export function essenceScore(item: HeroCandidate): number {
  const popularity = typeof item.popularity === "number" ? item.popularity : 0;
  const rating = typeof item.vote_average === "number" ? item.vote_average : 0;
  return popularity * 0.35 + rating * 12;
}

/** Devuelve el backdrop (o el póster como respaldo) del primer film por esencia. */
export function pickHeroImagePath(trending: HeroCandidate[]): string | null {
  if (trending.length === 0) return null;
  const hero = [...trending].sort((a, b) => essenceScore(b) - essenceScore(a))[0];
  return hero.backdrop_path ?? hero.poster_path ?? null;
}

/**
 * Devuelve el item TMDB en crudo que ocupará el hero (el primero por esencia).
 * El build lo inyecta como JSON en el HTML para que la portada lo renderice en
 * el primer commit de React, sin esperar al catálogo completo; el cliente lo
 * normaliza con su propio `toCatalogItem` (cero duplicación de mapeo).
 */
export function pickHeroRawItem<T extends HeroCandidate>(trending: T[]): T | null {
  if (trending.length === 0) return null;
  return [...trending].sort((a, b) => essenceScore(b) - essenceScore(a))[0] ?? null;
}
