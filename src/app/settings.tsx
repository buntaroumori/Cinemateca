import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BUILD_ENV, DEFAULT_SETTINGS, prefersReducedMotion } from "@/lib/env";
import { readLocalSettings, writeLocalSettings } from "@/lib/seed";
import { setRuntimeCredentials } from "@/lib/tmdb";
import { setImageBase } from "@/lib/images";
import type { AppSettings } from "@/lib/types";

interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
  hasTmdbCredentials: boolean;
  hasLlmCredentials: boolean;
  reducedMotion: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function mergeSettings(): AppSettings {
  const stored = readLocalSettings();
  const merged: AppSettings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  if (!merged.tmdbApiKey && BUILD_ENV.buildTimeApiKey) merged.tmdbApiKey = BUILD_ENV.buildTimeApiKey;
  if (!merged.tmdbReadToken && BUILD_ENV.buildTimeReadToken) merged.tmdbReadToken = BUILD_ENV.buildTimeReadToken;
  if (!merged.corsProxyUrl && BUILD_ENV.buildTimeCorsProxy) merged.corsProxyUrl = BUILD_ENV.buildTimeCorsProxy;
  if (!merged.tmdbImageBase && BUILD_ENV.buildTimeImageBase) merged.tmdbImageBase = BUILD_ENV.buildTimeImageBase;
  if (!merged.llmProvider && BUILD_ENV.buildTimeLlmProvider) merged.llmProvider = BUILD_ENV.buildTimeLlmProvider;
  if (!merged.llmModel && BUILD_ENV.buildTimeLlmModel) merged.llmModel = BUILD_ENV.buildTimeLlmModel;
  if (!merged.llmBaseUrl && BUILD_ENV.buildTimeLlmBaseUrl) merged.llmBaseUrl = BUILD_ENV.buildTimeLlmBaseUrl;
  if (merged.reduceDataUsage && merged.imageQuality === "cine") merged.imageQuality = "equilibrada";
  return merged;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => mergeSettings());
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setImageBase(settings.tmdbImageBase || BUILD_ENV.buildTimeImageBase);
  }, [settings.tmdbImageBase]);

  useEffect(() => {
    setRuntimeCredentials({
      apiKey: settings.tmdbApiKey.trim(),
      readToken: settings.tmdbReadToken.trim(),
      language: settings.language,
      corsProxy: settings.corsProxyUrl.trim(),
    });
  }, [settings.tmdbApiKey, settings.tmdbReadToken, settings.language, settings.corsProxyUrl]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = reducedMotion ? "reduced" : "full";
    root.dataset.grain = settings.grainEffect && !reducedMotion ? "on" : "off";
    root.dataset.quality = settings.imageQuality;
  }, [settings.grainEffect, settings.imageQuality, reducedMotion]);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      writeLocalSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const fresh: AppSettings = { ...DEFAULT_SETTINGS };
    writeLocalSettings(fresh);
    setSettings(fresh);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      update,
      reset,
      hasTmdbCredentials: Boolean(settings.tmdbApiKey.trim() || settings.tmdbReadToken.trim()),
      hasLlmCredentials: Boolean(settings.llmApiKey.trim() && settings.llmProvider),
      reducedMotion,
    }),
    [settings, update, reset, reducedMotion],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings debe usarse dentro de <SettingsProvider>");
  }
  return context;
}

export function useSettingsValue(): AppSettings {
  return useSettings().settings;
}
