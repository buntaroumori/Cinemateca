import { IMAGE_QUALITY_LEVELS, TMDB_IMAGE_BASE } from "./constants";
import type { ImageKind, ImageQuality } from "./types";

type Tier = (typeof IMAGE_QUALITY_LEVELS)[number];

let imageBaseOverride = "";

/** Permite servir las imágenes desde un proxy o caché propia. */
export function setImageBase(base: string): void {
  imageBaseOverride = (base || "").trim().replace(/\/+$/, "");
}

export function imageBase(): string {
  return imageBaseOverride || TMDB_IMAGE_BASE;
}

export function tierFor(quality: ImageQuality): Tier {
  return IMAGE_QUALITY_LEVELS.find((t) => t.id === quality) ?? IMAGE_QUALITY_LEVELS[1];
}

export interface ImageRequest {
  path: string | null | undefined;
  kind: ImageKind;
  quality: ImageQuality;
  /** Fuerza un tamaño concreto (w342, original…). */
  size?: string;
}

/**
 * TMDB sirve JPEG y permite negociar WebP/AVIF con el parámetro `itok`.
 * Devolvimos la URL base; `posterSources()` construye el <picture> completo
 * con AVIF → WebP → JPEG para que el navegador elija el mejor disponible.
 */
export function tmdbImageUrl({ path, kind, quality, size }: ImageRequest): string | null {
  if (!path) return null;
  const tier = tierFor(quality);
  const chosen = size ?? tier[kind];
  return `${imageBase()}/${chosen}${path}`;
}

export interface ImageSourceSet {
  avif: string | null;
  webp: string | null;
  jpeg: string | null;
}

export function imageSources(request: ImageRequest): ImageSourceSet {
  const jpeg = tmdbImageUrl(request);
  if (!jpeg) return { avif: null, webp: null, jpeg: null };
  return {
    avif: `${jpeg}?itok=avif`,
    webp: `${jpeg}?itok=webp`,
    jpeg,
  };
}

/** Elige el escalón de póster según el ancho real del contenedor y el DPR. */
export function posterSizeFor(containerWidth: number, quality: ImageQuality): string {
  const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const target = containerWidth * dpr;
  const sizes = [154, 185, 342, 500, 780];
  for (const size of sizes) {
    if (target <= size) return `w${size}`;
  }
  return quality === "cine" ? "original" : "w780";
}

export function stillSizeFor(quality: ImageQuality): string {
  const tier = tierFor(quality);
  return tier.still;
}

export function backdropSizeFor(quality: ImageQuality): string {
  const tier = tierFor(quality);
  return tier.backdrop;
}

/**
 * Devuelve el tamaño mínimo suficiente para leer la paleta en canvas:
 * no hace falta descargar el póster grande para extraer 5 colores.
 */
export function samplingUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${imageBase()}/w92${path}?itok=webp`;
}

export function samplingFallbackUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${imageBase()}/w92${path}`;
}

export function blurHashPlaceholder(family: string): string {
  return `linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(0,0,0,0.9) 100%), radial-gradient(120% 80% at 50% 0%, ${family}22 0%, transparent 70%)`;
}
