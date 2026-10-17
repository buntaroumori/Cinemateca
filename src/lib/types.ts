/**
 * Modelo de dominio: tipos TMDB (v3) normalizados + tipos propios de la app.
 * Todo lo que cruza la frontera de red se valida/normaliza en `lib/tmdb.ts`.
 */

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbMovieSummary {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string | null;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  popularity?: number;
  adult?: boolean;
}

export interface TmdbCredits {
  id: number;
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TmdbImage {
  aspect_ratio: number;
  height: number;
  width: number;
  iso_639_1: string | null;
  file_path: string;
  vote_average: number;
  vote_count: number;
}

export interface TmdbImages {
  id: number;
  backdrops: TmdbImage[];
  posters: TmdbImage[];
}

/** /movie/{id}/images?include_image_language=en,null,es devuelve también `stills`. */
export interface TmdbImagesWithStills extends TmdbImages {
  stills?: TmdbImage[];
}

export interface TmdbKeyword {
  id: number;
  name: string;
}

export interface TmdbExternalIds {
  id: number;
  imdb_id: string | null;
  wikidata_id: string | null;
  facebook_id: string | null;
  instagram_id: string | null;
  twitter_id: string | null;
}

export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
}

export interface TmdbMovieDetails extends TmdbMovieSummary {
  adult?: boolean;
  belongs_to_collection?: { id: number; name: string; poster_path: string | null } | null;
  budget?: number;
  genres?: TmdbGenre[];
  homepage?: string | null;
  imdb_id?: string | null;
  origin_country?: string[];
  original_language?: string;
  production_companies?: { id: number; logo_path: string | null; name: string; origin_country: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  release_date?: string | null;
  release_dates?: unknown;
  revenue?: number;
  runtime?: number | null;
  spoken_languages?: { english_name: string; iso_639_1: string; name: string }[];
  status?: string;
  tagline?: string | null;
  video?: boolean;
  videos?: { results: TmdbVideo[] };
  credits?: TmdbCredits;
  images?: TmdbImagesWithStills;
  keywords?: { keywords: TmdbKeyword[] };
  external_ids?: TmdbExternalIds;
  similar?: TmdbPage<TmdbMovieSummary>;
  recommendations?: TmdbPage<TmdbMovieSummary>;
}

export interface TmdbPage<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbConfiguration {
  images: {
    base_url: string;
    secure_base_url: string;
    backdrop_sizes: string[];
    logo_sizes: string[];
    poster_sizes: string[];
    profile_sizes: string[];
    still_sizes: string[];
  };
  change_keys: string[];
}

/* -------------------------------------------------------------------------- */
/* Tipos propios de Cinemateca Sensorial                                       */
/* -------------------------------------------------------------------------- */

export type MoodId =
  | "neon-melancolia"
  | "vertigo-cosmico"
  | "dilema-moral"
  | "onirico"
  | "austero"
  | "fiebre"
  | "ritual-sangre"
  | "memoria-tiempo"
  | "vinculo"
  | "absurdo";

export interface MoodDefinition {
  id: MoodId;
  label: string;
  essence: string;
  description: string;
  accent: string;
  colorFamily: ColorFamilyId;
  genreIds: number[];
  keywordIds: number[];
  sortBy: string;
  minVoteCount: number;
  primaryLanguage?: string;
}

export type ColorFamilyId =
  | "carmesi"
  | "ambar"
  | "oro"
  | "acido"
  | "esmeralda"
  | "jade"
  | "cian"
  | "cobalto"
  | "indigo"
  | "magenta"
  | "purpura"
  | "rosa"
  | "neutro";

export interface ColorFamily {
  id: ColorFamilyId;
  label: string;
  hex: string;
  /** Rango de tono en grados, [min, max). Si min > max, cruza el 0. */
  hue: [number, number];
}

export interface PaletteEntry {
  hex: string;
  rgb: [number, number, number];
  population: number;
  luminance: number;
  hue: number;
  saturation: number;
}

export interface Palette {
  colors: PaletteEntry[];
  accentHex: string;
  accentSoftHex: string;
  textOnAccent: string;
  dominantFamily: ColorFamilyId;
  averageLuminance: number;
  saturationIndex: number;
}

export type ImageQuality = "cine" | "alta" | "equilibrada" | "ahorro";

export type ImageKind = "poster" | "posterSmall" | "backdrop" | "still" | "profile" | "logo";

export type MetadataLanguage =
  | "es-ES"
  | "en-US"
  | "fr-FR"
  | "it-IT"
  | "de-DE"
  | "pt-BR"
  | "ja-JP"
  | "ko-KR"
  | "zh-CN";

export interface AppSettings {
  tmdbApiKey: string;
  tmdbReadToken: string;
  language: MetadataLanguage;
  imageQuality: ImageQuality;
  heavyAnimations: boolean;
  graphPhysics: boolean;
  grainEffect: boolean;
  autoplayTrailers: boolean;
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl: string;
  corsProxyUrl: string;
  /** Base alternativa del CDN de imágenes (proxy propio, caché o pruebas). */
  tmdbImageBase: string;
  reduceDataUsage: boolean;
}

export interface FilmEssence {
  mood: MoodDefinition;
  family: ColorFamily;
  palette: Palette | null;
  keywordSignature: string[];
}

export interface CatalogItem {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: number | null;
  releaseDate: string | null;
  rating: number;
  voteCount: number;
  genreIds: number[];
  popularity: number;
  /** Familia cromática derivada del póster (null si aún no se ha extraído). */
  family: ColorFamilyId | null;
  /** Paleta extraída del póster, si ya está en caché. */
  palette: Palette | null;
}

export interface GraphNode {
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  rating: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** 0..1 — fuerza del vínculo con el nodo central. */
  affinity: number;
  reason: string;
  sharedKeywords: string[];
  family: ColorFamilyId;
  accent: string;
  image: HTMLImageElement | null;
  pinned: boolean;
}

export interface GraphEdge {
  source: GraphNode;
  target: GraphNode;
  weight: number;
}

export interface Essay {
  filmId: number;
  targetId: number;
  targetTitle: string;
  targetYear: number | null;
  targetPosterPath: string | null;
  headline: string;
  lines: [string, string, string];
  source: "llm" | "local" | "seed";
  model?: string;
}

export interface SeedMood {
  id: MoodId;
  generatedAt: string;
  items: TmdbMovieSummary[];
}

export interface SeedBundle {
  generatedAt: string | null;
  language: string;
  available: boolean;
  trending: TmdbMovieSummary[];
  moods: SeedMood[];
  films: Record<string, TmdbMovieDetails>;
  essays: Essay[];
  filmaffinity: Record<string, string>;
  genres: TmdbGenre[];
}

export interface FeedState {
  items: CatalogItem[];
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  exhausted: boolean;
}

export type RouteName = "home" | "film" | "not-found";

export interface Route {
  name: RouteName;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}
