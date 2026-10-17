import { IDB_STORES, STORAGE_KEYS, TTL_MS } from "./constants";
import { cacheGet, cacheSet } from "./cache";
import type { AppSettings, Essay, Palette, SeedBundle } from "./types";

const EMPTY_BUNDLE: SeedBundle = {
  generatedAt: null,
  language: "es-ES",
  available: false,
  trending: [],
  moods: [],
  films: {},
  essays: [],
  filmaffinity: {},
  genres: [],
};

let bundlePromise: Promise<SeedBundle> | null = null;

const BASE = import.meta.env.BASE_URL ?? "/";

function seedUrl(file: string): string {
  return `${BASE}seed/${file}`;
}

/**
 * Carga las semillas estáticas generadas en CI (`npm run seed`). Si el build se
 * hizo sin credenciales, los archivos existen igualmente pero están vacíos:
 * la aplicación degrada a peticiones TMDB en vivo con la clave del usuario.
 */
export function loadSeedBundle(): Promise<SeedBundle> {
  if (bundlePromise) return bundlePromise;
  bundlePromise = (async () => {
    try {
      const response = await fetch(seedUrl("catalog.json"), { cache: "force-cache" });
      if (!response.ok) return EMPTY_BUNDLE;
      const data = (await response.json()) as Partial<SeedBundle>;
      return {
        ...EMPTY_BUNDLE,
        ...data,
        films: data.films ?? {},
        essays: data.essays ?? [],
        filmaffinity: data.filmaffinity ?? {},
        genres: data.genres ?? [],
        moods: data.moods ?? [],
        trending: data.trending ?? [],
        available: Boolean(data.available),
      };
    } catch {
      return EMPTY_BUNDLE;
    }
  })();
  return bundlePromise;
}

export function resetSeedBundle(): void {
  bundlePromise = null;
}

/* -------------------------------------------------------------------------- */
/* Paletas persistentes                                                        */
/* -------------------------------------------------------------------------- */

export async function readPalette(key: string): Promise<Palette | null> {
  const cached = await cacheGet<Palette>(key, IDB_STORES.palettes);
  return cached ?? null;
}

export async function writePalette(key: string, palette: Palette): Promise<void> {
  await cacheSet(key, palette, TTL_MS.images, IDB_STORES.palettes);
}

/* -------------------------------------------------------------------------- */
/* Ensayos persistentes                                                        */
/* -------------------------------------------------------------------------- */

export async function readEssay(key: string): Promise<Essay | null> {
  const cached = await cacheGet<Essay>(key, IDB_STORES.essays);
  return cached ?? null;
}

export async function writeEssay(key: string, essay: Essay): Promise<void> {
  await cacheSet(key, essay, TTL_MS.essay, IDB_STORES.essays);
}

/* -------------------------------------------------------------------------- */
/* Preferencias en localStorage                                                */
/* -------------------------------------------------------------------------- */

export function readLocalSettings(): Partial<AppSettings> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalSettings(settings: AppSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {
    /* modo privado / cuota: la sesión sigue en memoria */
  }
}

export function readVisitedFilms(): number[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.visited);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function writeVisitedFilms(ids: number[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.visited, JSON.stringify(ids.slice(0, 400)));
  } catch {
    /* ignorable */
  }
}
