import { memo } from "react";
import { LIMITS } from "@/lib/constants";
import { imageSources } from "@/lib/images";
import { useSettings } from "@/app/settings";
import type { TmdbCredits } from "@/lib/types";

export interface CreditsStripProps {
  credits: TmdbCredits | null;
}

const CREW_ROLES: { job: string; label: string }[] = [
  { job: "Director", label: "Dirección" },
  { job: "Director of Photography", label: "Fotografía" },
  { job: "Screenplay", label: "Guion" },
  { job: "Editor", label: "Montaje" },
  { job: "Original Music Composer", label: "Música" },
  { job: "Production Design", label: "Diseño de producción" },
];

function Credit({ name, role, path }: { name: string; role: string; path: string | null }) {
  const { settings } = useSettings();
  const source = imageSources({ path, kind: "profile", quality: settings.imageQuality });
  return (
    <li className="group flex w-[104px] shrink-0 flex-col gap-2.5 sm:w-[124px]">
      <span className="relative block w-full overflow-hidden rounded-[3px] bg-[#0a0a0c]" style={{ aspectRatio: "2 / 3" }}>
        {source.jpeg ? (
          <picture className="absolute inset-0 block">
            {source.avif ? <source srcSet={source.avif} type="image/avif" /> : null}
            {source.webp ? <source srcSet={source.webp} type="image/webp" /> : null}
            <img
              src={source.jpeg}
              alt={name}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover grayscale-[0.55] transition-[filter,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] group-hover:grayscale-0"
            />
          </picture>
        ) : (
          <span className="absolute inset-0 grid place-items-center font-serif text-[26px] text-[#7e7e88]">
            {name.slice(0, 1)}
          </span>
        )}
        <span
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_58%,rgba(0,0,0,0.82)_100%)]"
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-serif text-[14.5px] leading-tight text-[#ddd8ce]">{name}</span>
        <span className="mt-1 block truncate font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#7e7e88]">
          {role}
        </span>
      </span>
    </li>
  );
}

/** Equipo técnico clave + reparto principal, con retratos en escala de grises. */
export const CreditsStrip = memo(function CreditsStrip({ credits }: CreditsStripProps) {
  if (!credits) return null;

  const crewByName = new Map<string, string>();
  for (const member of credits.crew ?? []) {
    const role = CREW_ROLES.find((entry) => entry.job === member.job);
    if (role && !crewByName.has(role.label)) crewByName.set(role.label, member.name);
  }
  const cast = (credits.cast ?? []).slice(0, LIMITS.cast);

  return (
    <section className="border-t border-white/6 py-12" aria-labelledby="creditos-title">
      <header className="mb-7">
        <p className="type-eyebrow text-[9px]">Ficha técnica y reparto</p>
        <h2 id="creditos-title" className="type-display mt-3 text-[clamp(22px,2.8vw,32px)] text-[#f4f1ea]">
          Quién lo hizo posible
        </h2>
      </header>

      {crewByName.size > 0 ? (
        <dl className="mb-9 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-white/6 py-6 sm:grid-cols-3 lg:grid-cols-6">
          {CREW_ROLES.filter((role) => crewByName.has(role.label)).map((role) => (
            <div key={role.label} className="min-w-0">
              <dt className="type-mono text-[8.5px] uppercase tracking-[0.2em] text-[#7e7e88]">{role.label}</dt>
              <dd className="mt-2 truncate font-serif text-[15.5px] text-[#e3dfd6]" title={crewByName.get(role.label)}>
                {crewByName.get(role.label)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {cast.length > 0 ? (
        <div className="hide-scrollbar -mx-1 overflow-x-auto px-1 pb-2">
          <ul className="flex gap-4">
            {cast.map((member) => (
              <Credit key={member.id} name={member.name} role={member.character || "Reparto"} path={member.profile_path} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="font-serif text-[16px] italic text-[#8a8a94]">
          TMDB no conserva el reparto de este título.
        </p>
      )}
    </section>
  );
});
