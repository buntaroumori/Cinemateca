import { IDB_STORES } from "./constants";
import { cacheGet, cacheSet, dedupe } from "./cache";
import { extractPalette, emptyPalette } from "./colors";
import { samplingFallbackUrl, samplingUrl } from "./images";
import type { Palette } from "./types";

export const PALETTE_CACHE_TTL = 1000 * 60 * 60 * 24 * 60;

function keyFor(path: string): string {
  return `palette:v1:${path}`;
}

/**
 * Extrae y persiste la paleta de 5 colores dominantes de un póster.
 * Usa el tamaño `w92` (≈3 KB) para no penalizar el ancho de banda: la
 * cuantización no necesita más resolución.
 */
const inflightPalettes = new Map<string, Promise<Palette | null>>();

export function getPaletteForPoster(path: string | null | undefined): Promise<Palette | null> {
  if (!path) return Promise.resolve(null);
  const key = keyFor(path);
  const running = inflightPalettes.get(key);
  if (running) return running;
  const promise = extractAndStore(key, path).finally(() => {
    inflightPalettes.delete(key);
  });
  inflightPalettes.set(key, promise);
  return promise;
}

async function extractAndStore(key: string, path: string): Promise<Palette | null> {
  return dedupe(key, async () => {
    const cached = await cacheGet<Palette>(key, IDB_STORES.palettes);
    if (cached) return cached;
    const primary = samplingUrl(path);
    const fallback = samplingFallbackUrl(path);
    let palette: Palette | null = null;
    if (primary) palette = await extractPalette(primary);
    if (!palette && fallback && fallback !== primary) palette = await extractPalette(fallback);
    if (!palette) return null;
    await cacheSet(key, palette, PALETTE_CACHE_TTL, IDB_STORES.palettes);
    return palette;
  });
}

export async function warmPalettes(paths: (string | null | undefined)[], concurrency = 3): Promise<void> {
  const unique = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  if (unique.length === 0) return;
  let active = 0;
  let index = 0;
  await new Promise<void>((resolve) => {
    const next = () => {
      if (index >= unique.length && active === 0) {
        resolve();
        return;
      }
      while (active < concurrency && index < unique.length) {
        const path = unique[index];
        index += 1;
        active += 1;
        void getPaletteForPoster(path)
          .catch(() => null)
          .finally(() => {
            active -= 1;
            next();
          });
      }
    };
    next();
  });
}

export function fallbackPalette(seedHex?: string): Palette {
  const base = emptyPalette();
  if (!seedHex) return base;
  return { ...base, accentHex: seedHex };
}
