import { useCallback, useEffect, useState } from "react";
import { BUILD_ENV } from "@/lib/env";
import { TMDB_API_BASE } from "@/lib/constants";
import { cacheClearStore, cacheStats } from "./cache";
import { resetSeedBundle } from "./seed";
import { setRuntimeCredentials } from "./tmdb";
import type { AppSettings } from "./types";

export interface CredentialTest {
  status: "idle" | "testing" | "ok" | "error";
  message: string;
}

/** Comprueba una clave contra /configuration sin tocar la caché global. */
export async function testTmdbCredentials(
  candidate: Pick<AppSettings, "tmdbApiKey" | "tmdbReadToken" | "language">,
): Promise<CredentialTest> {
  const apiKey = candidate.tmdbApiKey.trim();
  const readToken = candidate.tmdbReadToken.trim();
  if (!apiKey && !readToken) {
    return { status: "error", message: "Introduce una API Key v3 o un Read Access Token v4." };
  }
  const url = new URL(`${TMDB_API_BASE}/configuration`);
  url.searchParams.set("language", candidate.language);
  if (!readToken) url.searchParams.set("api_key", apiKey);
  try {
    const response = await fetch(url.toString(), {
      headers: readToken ? { Authorization: `Bearer ${readToken}`, Accept: "application/json" } : { Accept: "application/json" },
      mode: "cors",
      cache: "no-store",
    });
    if (response.status === 401) {
      return { status: "error", message: "Credencial rechazada por TMDB (401). Revisa el valor copiado." };
    }
    if (!response.ok) {
      return { status: "error", message: `TMDB respondió ${response.status}.` };
    }
    const data = (await response.json()) as { images?: { poster_sizes?: string[] } };
    const sizes = data.images?.poster_sizes?.length ?? 0;
    return { status: "ok", message: `Conexión establecida · ${sizes} tamaños de póster disponibles.` };
  } catch {
    return { status: "error", message: "No se pudo alcanzar TMDB (red o CORS bloqueado)." };
  }
}

export async function probeLlmEndpoint(settings: AppSettings): Promise<CredentialTest> {
  if (!settings.llmApiKey.trim()) return { status: "error", message: "Falta la clave del proveedor LLM." };
  const base = settings.llmBaseUrl.trim() || "https://api.openai.com/v1/chat/completions";
  const isAnthropic = settings.llmProvider.trim().toLowerCase() === "anthropic";
  try {
    const response = await fetch(base, {
      method: "POST",
      headers: isAnthropic
        ? {
            "content-type": "application/json",
            "x-api-key": settings.llmApiKey.trim(),
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          }
        : { "content-type": "application/json", authorization: `Bearer ${settings.llmApiKey.trim()}` },
      body: JSON.stringify(
        isAnthropic
          ? { model: settings.llmModel || "claude-3-5-haiku-latest", max_tokens: 12, messages: [{ role: "user", content: "di ok" }] }
          : { model: settings.llmModel || "gpt-4o-mini", max_tokens: 12, messages: [{ role: "user", content: "di ok" }] },
      ),
    });
    if (!response.ok) return { status: "error", message: `El proveedor respondió ${response.status}.` };
    return { status: "ok", message: "Proveedor LLM operativo: los ensayos se generarán en vivo." };
  } catch {
    return { status: "error", message: "No se pudo alcanzar el endpoint del LLM." };
  }
}

export interface CacheInfo {
  store: string;
  entries: number;
  label: string;
}

export function useCacheInfo(): { info: CacheInfo[]; refresh: () => void; purge: () => Promise<void> } {
  const [info, setInfo] = useState<CacheInfo[]>([]);

  const refresh = useCallback(() => {
    void cacheStats().then(setInfo).catch(() => setInfo([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const purge = useCallback(async () => {
    await Promise.all([
      cacheClearStore("api-cache"),
      cacheClearStore("palettes"),
      cacheClearStore("essays"),
    ]);
    resetSeedBundle();
    refresh();
    if (typeof caches !== "undefined" && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  }, [refresh]);

  return { info, refresh, purge };
}

/** Aplica la configuración al cliente TMDB y devuelve utilidades de sesión. */
export function useSettingsSync(settings: AppSettings): void {
  const apiKey = settings.tmdbApiKey.trim();
  const readToken = settings.tmdbReadToken.trim();
  useEffect(() => {
    setRuntimeCredentials({
      apiKey,
      readToken,
      language: settings.language,
      corsProxy: settings.corsProxyUrl.trim(),
    });
  }, [apiKey, readToken, settings.language, settings.corsProxyUrl]);
}

export function useBuildInfo() {
  return BUILD_ENV;
}
