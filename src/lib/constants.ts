import type { ColorFamily, ColorFamilyId } from "./types";

export const APP_NAME = "Cinemateca Sensorial";
export const APP_TAGLINE = "Esencia · Vibración · Dilema · Estética";

export const TMDB_API_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
export const TMDB_WWW = "https://www.themoviedb.org";

export const SUPPORTED_LANGUAGES: { id: string; label: string; flag: string }[] = [
  { id: "es-ES", label: "Español", flag: "ES" },
  { id: "en-US", label: "English", flag: "EN" },
  { id: "fr-FR", label: "Français", flag: "FR" },
  { id: "it-IT", label: "Italiano", flag: "IT" },
  { id: "de-DE", label: "Deutsch", flag: "DE" },
  { id: "pt-BR", label: "Português", flag: "BR" },
  { id: "ja-JP", label: "日本語", flag: "JP" },
  { id: "ko-KR", label: "한국어", flag: "KR" },
  { id: "zh-CN", label: "中文", flag: "CN" },
];

export const IMAGE_QUALITY_LEVELS: {
  id: string;
  label: string;
  hint: string;
  poster: string;
  posterSmall: string;
  backdrop: string;
  still: string;
  profile: string;
  logo: string;
}[] = [
  {
    id: "cine",
    label: "Cine",
    hint: "Resolución máxima · más datos",
    poster: "w780",
    posterSmall: "w500",
    backdrop: "original",
    still: "original",
    profile: "h632",
    logo: "original",
  },
  {
    id: "alta",
    label: "Alta",
    hint: "Equilibrio premium",
    poster: "w500",
    posterSmall: "w342",
    backdrop: "w1280",
    still: "w780",
    profile: "w185",
    logo: "w500",
  },
  {
    id: "equilibrada",
    label: "Equilibrada",
    hint: "Recomendada en móvil",
    poster: "w342",
    posterSmall: "w185",
    backdrop: "w780",
    still: "w300",
    profile: "w185",
    logo: "w300",
  },
  {
    id: "ahorro",
    label: "Ahorro",
    hint: "Mínimo consumo de datos",
    poster: "w185",
    posterSmall: "w154",
    backdrop: "w300",
    still: "w185",
    profile: "w92",
    logo: "w185",
  },
];

export const COLOR_FAMILIES: ColorFamily[] = [
  { id: "carmesi", label: "Carmesí", hex: "#f08276", hue: [345, 360] },
  { id: "ambar", label: "Ámbar", hex: "#f6a765", hue: [14, 40] },
  { id: "oro", label: "Oro", hex: "#e9c673", hue: [40, 56] },
  { id: "acido", label: "Ácido", hex: "#c9dc7d", hue: [56, 82] },
  { id: "esmeralda", label: "Esmeralda", hex: "#3fbd7c", hue: [82, 150] },
  { id: "jade", label: "Jade", hex: "#2fbfa4", hue: [150, 176] },
  { id: "cian", label: "Cian", hex: "#39c0d8", hue: [176, 200] },
  { id: "cobalto", label: "Cobalto", hex: "#3f7fe0", hue: [200, 234] },
  { id: "indigo", label: "Índigo", hex: "#5b62e8", hue: [234, 258] },
  { id: "magenta", label: "Magenta", hex: "#cd87ef", hue: [258, 288] },
  { id: "purpura", label: "Púrpura", hex: "#8a4fd6", hue: [288, 312] },
  { id: "rosa", label: "Rosa", hex: "#f48cc2", hue: [312, 345] },
  { id: "neutro", label: "Neutro", hex: "#aca79a", hue: [0, 360] },
];

export const COLOR_FAMILY_MAP: Record<ColorFamilyId, ColorFamily> = COLOR_FAMILIES.reduce(
  (acc, family) => {
    acc[family.id] = family;
    return acc;
  },
  {} as Record<ColorFamilyId, ColorFamily>,
);

/** Subconjunto estable de géneros TMDB (fallback si no hay semilla ni red). */
export const FALLBACK_GENRES: { id: number; name: string }[] = [
  { id: 12, name: "Aventura" },
  { id: 16, name: "Animación" },
  { id: 18, name: "Drama" },
  { id: 27, name: "Terror" },
  { id: 35, name: "Comedia" },
  { id: 36, name: "Historia" },
  { id: 37, name: "Wéstern" },
  { id: 53, name: "Suspense" },
  { id: 80, name: "Crimen" },
  { id: 99, name: "Documental" },
  { id: 878, name: "Ciencia ficción" },
  { id: 9648, name: "Misterio" },
  { id: 10402, name: "Música" },
  { id: 10749, name: "Romance" },
  { id: 10751, name: "Familia" },
  { id: 10752, name: "Bélica" },
  { id: 10770, name: "Película de TV" },
];

export const STORAGE_KEYS = {
  settings: "cinemateca.settings.v1",
  palette: "cinemateca.palettes.v1",
  visited: "cinemateca.visited.v1",
  lastRoute: "cinemateca.last-route.v1",
} as const;

export const IDB_NAME = "cinemateca-sensorial";
export const IDB_VERSION = 1;
export const IDB_STORES = {
  api: "api-cache",
  palettes: "palettes",
  essays: "essays",
} as const;

export const TTL_MS = {
  details: 1000 * 60 * 60 * 24 * 14,
  images: 1000 * 60 * 60 * 24 * 30,
  credits: 1000 * 60 * 60 * 24 * 14,
  keywords: 1000 * 60 * 60 * 24 * 30,
  external: 1000 * 60 * 60 * 24 * 30,
  similar: 1000 * 60 * 60 * 24 * 7,
  search: 1000 * 60 * 30,
  discover: 1000 * 60 * 45,
  trending: 1000 * 60 * 30,
  filmaffinity: 1000 * 60 * 60 * 24 * 90,
  essay: 1000 * 60 * 60 * 24 * 90,
} as const;

export const LIMITS = {
  gridPageSize: 20,
  gridMaxPages: 25,
  stills: 48,
  backdrops: 24,
  cast: 12,
  graphNodes: 16,
  soulmates: 3,
  searchResults: 12,
  windowedOverscan: 24,
} as const;

export const EXTERNAL_LINKS = {
  imdb: (imdbId: string) => `https://www.imdb.com/title/${imdbId}/`,
  imdbSearch: (title: string) =>
    `https://www.imdb.com/find/?q=${encodeURIComponent(title)}&s=tt&ttype=ft`,
  letterboxd: (imdbId: string) => `https://letterboxd.com/imdb/${imdbId}/`,
  letterboxdSearch: (title: string) =>
    `https://letterboxd.com/search/films/${encodeURIComponent(title.toLowerCase())}/`,
  filmaffinity: (faId: string) => `https://www.filmaffinity.com/es/film${faId}.html`,
  filmaffinitySearch: (title: string, year: number | null) =>
    `https://www.filmaffinity.com/es/search.php?stype=title&stext=${encodeURIComponent(title)}${
      year ? `&fromyear=${year}&toyear=${year}` : ""
    }`,
  tmdb: (id: number) => `${TMDB_WWW}/movie/${id}`,
  youtube: (key: string) => `https://www.youtube.com/watch?v=${key}`,
} as const;
