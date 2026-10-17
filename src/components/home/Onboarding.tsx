import { useState } from "react";
import { cx } from "@/lib/format";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { testTmdbCredentials } from "@/lib/settings-utils";
import { useSettings } from "@/app/settings";
import { IconAperture, IconArrowRight, IconKey } from "../ui/Icons";

export interface OnboardingProps {
  onOpenSettings: () => void;
  onExploreSeeds: () => void;
  seedsAvailable: boolean;
  seedCount: number;
}

/**
 * Primera apertura: sin credenciales TMDB no hay catálogo mundial. Se ofrece
 * la entrada ceremonial (clave propia) y el acceso inmediato a la colección
 * sensorial precargada en el build.
 */
export function Onboarding({ onOpenSettings, onExploreSeeds, seedsAvailable, seedCount }: OnboardingProps) {
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState(settings.tmdbApiKey);
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async () => {
    const value = draft.trim();
    if (!value) {
      setStatus("error");
      setMessage("Pega tu API Key v3 o tu Read Access Token v4.");
      return;
    }
    setStatus("testing");
    const candidate =
      value.startsWith("eyJ")
        ? { ...settings, tmdbReadToken: value, tmdbApiKey: "" }
        : { ...settings, tmdbApiKey: value, tmdbReadToken: "" };
    const result = await testTmdbCredentials(candidate);
    setStatus(result.status === "ok" ? "ok" : "error");
    setMessage(result.message);
    if (result.status === "ok") {
      update(value.startsWith("eyJ") ? { tmdbReadToken: value, tmdbApiKey: "" } : { tmdbApiKey: value, tmdbReadToken: "" });
    }
  };

  return (
    <section className="relative mx-auto flex w-full max-w-[900px] flex-col items-center px-5 pb-24 pt-[16vh] text-center sm:px-8">
      <span
        className="pointer-events-none absolute left-1/2 top-[6vh] h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-60 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, rgba(201,162,39,0.16), transparent 72%)" }}
        aria-hidden="true"
      />
      <span className="relative accent-text">
        <IconAperture size={30} />
      </span>
      <p className="type-eyebrow relative mt-7 text-[9px]">{APP_TAGLINE}</p>
      <h1 className="type-display relative mt-5 text-[clamp(38px,7.4vw,84px)] text-[#f4f1ea] text-balance">
        {APP_NAME}
      </h1>
      <p className="type-body relative mt-7 max-w-[62ch] text-pretty">
        Todas las películas del mundo, ordenadas por lo que provocan y no por lo que venden. Un catálogo que respira:
        cada póster se analiza cromáticamente en tu navegador y tiñe la interfaz con el alma del film que estás
        mirando.
      </p>

      <div className="relative mt-12 w-full max-w-[560px]">
        <div className="glass rounded-[4px] p-6 text-left">
          <p className="type-eyebrow mb-4 flex items-center gap-2 text-[9px]">
            <IconKey size={12} />
            Acceso al índice mundial
          </p>
          <label htmlFor="onboarding-key" className="sr-only">
            API Key de TMDB
          </label>
          <input
            id="onboarding-key"
            type="password"
            value={draft}
            spellCheck={false}
            autoComplete="off"
            placeholder="API Key v3 o Read Access Token v4"
            onChange={(event) => {
              setDraft(event.target.value);
              setStatus("idle");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            className="type-mono hairline w-full rounded-[3px] bg-black/60 px-3.5 py-3 text-[12px] text-[#ece8df] placeholder:text-[#7e7e88] focus:border-[color:var(--accent-line)] focus:outline-none"
          />
          <p className="mt-3 font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.14em] text-[#7e7e88]">
            Se guarda solo en tu navegador (localStorage) y viaja directa a themoviedb.org. Obtén una gratis en
            themoviedb.org → Settings → API.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void submit()}
              className="group flex items-center gap-2.5 rounded-[2px] bg-[color:var(--accent)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-black transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:gap-4"
            >
              {status === "testing" ? "Verificando" : "Abrir el catálogo"}
              <IconArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8b8b95] transition-colors duration-300 hover:text-[#f4f1ea]"
            >
              Configuración completa
            </button>
          </div>
          <p
            className={cx(
              "mt-4 font-mono text-[10px] uppercase tracking-[0.14em] transition-opacity duration-300",
              status === "ok" ? "accent-text" : status === "error" ? "text-[#f0938a]" : "text-[#7e7e88]",
              status === "idle" && "opacity-0",
            )}
            role="status"
          >
            {message || "\u00A0"}
          </p>
        </div>
      </div>

      {seedsAvailable ? (
        <button
          type="button"
          onClick={onExploreSeeds}
          className="relative mt-9 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#8b8b95] transition-colors duration-300 hover:text-[color:var(--accent)]"
        >
          <span className="h-px w-10 bg-current opacity-40" />
          Explorar la colección precargada · {seedCount} títulos
        </button>
      ) : null}
    </section>
  );
}
