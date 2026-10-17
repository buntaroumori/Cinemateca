import { memo, useCallback, useEffect, useState } from "react";
import { cx } from "@/lib/format";
import { COLOR_FAMILY_MAP } from "@/lib/constants";
import { imageBase } from "@/lib/images";
import { contrastRatio, hexToRgb, rgbToHsl, withAlpha } from "@/lib/colors";
import { copyToClipboard } from "@/lib/format";
import { extractPalette } from "@/lib/colors";
import type { Palette } from "@/lib/types";
import { IconCopy, IconCheck, IconPalette } from "../ui/Icons";

export interface ChromaticAnalysisProps {
  posterPalette: Palette | null;
  backdropPath: string | null;
  onNotify: (message: string, kind?: "info" | "success" | "error", detail?: string) => void;
}

function PaletteStrip({
  palette,
  label,
  onNotify,
}: {
  palette: Palette;
  label: string;
  onNotify: ChromaticAnalysisProps["onNotify"];
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback(
    async (hex: string) => {
      const ok = await copyToClipboard(hex);
      if (ok) {
        setCopied(hex);
        onNotify("HEX copiado", "success", `${hex} · ${label}`);
        window.setTimeout(() => setCopied((current) => (current === hex ? null : current)), 1600);
      } else {
        onNotify("No se pudo copiar", "error", hex);
      }
    },
    [label, onNotify],
  );

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="type-eyebrow text-[9px]">{label}</p>
        <p className="type-mono text-[9px] uppercase tracking-[0.16em] text-[#7e7e88]">
          clic para copiar el HEX
        </p>
      </div>

      <div className="flex h-[76px] w-full overflow-hidden rounded-[3px] border border-white/8">
        {palette.colors.map((color) => (
          <button
            key={color.hex}
            type="button"
            onClick={() => void copy(color.hex)}
            title={`${color.hex} · ${(color.population * 100).toFixed(1)} % del fotograma`}
            className="group relative h-full transition-[flex-grow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ flexGrow: Math.max(1, color.population * 6), backgroundColor: color.hex }}
          >
            <span className="absolute inset-0 flex items-end justify-center bg-black/0 pb-2 opacity-0 transition-all duration-400 group-hover:bg-black/45 group-hover:opacity-100">
              <span className="type-mono text-[9px] tracking-[0.12em] text-white">{color.hex}</span>
            </span>
          </button>
        ))}
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {palette.colors.map((color) => {
          const hsl = rgbToHsl({ r: color.rgb[0], g: color.rgb[1], b: color.rgb[2] });
          const contrast = contrastRatio(hexToRgb(color.hex), { r: 0, g: 0, b: 0 });
          const isCopied = copied === color.hex;
          return (
            <li key={color.hex}>
              <button
                type="button"
                onClick={() => void copy(color.hex)}
                className={cx(
                  "hairline group flex w-full items-center gap-3 rounded-[3px] bg-white/[0.012] px-3 py-2.5 text-left transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "hover:border-[color:var(--accent-line)] hover:bg-white/[0.05]",
                )}
              >
                <span
                  className="h-7 w-7 shrink-0 rounded-[2px] border border-white/10"
                  style={{ backgroundColor: color.hex, boxShadow: `0 0 20px -6px ${withAlpha(color.hex, 0.9)}` }}
                />
                <span className="min-w-0 flex-1">
                  <span className="type-mono block text-[10.5px] tracking-[0.1em] text-[#ece8df]">{color.hex}</span>
                  <span className="mt-1 block font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#7e7e88]">
                    H {Math.round(hsl.h)}° · S {(hsl.s * 100).toFixed(0)}% · L {(hsl.l * 100).toFixed(0)}%
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cx("transition-colors duration-300", isCopied ? "accent-text" : "text-[#7e7e88] group-hover:text-[#9d9da7]")}>
                    {isCopied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  </span>
                  <span className="type-mono text-[8px] tracking-[0.1em] text-[#7e7e88]">
                    {(color.population * 100).toFixed(0)}% · {contrast.toFixed(1)}:1
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Análisis cromático del film: 5 códigos HEX dominantes del póster y del
 * fotograma de apertura, con población, HSL y contraste WCAG sobre negro.
 */
export const ChromaticAnalysis = memo(function ChromaticAnalysis({
  posterPalette,
  backdropPath,
  onNotify,
}: ChromaticAnalysisProps) {
  const [framePalette, setFramePalette] = useState<Palette | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFramePalette(null);
    if (!backdropPath) return;
    void extractPalette(`${imageBase()}/w300${backdropPath}?itok=webp`)
      .then((palette) => {
        if (cancelled || !palette) return;
        setFramePalette(palette);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [backdropPath]);

  const family = posterPalette ? COLOR_FAMILY_MAP[posterPalette.dominantFamily] : null;

  return (
    <section className="border-t border-white/6 py-14" aria-labelledby="cromatico-title">
      <header className="mb-9 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="type-eyebrow flex items-center gap-2 text-[9px]">
            <IconPalette size={12} />
            Análisis cromático
          </p>
          <h2 id="cromatico-title" className="type-display mt-3 text-[clamp(24px,3.2vw,38px)] text-[#f4f1ea]">
            Los cinco colores que sostienen la película
          </h2>
        </div>
        {family && posterPalette ? (
          <div className="hairline flex items-center gap-3 rounded-[3px] px-4 py-3">
            <span className="h-8 w-8 rounded-full" style={{ backgroundColor: family.hex, boxShadow: `0 0 26px -6px ${family.hex}` }} />
            <span>
              <span className="type-eyebrow block text-[8.5px]">Familia dominante</span>
              <span className="type-mono mt-1 block text-[11px] tracking-[0.1em] text-[#ece8df]">{family.label}</span>
            </span>
            <span className="ml-2 flex flex-col gap-1 border-l border-white/8 pl-3">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#7e7e88]">
                Saturación {(posterPalette.saturationIndex * 100).toFixed(0)}%
              </span>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#7e7e88]">
                Luminancia {(posterPalette.averageLuminance * 100).toFixed(0)}%
              </span>
            </span>
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-10">
        {posterPalette ? (
          <PaletteStrip palette={posterPalette} label="Póster oficial" onNotify={onNotify} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="type-eyebrow text-[9px]">Póster oficial</p>
            <span className="shimmer relative block h-[76px] w-full overflow-hidden rounded-[3px] bg-[#0e0e11]" />
          </div>
        )}
        {framePalette ? (
          <PaletteStrip palette={framePalette} label="Fotograma de apertura" onNotify={onNotify} />
        ) : backdropPath ? (
          <div className="flex flex-col gap-3">
            <p className="type-eyebrow text-[9px]">Fotograma de apertura</p>
            <span className="shimmer relative block h-[76px] w-full overflow-hidden rounded-[3px] bg-[#0e0e11]" />
          </div>
        ) : null}
      </div>
    </section>
  );
});
