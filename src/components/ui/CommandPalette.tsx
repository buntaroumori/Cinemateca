import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/lib/format";
import { fuzzyFilter, highlightSegments } from "@/lib/fuzzy";
import { LIMITS, STORAGE_KEYS } from "@/lib/constants";
import { getMovieDetails, searchMovies, toCatalogItem } from "@/lib/tmdb";
import { loadSeedBundle } from "@/lib/seed";
import { debounce } from "@/lib/pool";
import { imageSources } from "@/lib/images";
import { useSettings } from "@/app/settings";
import { navigate } from "@/app/router";
import type { CatalogItem, TmdbMovieSummary } from "@/lib/types";
import { Modal } from "./Modal";
import { IconAperture, IconClose, IconSearch, IconSparkle } from "./Icons";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

interface ResultRow {
  item: CatalogItem;
  score: number;
  reason: string;
}

function readRecentIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.visited);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.slice(0, 8).filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

const SUGGESTIONS = ["Blade Runner", "2001", "Villeneuve", "Wong Kar-wai", "Tarkovski", "1999", "noir", "Ghibli"];

/**
 * Buscador global (⌘/Ctrl + K): resultados locales instantáneos sobre el
 * catálogo en memoria + búsqueda remota TMDB con tolerancia a erratas.
 */
export function CommandPalette({ open, onClose, onOpenSettings }: CommandPaletteProps) {
  const { settings, hasTmdbCredentials } = useSettings();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const poolRef = useRef<CatalogItem[]>([]);
  const localRowsRef = useRef<ResultRow[]>([]);
  const requestId = useRef(0);

  /* --- carga del corpus local (semillas + historial) --- */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const seed = await loadSeedBundle();
      if (cancelled) return;
      const seen = new Set<number>();
      const pool: CatalogItem[] = [];
      const push = (movie: TmdbMovieSummary | null | undefined) => {
        if (!movie || seen.has(movie.id)) return;
        seen.add(movie.id);
        pool.push(toCatalogItem(movie));
      };
      seed.trending.forEach((movie) => push(movie));
      seed.moods.forEach((mood) => mood.items.forEach((movie) => push(movie)));
      Object.values(seed.films).forEach((film) => push(film));

      const recentIds = readRecentIds();
      const missing = recentIds.filter((id) => !seen.has(id));
      if (missing.length > 0 && hasTmdbCredentials) {
        const resolved = await Promise.all(
          missing.map((id) =>
            getMovieDetails(id)
              .then((details) => (details ? toCatalogItem(details) : null))
              .catch(() => null),
          ),
        );
        resolved.forEach((item) => item && pool.push(item));
      }
      if (cancelled) return;
      poolRef.current = pool;
      const byId = new Map(pool.map((item) => [item.id, item]));
      localRowsRef.current = recentIds
        .map((id) => byId.get(id))
        .filter((item): item is CatalogItem => Boolean(item))
        .map((item) => ({ item, score: 1, reason: "Visitada recientemente" }));
      setRows((current) => (current.length === 0 ? localRowsRef.current : current));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, hasTmdbCredentials]);

  /* --- filtro local determinista --- */
  const computeLocal = useCallback((term: string): ResultRow[] => {
    const trimmed = term.trim();
    if (!trimmed) return localRowsRef.current;
    const matches = fuzzyFilter(
      trimmed,
      poolRef.current,
      (item) => [item.title, item.originalTitle, String(item.year ?? "")],
      LIMITS.searchResults,
    );
    return matches.map((match) => ({
      item: match.item,
      score: match.score,
      reason:
        match.score > 0.9
          ? "Coincidencia exacta"
          : match.score > 0.62
            ? "Coincidencia parcial"
            : "Coincidencia aproximada",
    }));
  }, []);

  /* --- búsqueda remota con debounce --- */
  const runRemote = useMemo(
    () =>
      debounce((term: string) => {
        const id = ++requestId.current;
        setSearching(true);
        void searchMovies(term, 1)
          .then((results) => {
            if (id !== requestId.current) return;
            const merged = new Map<number, ResultRow>();
            for (const row of localRowsRef.current) merged.set(row.item.id, row);
            for (const movie of results) {
              const item = toCatalogItem(movie);
              if (!merged.has(item.id)) merged.set(item.id, { item, score: 0.88, reason: "Índice mundial TMDB" });
            }
            const list = [...merged.values()]
              .sort((a, b) => b.score - a.score || b.item.popularity - a.item.popularity)
              .slice(0, LIMITS.searchResults);
            localRowsRef.current = list;
            setRows(list);
          })
          .catch(() => {
            if (id === requestId.current) setRows(localRowsRef.current);
          })
          .finally(() => {
            if (id === requestId.current) setSearching(false);
          });
      }, 240),
    [],
  );

  useEffect(() => {
    if (!open) {
      runRemote.cancel();
      return;
    }
    const local = computeLocal(query);
    localRowsRef.current = local;
    setRows(local);
    setActive(0);
    if (query.trim().length >= 2 && hasTmdbCredentials) runRemote(query);
    else setSearching(false);
  }, [query, open, computeLocal, runRemote, hasTmdbCredentials]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setRows([]);
      setActive(0);
      setSearching(false);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  const commit = useCallback(
    (row: ResultRow | undefined) => {
      if (!row) return;
      onClose();
      navigate(`/film/${row.item.id}`);
    },
    [onClose],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((current) => Math.min(rows.length - 1, current + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current) => Math.max(0, current - 1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        commit(rows[active]);
      }
    },
    [rows, active, commit],
  );

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <Modal open={open} onClose={onClose} className="flex items-start justify-center px-3 pt-[12vh] sm:px-6">
      <div className="glass scale-in relative w-full max-w-[720px] overflow-hidden rounded-[4px] shadow-[0_60px_140px_-60px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="accent-text">
            <IconSearch size={17} />
          </span>
          <label htmlFor="palette-query" className="sr-only">
            Buscar película
          </label>
          <input
            id="palette-query"
            ref={inputRef}
            data-autofocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            type="text"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="palette-results"
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder="Buscar por título, año o aproximación…"
            className="min-w-0 flex-1 bg-transparent font-serif text-[19px] text-[#f4f1ea] placeholder:text-[#7e7e88] focus:outline-none"
          />
          {searching ? (
            <span className="type-eyebrow pulse-soft text-[9px]">Buscando</span>
          ) : (
            <kbd className="type-mono hidden rounded-[2px] border border-white/10 px-1.5 py-1 text-[9px] text-[#8a8a94] sm:block">
              ESC
            </kbd>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar buscador"
            className="text-[#8a8a94] transition-colors duration-200 hover:text-[#f4f1ea] sm:hidden"
          >
            <IconClose size={17} />
          </button>
        </div>

        {query.trim().length === 0 ? (
          <div className="flex flex-wrap items-center gap-2 px-5 py-4">
            <span className="type-eyebrow mr-1 text-[9px]">Sugerencias</span>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="hairline rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#9d9da7] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <div id="palette-results" ref={listRef} role="listbox" className="max-h-[52vh] overflow-y-auto overscroll-contain">
          {rows.length === 0 && !searching && query.trim().length > 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="text-[#7e7e88]">
                <IconAperture size={26} />
              </span>
              <p className="font-serif text-[17px] text-[#8b8b95]">Ningún título se aproxima a «{query.trim()}».</p>
              <p className="max-w-[400px] font-mono text-[10px] uppercase leading-relaxed tracking-[0.18em] text-[#7e7e88]">
                {hasTmdbCredentials
                  ? "Prueba con el título original, el año o un apellido de dirección."
                  : "Sin credenciales TMDB la búsqueda se limita al catálogo precargado: añádelas en Configuración."}
              </p>
            </div>
          ) : null}

          {rows.map((row, index) => {
            const sources = imageSources({ path: row.item.posterPath, kind: "posterSmall", quality: settings.imageQuality });
            const segments = highlightSegments(row.item.title, query.trim());
            return (
              <button
                key={row.item.id}
                type="button"
                role="option"
                aria-selected={index === active}
                data-index={index}
                onMouseEnter={() => setActive(index)}
                onClick={() => commit(row)}
                className={cx(
                  "flex w-full items-center gap-4 border-b border-white/5 px-5 py-3 text-left transition-colors duration-200",
                  index === active ? "bg-white/[0.055]" : "bg-transparent",
                )}
              >
                <span className="relative block h-[58px] w-[39px] shrink-0 overflow-hidden rounded-[2px] bg-[#0d0d10]">
                  {sources.jpeg ? (
                    <img
                      src={sources.jpeg}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[#7e7e88]">
                      <IconAperture size={14} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-[17px] leading-tight text-[#eeeae1]">
                    {segments.map((segment, segmentIndex) => (
                      <span key={segmentIndex} className={segment.hit ? "accent-text" : undefined}>
                        {segment.text}
                      </span>
                    ))}
                  </span>
                  <span className="mt-1 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#8a8a94]">
                    <span>{row.item.year ?? "s.a."}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-[#3a3a42]" />
                    <span className="truncate">{row.reason}</span>
                    {row.item.rating > 0 ? (
                      <>
                        <span className="h-[3px] w-[3px] rounded-full bg-[#3a3a42]" />
                        <span>{row.item.rating.toFixed(1).replace(".", ",")}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="type-mono shrink-0 text-[9px] tracking-[0.14em] text-[#7e7e88]">
                  {(row.score * 100).toFixed(0)}%
                </span>
              </button>
            );
          })}

          {searching && rows.length === 0
            ? Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center gap-4 border-b border-white/5 px-5 py-3">
                  <span className="shimmer relative block h-[58px] w-[39px] overflow-hidden rounded-[2px] bg-[#101013]" />
                  <span className="flex-1 space-y-2">
                    <span className="shimmer relative block h-[12px] w-1/2 overflow-hidden rounded-[2px] bg-[#101013]" />
                    <span className="shimmer relative block h-[9px] w-1/4 overflow-hidden rounded-[2px] bg-[#101013]" />
                  </span>
                </div>
              ))
            : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <span className="type-mono text-[9px] uppercase tracking-[0.22em] text-[#7e7e88]">
            {rows.length} resultados · {poolRef.current.length} títulos en memoria
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[#8a8a94] transition-colors duration-200 hover:text-[color:var(--accent)]"
          >
            <IconSparkle size={12} />
            Configurar claves
          </button>
        </div>
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] opacity-45" />
      </div>
    </Modal>
  );
}
