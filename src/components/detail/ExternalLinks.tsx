import { memo } from "react";
import { cx } from "@/lib/format";
import { EXTERNAL_LINKS } from "@/lib/constants";
import { buildExternalLinks, useFilmAffinityId } from "@/lib/links";
import { ExternalLink } from "../Link";
import { IconExternal } from "../ui/Icons";

export interface ExternalLinksProps {
  imdbId: string | null;
  title: string;
  originalTitle: string;
  year: number | null;
  tmdbId: number;
}

const MONOGRAMS: Record<string, string> = {
  IMDb: "IMDb",
  Letterboxd: "LBXD",
  FilmAffinity: "FA",
  TMDB: "TMDB",
};

/**
 * Botones de acción minimalistas hacia la ficha exacta de la película en cada
 * plataforma. Cuando TMDB no provee el identificador externo, el enlace degrada
 * a la búsqueda precisa por título (+ año en FilmAffinity) y se marca como
 * "aprox." en el tooltip.
 */
export const ExternalLinksRow = memo(function ExternalLinksRow({
  imdbId,
  title,
  originalTitle,
  year,
  tmdbId,
}: ExternalLinksProps) {
  const filmAffinityId = useFilmAffinityId(title, year, originalTitle);
  const links = buildExternalLinks(imdbId, originalTitle || title, year, filmAffinityId, tmdbId);

  const entries = [
    { key: "IMDb", ...links.imdb },
    { key: "Letterboxd", ...links.letterboxd },
    { key: "FilmAffinity", ...links.filmaffinity },
    { key: "TMDB", ...links.tmdb },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries.map((entry) => (
        <ExternalLink
          key={entry.key}
          href={entry.url}
          title={`${entry.key} — ${entry.exact ? "ficha exacta" : "búsqueda por título"}`}
          className={cx(
            "group flex items-center gap-2.5 rounded-[2px] border border-white/10 bg-white/[0.015] px-4 py-2.5 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "hover:-translate-y-[1px] hover:border-[color:var(--accent-line)] hover:bg-white/[0.05]",
          )}
        >
          <span className="type-mono text-[10px] uppercase tracking-[0.2em] text-[#d9d5cc] transition-colors duration-300 group-hover:text-[color:var(--accent)]">
            {MONOGRAMS[entry.key] ?? entry.key}
          </span>
          {!entry.exact ? (
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#7e7e88]">aprox.</span>
          ) : null}
          <span className="text-[#7e7e88] transition-colors duration-300 group-hover:text-[color:var(--accent)]">
            <IconExternal size={12} />
          </span>
        </ExternalLink>
      ))}
      <ExternalLink
        href={EXTERNAL_LINKS.imdbSearch(title)}
        title="Buscar en el índice completo"
        className="ml-1 hidden font-mono text-[9px] uppercase tracking-[0.18em] text-[#7e7e88] transition-colors duration-300 hover:text-[#9d9da7] sm:block"
      >
        ¿Falta algún enlace?
      </ExternalLink>
    </div>
  );
});
