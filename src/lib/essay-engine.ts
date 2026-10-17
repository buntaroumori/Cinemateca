import { COLOR_FAMILY_MAP } from "./constants";
import { contrastRatio, hexToRgb, rgbToHsl } from "./colors";
import { decadeOf } from "./format";
import type { ColorFamilyId, Palette, TmdbKeyword } from "./types";

/**
 * Motor de afinidad y de ensayo determinista. Funciona sin red y sin LLM:
 * deriva la relación entre dos películas de sus keywords, géneros, década,
 * duración y, sobre todo, de su distancia cromática medida sobre las paletas.
 */

export interface FilmFingerprint {
  id: number;
  title: string;
  year: number | null;
  overview: string;
  tagline: string | null;
  runtime: number | null;
  rating: number;
  keywords: TmdbKeyword[];
  genres: { id: number; name: string }[];
  palette: Palette | null;
  family: ColorFamilyId;
  director: string | null;
  cinematographer: string | null;
  posterPath: string | null;
}

export interface AffinityScore {
  total: number;
  sharedKeywords: TmdbKeyword[];
  sharedGenres: string[];
  chromaticDistance: number;
  contrast: number;
  temporalGap: number;
  runtimeGap: number;
  sameDirector: boolean;
  sameCinematographer: boolean;
}

export function keywordSet(film: FilmFingerprint): Set<string> {
  return new Set(film.keywords.map((k) => k.name.toLowerCase().trim()));
}

export function scoreAffinity(source: FilmFingerprint, target: FilmFingerprint): AffinityScore {
  const sourceKeywords = keywordSet(source);
  const sharedKeywords = target.keywords.filter((k) => sourceKeywords.has(k.name.toLowerCase().trim()));
  const sourceGenres = new Set(source.genres.map((g) => g.id));
  const sharedGenres = target.genres.filter((g) => sourceGenres.has(g.id)).map((g) => g.name);

  const chromaticDistance = paletteDistance(source.palette, target.palette);
  const contrast = 1 - chromaticDistance;
  const temporalGap = source.year && target.year ? Math.abs(source.year - target.year) : 40;
  const runtimeGap = source.runtime && target.runtime ? Math.abs(source.runtime - target.runtime) : 45;
  const sameDirector =
    Boolean(source.director && target.director) &&
    String(source.director).toLowerCase() === String(target.director).toLowerCase();
  const sameCinematographer =
    Boolean(source.cinematographer && target.cinematographer) &&
    String(source.cinematographer).toLowerCase() === String(target.cinematographer).toLowerCase();

  const keywordScore = Math.min(1, sharedKeywords.length / 4) * 0.42;
  const genreScore = Math.min(1, sharedGenres.length / 2.4) * 0.14;
  const chromaScore = contrast * 0.22;
  const ratingScore = (1 - Math.min(1, Math.abs(source.rating - target.rating) / 3)) * 0.08;
  const temporalScore = (1 - Math.min(1, temporalGap / 60)) * 0.06;
  const runtimeScore = (1 - Math.min(1, runtimeGap / 90)) * 0.04;
  const authorScore = (sameDirector ? 0.12 : 0) + (sameCinematographer ? 0.08 : 0);

  const total = Math.min(
    1,
    keywordScore + genreScore + chromaScore + ratingScore + temporalScore + runtimeScore + authorScore + 0.04,
  );

  return {
    total,
    sharedKeywords,
    sharedGenres,
    chromaticDistance,
    contrast,
    temporalGap,
    runtimeGap,
    sameDirector,
    sameCinematographer,
  };
}

/** Distancia perceptual 0..1 entre dos paletas (media de distancias RGB). */
export function paletteDistance(a: Palette | null, b: Palette | null): number {
  if (!a || !b || a.colors.length === 0 || b.colors.length === 0) return 0.5;
  const pairs = Math.min(a.colors.length, b.colors.length, 5);
  let sum = 0;
  for (let i = 0; i < pairs; i++) {
    const ca = a.colors[i];
    const cb = b.colors[i];
    const dr = (ca.rgb[0] - cb.rgb[0]) / 255;
    const dg = (ca.rgb[1] - cb.rgb[1]) / 255;
    const db = (ca.rgb[2] - cb.rgb[2]) / 255;
    sum += Math.sqrt((dr * dr + dg * dg + db * db) / 3);
  }
  return Math.min(1, sum / pairs);
}

export interface LocalEssayInput {
  source: FilmFingerprint;
  target: FilmFingerprint;
  score: AffinityScore;
}

/** Genera un ensayo de tres líneas reproducible, sin depender de ningún LLM. */
export function composeLocalEssay({ source, target, score }: LocalEssayInput): {
  headline: string;
  lines: [string, string, string];
} {
  const keywordNames = score.sharedKeywords.map((k) => k.name).slice(0, 3);
  const sourceFamily = COLOR_FAMILY_MAP[source.family];
  const targetFamily = COLOR_FAMILY_MAP[target.family];
  const sameFamily = source.family === target.family;
  const contrastValue =
    source.palette && target.palette
      ? contrastRatio(hexToRgb(source.palette.colors[0]?.hex ?? "#808080"), hexToRgb(target.palette.colors[0]?.hex ?? "#808080"))
      : 1;
  const saturationDelta =
    source.palette && target.palette
      ? Math.abs(rgbToHsl(hexToRgb(source.palette.accentHex)).s - rgbToHsl(hexToRgb(target.palette.accentHex)).s)
      : 0;

  const headline = pickHeadline(source, target, score, sameFamily);

  const firstLine = keywordNames.length
    ? `Ambas orbitan el mismo territorio moral —${keywordNames.join(", ")}— aunque lo pisan con zapatos distintos: ${source.title} lo convierte en intimidad y ${target.title} en escenario.`
    : `Comparten una respiración narrativa idéntica: ${source.title} y ${target.title} avanzan por acumulación de silencios más que por giros de trama.`;

  const secondLine = sameFamily
    ? `Su parentesco cromático es literal: las dos se mueven en la familia ${sourceFamily.label.toLowerCase()} (${source.palette?.colors[0]?.hex ?? sourceFamily.hex} frente a ${target.palette?.colors[0]?.hex ?? targetFamily.hex}), con una desviación de saturación del ${(saturationDelta * 100).toFixed(0)}%.`
    : `El contraste fotográfico las separa y las explica: ${sourceFamily.label.toLowerCase()} contra ${targetFamily.label.toLowerCase()}, una relación de contraste de ${contrastValue.toFixed(1)}:1 que convierte el mismo dilema en dos climas opuestos.`;

  const thirdLine = buildThirdLine(source, target, score);

  return { headline, lines: [firstLine, secondLine, thirdLine] };
}

function pickHeadline(
  source: FilmFingerprint,
  target: FilmFingerprint,
  score: AffinityScore,
  sameFamily: boolean,
): string {
  if (score.sameDirector) return "El mismo autor, dos obsesiones";
  if (score.sameCinematographer) return "Un mismo ojo detrás de la lente";
  if (score.sharedKeywords.length >= 4) return "Gemelas por vocabulario";
  if (score.temporalGap <= 3) return `Dos voces del ${decadeOf(source.year)}`;
  if (sameFamily) return "Mismo clima, distinta herida";
  if (score.contrast < 0.35) return "Negativo y positivo del mismo dilema";
  return `${target.title} responde a ${source.title}`;
}

function buildThirdLine(source: FilmFingerprint, target: FilmFingerprint, score: AffinityScore): string {
  const runtimePart =
    source.runtime && target.runtime
      ? `${Math.abs(source.runtime - target.runtime)} minutos de diferencia en el montaje`
      : "ritmos de montaje distintos";
  const temporalPart =
    source.year && target.year
      ? `${score.temporalGap} años de distancia histórica`
      : "procedencias temporales distintas";
  const tension =
    score.chromaticDistance > 0.55
      ? "y sin embargo el conflicto ético que plantean es exactamente el mismo: hasta dónde se puede sostener una mentira antes de que sostenga ella tu vida."
      : "y aun así desembocan en la misma pregunta: qué se sacrifica para seguir siendo reconocible ante uno mismo.";
  return `${runtimePart}, ${temporalPart}, ${tension}`;
}

export function affinityLabel(score: number): string {
  if (score >= 0.82) return "Alma gemela";
  if (score >= 0.66) return "Eco directo";
  if (score >= 0.5) return "Resonancia";
  if (score >= 0.34) return "Vínculo lateral";
  return "Afinidad tenue";
}
