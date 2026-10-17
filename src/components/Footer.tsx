import { memo } from "react";
import { BUILD_ENV } from "@/lib/env";
import { APP_TAGLINE, TMDB_WWW } from "@/lib/constants";
import { isApplePlatform } from "@/lib/env";
import { ExternalLink } from "./Link";
import { IconAperture } from "./ui/Icons";

export const Footer = memo(function Footer() {
  const apple = isApplePlatform();
  const shortcuts: [string, string][] = [
    [`${apple ? "⌘" : "Ctrl"} K`, "Buscador global"],
    [`${apple ? "⌘" : "Ctrl"} ,`, "Configuración"],
    ["G → H", "Volver a la cartelera"],
    ["← →", "Navegar fotogramas / películas"],
    ["Esc", "Cerrar capa activa"],
  ];

  return (
    <footer className="hairline-t relative mt-24 bg-black/85">
      <div className="mx-auto grid w-full max-w-[1680px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-12">
        <div>
          <div className="flex items-center gap-3">
            <span className="accent-text">
              <IconAperture size={20} />
            </span>
            <span className="type-display text-[22px] text-[#f4f1ea]">Cinemateca Sensorial</span>
          </div>
          <p className="mt-4 max-w-[46ch] font-serif text-[15.5px] italic leading-relaxed text-[#8a8a94]">{APP_TAGLINE}</p>
          <p className="mt-5 max-w-[54ch] font-mono text-[9.5px] uppercase leading-[1.9] tracking-[0.16em] text-[#7e7e88]">
            Explorador independiente. Los metadatos y las imágenes provienen de TMDB y pertenecen a sus respectivos
            titulares. Esta herramienta no aloja ni reproduce ninguna película.
          </p>
        </div>

        <div>
          <p className="type-eyebrow mb-5 text-[9px]">Atajos</p>
          <ul className="flex flex-col gap-2.5">
            {shortcuts.map(([keys, label]) => (
              <li key={keys} className="flex items-center gap-3">
                <kbd className="type-mono min-w-[74px] rounded-[2px] border border-white/10 bg-white/[0.02] px-2 py-1 text-center text-[9px] text-[#9d9da7]">
                  {keys}
                </kbd>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#7e7e88]">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="type-eyebrow mb-5 text-[9px]">Datos</p>
          <ul className="flex flex-col gap-2.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#7e7e88]">
            <li>
              <ExternalLink
                href={TMDB_WWW}
                aria-label="The Movie Database"
                className="transition-colors duration-300 hover:text-[color:var(--accent)]"
              >
                The Movie Database
              </ExternalLink>
            </li>
            <li>
              <ExternalLink
                href="https://www.imdb.com/"
                aria-label="IMDb · enlace externo"
                className="transition-colors duration-300 hover:text-[color:var(--accent)]"
              >
                IMDb · enlace externo
              </ExternalLink>
            </li>
            <li>
              <ExternalLink
                href="https://letterboxd.com/"
                aria-label="Letterboxd · enlace externo"
                className="transition-colors duration-300 hover:text-[color:var(--accent)]"
              >
                Letterboxd · enlace externo
              </ExternalLink>
            </li>
            <li>
              <ExternalLink
                href="https://www.filmaffinity.com/"
                aria-label="FilmAffinity · enlace externo"
                className="transition-colors duration-300 hover:text-[color:var(--accent)]"
              >
                FilmAffinity · enlace externo
              </ExternalLink>
            </li>
          </ul>
          <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-[#7e7e88]">
            Build {BUILD_ENV.buildStamp.slice(0, 10)} · v{BUILD_ENV.version.slice(0, 10)}
          </p>
        </div>
      </div>
      <div className="hairline-t flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7e7e88]">
          Negro OLED #000000 · 60 fps · caché local
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7e7e88]">Fin de la proyección</span>
      </div>
    </footer>
  );
});
