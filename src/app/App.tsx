import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { restoreDeepLink, useRoute, navigate, navigateBack } from "@/app/router";
import { SettingsProvider, useSettings } from "@/app/settings";
import { ThemeProvider, useTheme } from "@/app/theme";
import { useToasts } from "@/app/useToasts";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { emit, on } from "@/app/bus";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GrainOverlay } from "@/components/ui/GrainOverlay";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { ToastViewport } from "@/components/ui/Toast";
import { DetailSkeleton } from "@/components/ui/Skeleton";
import { Home } from "@/pages/Home";
import { NotFound } from "@/pages/NotFound";

const FilmDetail = lazy(() =>
  import("@/pages/FilmDetail").then((module) => ({ default: module.FilmDetail })),
);

function Shell() {
  const route = useRoute();
  const { settings } = useSettings();
  const { setPalette } = useTheme();
  const { toasts, push, dismiss } = useToasts();

  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeFilm, setActiveFilm] = useState<{ id: number | null; title: string }>({ id: null, title: "" });

  /* --- restaura deep-links servidos por el 404.html de GitHub Pages --- */
  useEffect(() => {
    restoreDeepLink();
    window.dispatchEvent(new Event("cinemateca:ready"));
  }, []);

  /* --- restablece el acento cromático al salir de una ficha --- */
  useEffect(() => {
    if (route.name !== "film") setPalette(null);
  }, [route.name, setPalette]);

  const notify = useCallback(
    (message: string, kind: "info" | "success" | "error" = "info", detail?: string) => {
      push(message, kind, detail);
    },
    [push],
  );

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const revealMoods = useCallback(() => {
    if (route.name !== "home") navigate("/");
    window.setTimeout(() => emit("moods:reveal"), 140);
  }, [route.name]);

  const handleProgress = useCallback((percent: number) => setProgress(percent), []);
  const handleActiveFilm = useCallback(
    (id: number | null, title = "") => setActiveFilm({ id, title }),
    [],
  );

  const shortcuts = useMemo(
    () => ({
      onSearch: openSearch,
      onSettings: openSettings,
      onClose: () => {
        if (searchOpen) {
          setSearchOpen(false);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (route.name === "film") navigateBack("/");
      },
      onHome: () => navigate("/"),
      onBack: () => {
        if (searchOpen || settingsOpen) return;
        navigateBack("/");
      },
      onForward: () => {
        if (searchOpen || settingsOpen) return;
        if (window.history.length > 1) window.history.forward();
      },
    }),
    [openSearch, openSettings, searchOpen, settingsOpen, route.name],
  );

  useKeyboardShortcuts(shortcuts);

  /* --- bus de interfaz --- */
  useEffect(() => on("settings:open", openSettings), [openSettings]);
  useEffect(() => on("search:open", openSearch), [openSearch]);

  const filmId = route.name === "film" ? Number.parseInt(route.params.id, 10) : Number.NaN;

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-black">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[95] focus:rounded-[2px] focus:bg-black focus:px-4 focus:py-2 focus:font-mono focus:text-[10px] focus:uppercase focus:tracking-[0.2em] focus:text-[color:var(--accent)]"
      >
        Saltar al contenido
      </a>

      <Header
        onOpenSearch={openSearch}
        onOpenSettings={openSettings}
        onOpenMoods={revealMoods}
        activeFilmId={activeFilm.id}
        progress={progress}
      />

      <main id="contenido" className="flex-1">
        <Suspense fallback={<DetailSkeleton />}>
          {route.name === "home" ? (
            <Home key="home" onOpenSettings={openSettings} onProgress={handleProgress} onActiveFilm={handleActiveFilm} />
          ) : null}
          {route.name === "film" && Number.isFinite(filmId) && filmId > 0 ? (
            <FilmDetail
              key={filmId}
              id={filmId}
              onNotify={notify}
              onOpenSettings={openSettings}
              onActiveFilm={(nextId, title) => handleActiveFilm(nextId, title)}
              onProgress={handleProgress}
            />
          ) : null}
          {route.name === "not-found" || (route.name === "film" && (!Number.isFinite(filmId) || filmId <= 0)) ? (
            <NotFound key={`404-${route.path}`} />
          ) : null}
        </Suspense>
      </main>

      {route.name !== "not-found" ? <Footer /> : null}

      <GrainOverlay enabled={settings.grainEffect && settings.heavyAnimations} />

      <CommandPalette open={searchOpen} onClose={closeSearch} onOpenSettings={openSettings} />
      <SettingsModal open={settingsOpen} onClose={closeSettings} onNotify={notify} />
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export function App() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SettingsProvider>
  );
}
