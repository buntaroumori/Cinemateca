import { useEffect, useState } from "react";
import { EXTERNAL_LINKS } from "./constants";
import { resolveFilmAffinityId } from "./tmdb";

export interface ExternalLinkSet {
  imdb: { url: string; exact: boolean };
  letterboxd: { url: string; exact: boolean };
  filmaffinity: { url: string; exact: boolean };
  tmdb: { url: string; exact: boolean };
}

export function buildExternalLinks(
  imdbId: string | null,
  title: string,
  year: number | null,
  filmAffinityId: string | null,
  tmdbId: number,
): ExternalLinkSet {
  return {
    imdb: {
      url: imdbId ? EXTERNAL_LINKS.imdb(imdbId) : EXTERNAL_LINKS.imdbSearch(title),
      exact: Boolean(imdbId),
    },
    letterboxd: {
      url: imdbId ? EXTERNAL_LINKS.letterboxd(imdbId) : EXTERNAL_LINKS.letterboxdSearch(title),
      exact: Boolean(imdbId),
    },
    filmaffinity: {
      url: filmAffinityId
        ? EXTERNAL_LINKS.filmaffinity(filmAffinityId)
        : EXTERNAL_LINKS.filmaffinitySearch(title, year),
      exact: Boolean(filmAffinityId),
    },
    tmdb: { url: EXTERNAL_LINKS.tmdb(tmdbId), exact: true },
  };
}

/**
 * Resuelve el ID exacto de FilmAffinity cuando existe semilla de CI o un proxy
 * CORS configurado; en caso contrario devuelve null y el enlace apunta a la
 * búsqueda con título + año (siempre funcional).
 */
export function useFilmAffinityId(title: string, year: number | null, originalTitle?: string): string | null {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setId(null);
    void resolveFilmAffinityId(title, year, originalTitle)
      .then((resolved) => {
        if (!cancelled) setId(resolved);
      })
      .catch(() => {
        if (!cancelled) setId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [title, year, originalTitle]);

  return id;
}

export function trailerUrl(videos?: { results: { key: string; site: string; type: string; official: boolean }[] }): string | null {
  const results = videos?.results ?? [];
  const youtube = results.filter((video) => video.site === "YouTube");
  const preferred =
    youtube.find((video) => video.type === "Trailer" && video.official) ??
    youtube.find((video) => video.type === "Trailer") ??
    youtube.find((video) => video.type === "Teaser") ??
    youtube[0];
  return preferred ? EXTERNAL_LINKS.youtube(preferred.key) : null;
}
