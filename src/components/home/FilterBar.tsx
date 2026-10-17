import { memo, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { COLOR_FAMILIES } from "@/lib/constants";
import { MOODS } from "@/lib/moods";
import { withAlpha } from "@/lib/colors";
import type { ColorFamilyId, MoodId } from "@/lib/types";
import type { SortMode } from "@/hooks/useFilmFeed";
import { IconChevronDown, IconClose, IconSliders } from "../ui/Icons";

export interface FilterBarProps {
  mood: MoodId | null;
  year: number | null;
  decade: number | null;
  family: ColorFamilyId | null;
  sort: SortMode;
  resultCount: number;
  analyzed: number;
  familyCounts?: Partial<Record<ColorFamilyId, number>>;
  onMood: (mood: MoodId | null) => void;
  onYear: (year: number | null) => void;
  onDecade: (decade: number | null) => void;
  onFamily: (family: ColorFamilyId | null) => void;
  onSort: (sort: SortMode) => void;
  onReset: () => void;
}

const SORTS: { id: SortMode; label: string }[] = [
  { id: "essence", label: "Esencia" },
  { id: "rating", label: "Valoración" },
  { id: "recent", label: "Más recientes" },
  { id: "popularity", label: "Popularidad" },
  { id: "az", label: "A → Z" },
];

function currentYear(): number {
  return new Date().getFullYear();
}

export const FilterBar = memo(function FilterBar({
  mood,
  year,
  decade,
  family,
  sort,
  resultCount,
  analyzed,
  familyCounts,
  onMood,
  onYear,
  onDecade,
  onFamily,
  onSort,
  onReset,
}: FilterBarProps) {
  const [yearOpen, setYearOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const yearRef = useRef<HTMLDivElement | null>(null);
  const colorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (yearRef.current && !yearRef.current.contains(target)) setYearOpen(false);
      if (colorRef.current && !colorRef.current.contains(target)) setColorOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setYearOpen(false);
        setColorOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const decades = useMemo(() => {
    const top = Math.floor(currentYear() / 10) * 10;
    const list: number[] = [];
    for (let d = top; d >= 1920; d -= 10) list.push(d);
    return list;
  }, []);

  const years = useMemo(() => {
    const top = currentYear() + 1;
    const list: number[] = [];
    for (let y = top; y >= 1927; y -= 1) list.push(y);
    return list;
  }, []);

  const activeFilters = [mood ? "vibra" : null, year || decade ? "época" : null, family ? "color" : null].filter(
    Boolean,
  ).length;

  return (
    <div className="sticky top-[62px] z-30 -mx-4 mb-10 border-y border-white/6 bg-black/78 px-4 py-3.5 backdrop-blur-xl sm:top-[70px] sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <div className="flex flex-col gap-3.5">
        {/* --- vibras --- */}
        <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          <button
            type="button"
            onClick={() => onMood(null)}
            className={cx(
              "shrink-0 rounded-full border px-3.5 py-[7px] font-mono text-[9.5px] uppercase tracking-[0.2em] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
              mood === null
                ? "border-[color:var(--accent-line)] bg-[color:var(--accent)] text-black"
                : "border-white/10 text-[#8b8b95] hover:border-white/25 hover:text-[#e3dfd6]",
            )}
          >
            Todo el cine
          </button>
          {MOODS.map((entry) => {
            const active = mood === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                title={entry.description}
                onClick={() => onMood(active ? null : entry.id)}
                className={cx(
                  "group shrink-0 rounded-full border px-3.5 py-[7px] font-mono text-[9.5px] uppercase tracking-[0.2em] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  active ? "text-black" : "border-white/10 text-[#8b8b95] hover:border-white/25 hover:text-[#e3dfd6]",
                )}
                style={
                  active
                    ? { backgroundColor: entry.accent, borderColor: entry.accent, boxShadow: `0 0 26px -6px ${withAlpha(entry.accent, 0.85)}` }
                    : undefined
                }
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        {/* --- época · color · orden --- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="relative" ref={yearRef}>
            <button
              type="button"
              onClick={() => {
                setYearOpen((v) => !v);
                setColorOpen(false);
              }}
              aria-expanded={yearOpen}
              className={cx(
                "flex items-center gap-2 border-b px-0.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] transition-colors duration-300",
                year || decade ? "border-[color:var(--accent-line)] accent-text" : "border-white/10 text-[#8b8b95] hover:text-[#e3dfd6]",
              )}
            >
              Época · {decade ? `${decade}s` : year ? String(year) : "todas"}
              <IconChevronDown size={12} className={cx("transition-transform duration-300", yearOpen && "rotate-180")} />
            </button>
            {yearOpen ? (
              <div className="glass scale-in absolute left-0 top-[calc(100%+10px)] z-40 w-[268px] rounded-[3px] p-3">
                <p className="type-eyebrow mb-2.5 px-1 text-[8.5px]">Décadas</p>
                <div className="mb-3 grid grid-cols-4 gap-1.5">
                  {decades.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => {
                        onDecade(decade === entry ? null : entry);
                        onYear(null);
                      }}
                      className={cx(
                        "rounded-[2px] border py-1.5 font-mono text-[9.5px] tracking-[0.08em] transition-colors duration-300",
                        decade === entry
                          ? "border-[color:var(--accent-line)] accent-tint accent-text"
                          : "border-white/8 text-[#8b8b95] hover:border-white/20 hover:text-[#e3dfd6]",
                      )}
                    >
                      {entry}s
                    </button>
                  ))}
                </div>
                <p className="type-eyebrow mb-2 px-1 text-[8.5px]">Año exacto</p>
                <div className="hide-scrollbar flex max-h-[168px] flex-col gap-0.5 overflow-y-auto pr-1">
                  {years.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => {
                        onYear(year === entry ? null : entry);
                        onDecade(null);
                        setYearOpen(false);
                      }}
                      className={cx(
                        "rounded-[2px] px-2 py-1.5 text-left font-mono text-[10px] tracking-[0.1em] transition-colors duration-200",
                        year === entry ? "accent-tint accent-text" : "text-[#8b8b95] hover:bg-white/5 hover:text-[#e3dfd6]",
                      )}
                    >
                      {entry}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative" ref={colorRef}>
            <button
              type="button"
              onClick={() => {
                setColorOpen((v) => !v);
                setYearOpen(false);
              }}
              aria-expanded={colorOpen}
              className={cx(
                "flex items-center gap-2 border-b px-0.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] transition-colors duration-300",
                family ? "border-[color:var(--accent-line)] accent-text" : "border-white/10 text-[#8b8b95] hover:text-[#e3dfd6]",
              )}
            >
              <span className="flex gap-[2px]">
                {COLOR_FAMILIES.slice(0, 6).map((entry) => (
                  <span key={entry.id} className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: entry.hex }} />
                ))}
              </span>
              Color dominante
              <IconChevronDown size={12} className={cx("transition-transform duration-300", colorOpen && "rotate-180")} />
            </button>
            {colorOpen ? (
              <div className="glass scale-in absolute left-0 top-[calc(100%+10px)] z-40 w-[300px] rounded-[3px] p-3">
                <p className="type-eyebrow mb-3 px-1 text-[8.5px]">
                  Extraído del póster · {analyzed} analizados
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {COLOR_FAMILIES.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        onFamily(family === entry.id ? null : entry.id);
                        if (family !== entry.id) setColorOpen(false);
                      }}
                      className={cx(
                        "flex items-center gap-2 rounded-[2px] border px-2 py-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        family === entry.id ? "border-white/25 bg-white/[0.06]" : "border-transparent hover:bg-white/[0.04]",
                      )}
                    >
                      <span
                        className="h-[13px] w-[13px] shrink-0 rounded-full"
                        style={{ backgroundColor: entry.hex, boxShadow: family === entry.id ? `0 0 16px -2px ${entry.hex}` : undefined }}
                      />
                      <span className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-[#9d9da7]">
                        {entry.label}
                      </span>
                      <span
                        className={cx(
                          "ml-auto font-mono text-[8.5px] tabular-nums",
                          (familyCounts?.[entry.id] ?? 0) > 0 ? "text-[#9d9da7]" : "text-[#7e7e88]",
                        )}
                      >
                        {familyCounts?.[entry.id] ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#7e7e88]">
              <IconSliders size={12} />
            </span>
            {SORTS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSort(entry.id)}
                className={cx(
                  "rounded-[2px] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] transition-colors duration-300",
                  sort === entry.id ? "accent-tint accent-text" : "text-[#8a8a94] hover:text-[#c9c5bb]",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="type-mono hidden text-[9px] uppercase tracking-[0.2em] text-[#7e7e88] sm:block">
              {resultCount} títulos{activeFilters > 0 ? ` · ${activeFilters} filtros` : ""}
            </span>
            {activeFilters > 0 || sort !== "essence" ? (
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#8b8b95] transition-colors duration-300 hover:text-[#f0938a]"
              >
                <IconClose size={11} />
                Limpiar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});
