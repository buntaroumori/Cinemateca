import type { AppSettings } from "./types";

/**
 * Configuración de compilación. Solo `VITE_BASE_PATH` y `VITE_APP_VERSION`
 * son valores públicos por diseño. Las credenciales TMDB del despliegue se
 * leen en el build desde `.env` o desde los secretos de CI y se incrustan
 * ofuscadas (XOR + base64) como «acceso comunitario»: todo visitante puede
 * explorar el catálogo mundial completo sin introducir ninguna clave, y sin
 * que exista un secreto en claro ni en el repositorio ni en el bundle.
 * Una clave personal aportada en Configuración (localStorage) siempre tiene
 * prioridad sobre la comunitaria.
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
  heavyAnimations: false,
  graphPhysics: true,
  grainEffect: false,
  autoplayTrailers: false,
  llmProvider: "",
  llmApiKey: "",
  llmModel: "",
  llmBaseUrl: "",
  corsProxyUrl: "",
  tmdbImageBase: "",
  reduceDataUsage: false,
};

/* Credenciales comunitarias del despliegue: el build las inyecta ofuscadas
   (XOR con máscara + base64) desde `.env` o los secretos de CI. Nunca existen
   en claro en el repositorio, ni en el bundle, ni en el panel de Configuración. */
declare const __CINEMATECA_BUILTIN_KEY__: string;
declare const __CINEMATECA_BUILTIN_TOKEN__: string;

const BUILTIN_MASK = "cinemateca-sensorial";

function decodeBuiltin(encoded: string): string {
  try {
    if (!encoded) return "";
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    return Array.from(bytes, (byte, index) =>
      String.fromCharCode(byte ^ BUILTIN_MASK.charCodeAt(index % BUILTIN_MASK.length)),
    ).join("");
  } catch {
    return "";
  }
}

/** Acceso comunitario incluido en este despliegue (cadena vacía si el build se
 *  hizo sin credenciales). Una clave personal del usuario tiene prioridad. */
export const BUILTIN_TMDB: { apiKey: string; readToken: string } = {
  apiKey: decodeBuiltin(__CINEMATECA_BUILTIN_KEY__),
  readToken: decodeBuiltin(__CINEMATECA_BUILTIN_TOKEN__),
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
