import type { AppSettings } from "./types";

/**
 * Configuración de compilación. Solo `VITE_BASE_PATH` y `VITE_APP_VERSION`
 * son valores públicos por diseño: las credenciales de TMDB/LLM se usan en CI
 * para generar semillas estáticas y, en el navegador, las aporta el usuario
 * desde el panel de Configuración (localStorage, fuera del bundle).
 */
export interface BuildEnv {
  basePath: string;
  version: string;
  buildStamp: string;
  /** Definidas solo si el build se hizo con credenciales (desarrollo local). */
  buildTimeApiKey: string;
  buildTimeReadToken: string;
  buildTimeCorsProxy: string;
  buildTimeImageBase: string;
  buildTimeLlmProvider: string;
  buildTimeLlmModel: string;
  buildTimeLlmBaseUrl: string;
}

function readVar(name: string): string {
  const env = import.meta.env as Record<string, unknown>;
  const value = env[name];
  return typeof value === "string" ? value.trim() : "";
}

export const BUILD_ENV: BuildEnv = {
  basePath: readVar("BASE_URL") || "/",
  version: readVar("VITE_APP_VERSION") || "1.0.0",
  buildStamp: readVar("VITE_BUILD_STAMP") || "local",
  buildTimeApiKey: readVar("VITE_TMDB_API_KEY"),
  buildTimeReadToken: readVar("VITE_TMDB_READ_TOKEN"),
  buildTimeCorsProxy: readVar("VITE_CORS_PROXY_URL"),
  buildTimeImageBase: readVar("VITE_TMDB_IMAGE_BASE"),
  buildTimeLlmProvider: readVar("VITE_LLM_PROVIDER"),
  buildTimeLlmModel: readVar("VITE_LLM_MODEL"),
  buildTimeLlmBaseUrl: readVar("VITE_LLM_BASE_URL"),
};

export const DEFAULT_SETTINGS: AppSettings = {
  tmdbApiKey: "",
  tmdbReadToken: "",
  language: "es-ES",
  imageQuality: "alta",
  heavyAnimations: true,
  graphPhysics: true,
  grainEffect: true,
  autoplayTrailers: false,
  llmProvider: "",
  llmApiKey: "",
  llmModel: "",
  llmBaseUrl: "",
  corsProxyUrl: "",
  tmdbImageBase: "",
  reduceDataUsage: false,
};

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const platform = navigator.platform ?? "";
  return /Mac|iPod|iPhone|iPad/.test(platform) || /Macintosh/.test(ua);
}
