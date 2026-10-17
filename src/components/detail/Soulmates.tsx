import { memo } from "react";
import { cx, formatScore, truncate } from "@/lib/format";
import { imageSources } from "@/lib/images";
import { Link } from "../Link";
import { useSettings } from "@/app/settings";
import { EssaySkeleton } from "../ui/Skeleton";
import { IconArrowRight, IconSparkle } from "../ui/Icons";
import type { Essay } from "@/lib/types";
import type { Soulmate } from "@/lib/essays";

export interface SoulmatesProps {
  sourceTitle: string;
  soulmates: Soulmate[];
  essays: (Essay | null)[];
  loading: boolean;
  filmIds: number[];
}

const ORIGIN_LABEL: Record<Essay["source"], string> = {
  llm: "Ensayo generado por LLM",
  local: "Motor sensorial local",
  seed: "Ensayo precargado en el build",
};

/**
 * Análisis de "alma gemela": las tres películas más afines con su mini-ensayo.
 * El texto llega del LLM configurado por el usuario o, en su defecto, del motor
 * determinista que mide keywords, década y distancia cromática real.
 */
export const Soulmates = memo(function Soulmates({
  sourceTitle,
  soulmates,
  essays,
  loading,
  filmIds,
}: SoulmatesProps) {
  const { settings } = useSettings();
  const top = soulmates.slice(0, 3);

  return (
    <section className="border-t border-white/6 py-14" aria-labelledby="almas-title">
      <header className="mb-9 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="type-eyebrow flex items-center gap-2 text-[9px]">
            <IconSparkle size={12} />
            Análisis de alma gemela
          </p>
          <h2 id="almas-title" className="type-display mt-3 text-[clamp(24px,3.2vw,38px)] text-[#f4f1ea]">
            Las tres películas que laten igual
          </h2>
          <p className="mt-3 max-w-[64ch] font-serif text-[16px] italic leading-relaxed text-[#8b8b95]">
            Mini-ensayos de tres líneas sobre lo que <span className="not-italic text-[#d9d5cc]">{sourceTitle}</span>{" "}
            comparte con sus vecinas más íntimas: contraste fotográfico, dilema moral y gramática del tiempo.
          </p>
        </div>
        <p className="type-mono text-[9px] uppercase tracking-[0.18em] text-[#7e7e88]">
          {settings.llmProvider ? `Motor: ${settings.llmProvider}` : "Motor: sensorial local"}
        </p>
      </header>

      {loading && top.length === 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="hairline rounded-[3px] bg-white/[0.012] p-5">
              <div className="mb-5 flex gap-4">
                <span className="shimmer relative block h-[112px] w-[75px] shrink-0 overflow-hidden rounded-[2px] bg-[#101013]" />
                <span className="flex flex-1 flex-col gap-2.5">
                  <span className="shimmer relative block h-[13px] w-2/3 overflow-hidden rounded-[2px] bg-[#101013]" />
                  <span className="shimmer relative block h-[9px] w-1/3 overflow-hidden rounded-[2px] bg-[#101013]" />
                </span>
              </div>
              <EssaySkeleton />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {top.map((soulmate, index) => {
            const essay = essays[index] ?? null;
            const poster = imageSources({
              path: soulmate.fingerprint.posterPath,
              kind: "posterSmall",
              quality: settings.imageQuality,
            });
            const accent = soulmate.fingerprint.palette?.accentHex ?? "#c9a227";
            return (
              <article
                key={soulmate.fingerprint.id}
                className="fade-rise group relative flex flex-col overflow-hidden rounded-[3px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.028)_0%,rgba(0,0,0,0.4)_100%)] transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:border-white/16"
                style={{ animationDelay: `${index * 110}ms`, boxShadow: `0 40px 90px -70px ${accent}` }}
              >
                <span
                  className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
                  aria-hidden="true"
                />
                <div className="flex gap-4 p-5">
                  <Link
                    to={`/film/${soulmate.fingerprint.id}`}
                    className="block h-[124px] w-[83px] shrink-0 overflow-hidden rounded-[2px] bg-[#0a0a0c]"
                    aria-label={`Abrir la ficha de ${soulmate.fingerprint.title}`}
                  >
                    {poster.jpeg ? (
                      <picture className="block h-full w-full">
                        {poster.avif ? <source srcSet={poster.avif} type="image/avif" /> : null}
                        {poster.webp ? <source srcSet={poster.webp} type="image/webp" /> : null}
                        <img
                          src={poster.jpeg}
                          alt={`Póster de ${soulmate.fingerprint.title}`}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                        />
                      </picture>
                    ) : null}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="type-mono text-[8.5px] uppercase tracking-[0.22em]" style={{ color: accent }}>
                      {index === 0 ? "Primera afinidad" : index === 1 ? "Segunda afinidad" : "Tercera afinidad"} ·{" "}
                      {(soulmate.score.total * 100).toFixed(0)}%
                    </p>
                    <h3 className="type-display mt-2 text-[21px] leading-tight text-[#f4f1ea]">
                      <Link to={`/film/${soulmate.fingerprint.id}`} className="transition-colors duration-300 hover:text-[color:var(--accent)]">
                        {soulmate.fingerprint.title}
                      </Link>
                    </h3>
                    <p className="type-mono mt-1.5 text-[9px] uppercase tracking-[0.16em] text-[#8a8a94]">
                      {soulmate.fingerprint.year ?? "s.a."}
                      {soulmate.fingerprint.runtime ? ` · ${soulmate.fingerprint.runtime} min` : ""} ·{" "}
                      {formatScore(soulmate.fingerprint.rating)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between gap-5 px-5 pb-5">
                  {essay ? (
                    <div>
                      <p className="type-display text-[19px] leading-snug text-[#ece8df]">{essay.headline}</p>
                      <ol className="mt-4 flex flex-col gap-3">
                        {essay.lines.map((line, lineIndex) => (
                          <li key={lineIndex} className="flex gap-3">
                            <span className="type-mono mt-[3px] shrink-0 text-[9px] tracking-[0.1em] text-[#7e7e88]">
                              {String(lineIndex + 1).padStart(2, "0")}
                            </span>
                            <p className="font-serif text-[15.5px] leading-[1.62] text-[#b6b1a6] text-pretty">{line}</p>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-4 font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#7e7e88]">
                        {ORIGIN_LABEL[essay.source]}
                        {essay.model ? ` · ${essay.model}` : ""}
                      </p>
                    </div>
                  ) : (
                    <EssaySkeleton />
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {soulmate.score.sharedKeywords.slice(0, 3).map((keyword) => (
                      <span
                        key={keyword.id}
                        className="rounded-full border border-white/8 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-[#8a8a94]"
                      >
                        {keyword.name}
                      </span>
                    ))}
                    {soulmate.fingerprint.overview ? (
                      <span className="sr-only">{truncate(soulmate.fingerprint.overview, 140)}</span>
                    ) : null}
                  </div>

                  <Link
                    to={`/film/${soulmate.fingerprint.id}`}
                    className={cx(
                      "flex items-center gap-2 self-start font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#9d9da7]",
                      "transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:gap-3.5 hover:text-[color:var(--accent)]",
                    )}
                  >
                    Abrir su deep dive
                    <IconArrowRight size={12} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {filmIds.length > 0 && top.length === 0 && !loading ? (
        <p className="max-w-[64ch] font-serif text-[16px] italic leading-relaxed text-[#8a8a94]">
          Todavía no hay vecindad suficiente para sostener un ensayo: TMDB no devuelve recomendaciones ni títulos
          similares para esta película.
        </p>
      ) : null}
    </section>
  );
});
