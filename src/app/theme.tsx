import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { withAlpha } from "@/lib/colors";
import { emptyPalette } from "@/lib/colors";
import type { Palette } from "@/lib/types";

/**
 * Contexto de identidad cromática: la paleta de la película activa tiñe
 * botones, acentos, glows y el grafo de afinidades mediante variables CSS
 * sobre :root. Cuando no hay película activa se usa el latón editorial.
 */

interface ThemeContextValue {
  palette: Palette;
  setPalette: (palette: Palette | null) => void;
  clearPalette: () => void;
  accent: string;
}

const DEFAULT_ACCENT = "#c9a227";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<Palette | null>(null);

  const apply = useCallback((next: Palette | null) => {
    const root = document.documentElement;
    const active = next ?? emptyPalette();
    const accent = next ? next.accentHex : DEFAULT_ACCENT;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-soft", next ? next.accentSoftHex : "#3a3115");
    root.style.setProperty("--accent-ink", active.textOnAccent || "#000000");
    root.style.setProperty("--accent-glow", withAlpha(accent, 0.32));
    root.style.setProperty("--accent-line", withAlpha(accent, 0.5));
    root.style.setProperty(
      "--ambient",
      next && next.colors.length
        ? `radial-gradient(90% 60% at 12% 0%, ${withAlpha(next.colors[0].hex, 0.16)} 0%, transparent 62%), radial-gradient(80% 55% at 92% 8%, ${withAlpha(accent, 0.13)} 0%, transparent 60%)`
        : "none",
    );
  }, []);

  useEffect(() => {
    apply(palette);
  }, [palette, apply]);

  const setPalette = useCallback((next: Palette | null) => setPaletteState(next), []);
  const clearPalette = useCallback(() => setPaletteState(null), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ palette: palette ?? emptyPalette(), setPalette, clearPalette, accent: palette?.accentHex ?? DEFAULT_ACCENT }),
    [palette, setPalette, clearPalette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return context;
}
