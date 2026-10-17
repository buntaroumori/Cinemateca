import { COLOR_FAMILIES, COLOR_FAMILY_MAP } from "./constants";
import type { ColorFamilyId, Palette, PaletteEntry } from "./types";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return { r: 0, g: 0, b: 0 };
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number] = [0, 0, 0];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

/** Luminancia relativa WCAG. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

export function readableTextOn(hex: string): string {
  const rgb = hexToRgb(hex);
  return contrastRatio(rgb, { r: 0, g: 0, b: 0 }) >= contrastRatio(rgb, { r: 255, g: 255, b: 255 })
    ? "#000000"
    : "#FFFFFF";
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

export function mixHex(hex: string, target: Rgb, amount: number): string {
  const base = hexToRgb(hex);
  const t = clamp(amount, 0, 1);
  return rgbToHex({
    r: base.r + (target.r - base.r) * t,
    g: base.g + (target.g - base.g) * t,
    b: base.b + (target.b - base.b) * t,
  });
}

export function adjustLightness(hex: string, delta: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb({ ...hsl, l: clamp(hsl.l + delta, 0.04, 0.96) }));
}

export function familyOf(hue: number, saturation: number, lightness: number): ColorFamilyId {
  if (saturation < 0.12 || lightness < 0.06 || lightness > 0.94) return "neutro";
  const h = ((hue % 360) + 360) % 360;
  for (const family of COLOR_FAMILIES) {
    if (family.id === "neutro") continue;
    const [min, max] = family.hue;
    if (min <= max ? h >= min && h < max : h >= min || h < max) return family.id;
  }
  return "neutro";
}

export function familyHex(id: ColorFamilyId): string {
  return COLOR_FAMILY_MAP[id]?.hex ?? "#9b9689";
}

interface Bucket {
  r: number;
  g: number;
  b: number;
  count: number;
}

/**
 * Cuantización por corte mediano ponderado + fusión de cubos casi idénticos.
 * Devuelve los `count` colores dominantes con su población relativa.
 */
function medianCut(pixels: Uint8ClampedArray, count: number): Bucket[] {
  const points: Rgb[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 125) continue;
    points.push({ r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] });
  }
  if (points.length === 0) return [];

  let buckets: Rgb[][] = [points];
  while (buckets.length < count) {
    let bestIndex = -1;
    let bestRange = -1;
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      if (bucket.length < 2) continue;
      const range = channelRange(bucket);
      if (range.value > bestRange) {
        bestRange = range.value;
        bestIndex = i;
      }
    }
    if (bestIndex === -1 || bestRange <= 0) break;
    const bucket = buckets[bestIndex];
    const { channel } = channelRange(bucket);
    bucket.sort((a, b) => a[channel] - b[channel]);
    const mid = bucket.length >> 1;
    buckets.splice(bestIndex, 1, bucket.slice(0, mid), bucket.slice(mid));
  }

  const result: Bucket[] = buckets
    .map((bucket) => {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const p of bucket) {
        r += p.r;
        g += p.g;
        b += p.b;
      }
      const n = bucket.length || 1;
      return { r: r / n, g: g / n, b: b / n, count: bucket.length };
    })
    .sort((a, b) => b.count - a.count);

  // Fusión de cubos perceptualmente duplicados.
  const merged: Bucket[] = [];
  for (const bucket of result) {
    const twin = merged.find((m) => {
      const dr = m.r - bucket.r;
      const dg = m.g - bucket.g;
      const db = m.b - bucket.b;
      return dr * dr + dg * dg + db * db < 320;
    });
    if (twin) {
      const total = twin.count + bucket.count;
      twin.r = (twin.r * twin.count + bucket.r * bucket.count) / total;
      twin.g = (twin.g * twin.count + bucket.g * bucket.count) / total;
      twin.b = (twin.b * twin.count + bucket.b * bucket.count) / total;
      twin.count = total;
    } else {
      merged.push({ ...bucket });
    }
  }
  return merged.sort((a, b) => b.count - a.count).slice(0, count);
}

function channelRange(bucket: Rgb[]): { channel: keyof Rgb; value: number } {
  let rMin = 255;
  let rMax = 0;
  let gMin = 255;
  let gMax = 0;
  let bMin = 255;
  let bMax = 0;
  for (const p of bucket) {
    if (p.r < rMin) rMin = p.r;
    if (p.r > rMax) rMax = p.r;
    if (p.g < gMin) gMin = p.g;
    if (p.g > gMax) gMax = p.g;
    if (p.b < bMin) bMin = p.b;
    if (p.b > bMax) bMax = p.b;
  }
  const ranges: { channel: keyof Rgb; value: number }[] = [
    { channel: "r", value: rMax - rMin },
    { channel: "g", value: gMax - gMin },
    { channel: "b", value: bMax - bMin },
  ];
  return ranges.sort((a, b) => b.value - a.value)[0];
}

/**
 * Puntúa un color como "acento de interfaz": debe leerse sobre negro puro y
 * no ser ni barro ni blanco quemado.
 */
function accentScore(rgb: Rgb): number {
  const hsl = rgbToHsl(rgb);
  const lum = relativeLuminance(rgb);
  const contrast = contrastRatio(rgb, { r: 0, g: 0, b: 0 });
  const satBonus = hsl.s * 1.15;
  const lumBonus = 1 - Math.abs(hsl.l - 0.58) * 1.35;
  return satBonus + lumBonus + Math.min(contrast, 8) / 12 + lum * 0.4;
}

export function buildPalette(pixels: Uint8ClampedArray, count = 5): Palette {
  const buckets = medianCut(pixels, Math.max(count * 2, count));
  const total = buckets.reduce((sum, b) => sum + b.count, 0) || 1;
  const entries: PaletteEntry[] = buckets.slice(0, count).map((bucket) => {
    const rgb: Rgb = { r: bucket.r, g: bucket.g, b: bucket.b };
    const hsl = rgbToHsl(rgb);
    return {
      hex: rgbToHex(rgb),
      rgb: [Math.round(rgb.r), Math.round(rgb.g), Math.round(rgb.b)],
      population: bucket.count / total,
      luminance: relativeLuminance(rgb),
      hue: hsl.h,
      saturation: hsl.s,
    };
  });

  if (entries.length === 0) {
    return emptyPalette();
  }

  const accentSource = [...entries].sort(
    (a, b) => accentScore({ r: a.rgb[0], g: a.rgb[1], b: a.rgb[2] }) - accentScore({ r: b.rgb[0], g: b.rgb[1], b: b.rgb[2] }),
  )[entries.length - 1];
  // El acento se usa como color de texto sobre negro puro: se sube la
  // luminosidad hasta garantizar 4.5:1 (WCAG AA) sin perder identidad de tono.
  const accentHex = ensureContrastOnBlack(accentSource.hex);

  const weighted = entries.reduce(
    (acc, entry) => ({
      hue: acc.hue + entry.hue * entry.population,
      sat: acc.sat + entry.saturation * entry.population,
      lum: acc.lum + entry.luminance * entry.population,
    }),
    { hue: 0, sat: 0, lum: 0 },
  );

  const dominant = entries[0];
  const dominantHsl = rgbToHsl({ r: dominant.rgb[0], g: dominant.rgb[1], b: dominant.rgb[2] });
  return {
    colors: entries,
    accentHex,
    accentSoftHex: mixHex(accentHex, { r: 0, g: 0, b: 0 }, 0.55),
    textOnAccent: readableTextOn(accentHex),
    dominantFamily: familyOf(dominantHsl.h, dominantHsl.s, dominantHsl.l),
    averageLuminance: weighted.lum,
    saturationIndex: weighted.sat,
  };
}

export function emptyPalette(): Palette {
  return {
    colors: [],
    accentHex: "#c9a227",
    accentSoftHex: "#3a3115",
    textOnAccent: "#000000",
    dominantFamily: "neutro",
    averageLuminance: 0.2,
    saturationIndex: 0.2,
  };
}

/** Eleva la luminosidad de un color hasta alcanzar 4.5:1 sobre #000000. */
export function ensureContrastOnBlack(hex: string): string {
  let current = hex;
  for (let i = 0; i < 14; i++) {
    const rgb = hexToRgb(current);
    if (contrastRatio(rgb, { r: 0, g: 0, b: 0 }) >= 4.5) return current.toUpperCase();
    const hsl = rgbToHsl(rgb);
    current = rgbToHex(
      hslToRgb({ h: hsl.h, s: Math.min(0.92, Math.max(hsl.s, 0.34)), l: clamp(hsl.l + 0.05, 0, 0.94) }),
    );
  }
  return "#E6E2D8";
}

const SAMPLE_SIZE = 64;

/** Extrae los datos de píxeles de una imagen ya cargada (CORS permitido). */
export function samplePixels(image: HTMLImageElement): Uint8ClampedArray | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    return null;
  }
}

/** Carga una imagen con `crossOrigin` para poder leerla en canvas. */
export function loadImageForSampling(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    const done = (value: HTMLImageElement | null) => {
      img.onload = null;
      img.onerror = null;
      resolve(value);
    };
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = src;
  });
}

export async function extractPalette(imageUrl: string): Promise<Palette | null> {
  const image = await loadImageForSampling(imageUrl);
  if (!image) return null;
  const pixels = samplePixels(image);
  if (!pixels) return null;
  return buildPalette(pixels, 5);
}

export function familyGradient(family: ColorFamilyId): string {
  const hex = familyHex(family);
  return `linear-gradient(135deg, ${withAlpha(hex, 0.85)} 0%, ${withAlpha(mixHex(hex, { r: 0, g: 0, b: 0 }, 0.5), 0.85)} 100%)`;
}
