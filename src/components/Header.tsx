import { memo, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { isApplePlatform } from "@/lib/env";
import { Link } from "./Link";
import { IconAperture, IconGrid, IconSearch, IconSettings } from "./ui/Icons";

export interface HeaderProps {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenMoods: () => void;
  activeFilmId?: number | null;
  progress?: number;
}

export const Header = memo(function Header({
  onOpenSearch,
  onOpenSettings,
  onOpenMoods,
  activeFilmId,
  progress = 0,
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const apple = isApplePlatform();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        scrolled ? "border-b border-white/8 bg-black/72 backdrop-blur-xl" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-[62px] w-full max-w-[1680px] items-center gap-3 px-4 sm:h-[70px] sm:gap-5 sm:px-8 lg:px-12">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="text-[#d9d5cc] transition-colors duration-500 group-hover:text-[color:var(--accent)]">
            <IconAperture size={19} />
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.36em] text-[#d9d5cc]">Cinemateca</span>
            <span className="mt-[3px] font-mono text-[8px] uppercase tracking-[0.42em] text-[#7e7e88]">Sensorial</span>
          </span>
        </Link>

        <span className="mx-1 hidden h-5 w-px bg-white/8 sm:block" aria-hidden="true" />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Secciones">
          <button
            type="button"
            onClick={onOpenMoods}
            className="flex items-center gap-2 rounded-[2px] px-3 py-2 font-mono text-[9.5px] uppercase tracking-[0.24em] text-[#8b8b95] transition-colors duration-300 hover:text-[#f4f1ea]"
          >
            <IconGrid size={13} />
            Vibras
          </button>
          {activeFilmId ? (
            <Link
              to={`/film/${activeFilmId}`}
              className="rounded-[2px] px-3 py-2 font-mono text-[9.5px] uppercase tracking-[0.24em] text-[#8b8b95] transition-colors duration-300 hover:text-[#f4f1ea]"
            >
              Ficha abierta
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            ref={searchButtonRef}
            type="button"
            onClick={onOpenSearch}
            className="group flex items-center gap-3 rounded-[2px] border border-white/10 bg-white/[0.02] py-2 pl-3 pr-2 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[color:var(--accent-line)] hover:bg-white/[0.045] sm:pr-3"
          >
            <span className="text-[#8a8a94] transition-colors duration-300 group-hover:text-[color:var(--accent)]">
              <IconSearch size={14} />
            </span>
            <span className="hidden font-mono text-[9.5px] uppercase tracking-[0.24em] text-[#8a8a94] transition-colors duration-300 group-hover:text-[#c9c5bb] lg:block">
              Buscar en todas las películas del mundo
            </span>
            <kbd className="type-mono hidden rounded-[2px] border border-white/10 bg-black/60 px-1.5 py-[3px] text-[9px] text-[#8a8a94] sm:block">
              {apple ? "⌘" : "Ctrl"} K
            </kbd>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/10 text-[#8b8b95] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:rotate-45 hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
            aria-label="Configuración"
          >
            <IconSettings size={15} />
          </button>
        </div>
      </div>

      <div className="relative h-px w-full overflow-hidden bg-white/5" aria-hidden="true">
        <span
          className="absolute inset-y-0 left-0 bg-[color:var(--accent)] transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%`, opacity: progress > 0 ? 0.85 : 0 }}
        />
      </div>
    </header>
  );
});
