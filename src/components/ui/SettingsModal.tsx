import { useCallback, useEffect, useState, type ReactNode } from "react";
import { cx } from "@/lib/format";
import { IMAGE_QUALITY_LEVELS, SUPPORTED_LANGUAGES, STORAGE_KEYS } from "@/lib/constants";
import { BUILD_ENV } from "@/lib/env";
import { LLM_PROVIDERS, endpointForProvider } from "@/lib/llm";
import {
  probeLlmEndpoint,
  testTmdbCredentials,
  useCacheInfo,
  type CredentialTest,
} from "@/lib/settings-utils";
import { useSettings } from "@/app/settings";
import type { AppSettings, ImageQuality, MetadataLanguage } from "@/lib/types";
import { Modal, ModalCloseButton } from "./Modal";
import { IconCheck, IconKey, IconPalette, IconSliders, IconSparkle, IconTrash } from "./Icons";

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onNotify: (message: string, kind?: "info" | "success" | "error", detail?: string) => void;
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-white/6 px-6 py-8 sm:px-10">
      <header className="mb-6 flex items-start gap-3">
        <span className="mt-[3px] accent-text">{icon}</span>
        <div>
          <h3 className="type-eyebrow text-[#d9d5cc]">{title}</h3>
          <p className="mt-2 max-w-[62ch] font-serif text-[15px] italic leading-relaxed text-[#8a8a94]">{hint}</p>
        </div>
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium tracking-[0.01em] text-[#e3dfd6]">{label}</span>
        <span className="mt-1 block max-w-[64ch] font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-[#7e7e88]">
          {description}
        </span>
      </span>
      <span className="relative mt-1 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          className={cx(
            "block h-[22px] w-[42px] rounded-full border transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
            checked ? "border-transparent bg-[color:var(--accent)]" : "border-white/12 bg-[#131316]",
          )}
        />
        <span
          className={cx(
            "pointer-events-none absolute top-[3px] h-[16px] w-[16px] rounded-full transition-all duration-400 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
            checked ? "left-[23px] bg-black" : "left-[3px] bg-[#5c5c66]",
          )}
        />
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  mono = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="type-eyebrow text-[9px]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          "hairline w-full rounded-[3px] bg-black/55 px-3.5 py-2.5 text-[13px] text-[#ece8df] placeholder:text-[#7e7e88] transition-colors duration-300 focus:border-[color:var(--accent-line)] focus:outline-none",
          mono && "type-mono text-[12px]",
        )}
      />
      {hint ? <span className="font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.14em] text-[#7e7e88]">{hint}</span> : null}
    </label>
  );
}

function StatusLine({ status }: { status: CredentialTest }) {
  if (status.status === "idle") return null;
  const tone =
    status.status === "ok"
      ? "text-[color:var(--accent)]"
      : status.status === "error"
        ? "text-[#f0938a]"
        : "text-[#8b8b95]";
  return (
    <p className={cx("flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]", tone)}>
      {status.status === "ok" ? <IconCheck size={12} /> : null}
      {status.status === "testing" ? "Verificando…" : status.message}
    </p>
  );
}

/**
 * Panel de Configuración: capa a pantalla completa con glassmorphism.
 * Todo se persiste en localStorage; ninguna credencial viaja al bundle.
 */
export function SettingsModal({ open, onClose, onNotify }: SettingsModalProps) {
  const { settings, update, reset } = useSettings();
  const [tmdbStatus, setTmdbStatus] = useState<CredentialTest>({ status: "idle", message: "" });
  const [llmStatus, setLlmStatus] = useState<CredentialTest>({ status: "idle", message: "" });
  const { info, refresh, purge } = useCacheInfo();

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const patch = useCallback(
    (next: Partial<AppSettings>) => {
      update(next);
    },
    [update],
  );

  const onTestTmdb = useCallback(async () => {
    setTmdbStatus({ status: "testing", message: "" });
    const result = await testTmdbCredentials(settings);
    setTmdbStatus(result);
    onNotify(
      result.status === "ok" ? "Credencial TMDB verificada" : "La credencial TMDB no es válida",
      result.status === "ok" ? "success" : "error",
      result.message,
    );
  }, [settings, onNotify]);

  const onProbeLlm = useCallback(async () => {
    setLlmStatus({ status: "testing", message: "" });
    const result = await probeLlmEndpoint(settings);
    setLlmStatus(result);
    onNotify(
      result.status === "ok" ? "Proveedor LLM operativo" : "No se pudo contactar con el LLM",
      result.status === "ok" ? "success" : "error",
      result.message,
    );
  }, [settings, onNotify]);

  const onPurge = useCallback(async () => {
    await purge();
    try {
      localStorage.removeItem(STORAGE_KEYS.lastRoute);
    } catch {
      /* ignorable */
    }
    onNotify("Caché local vaciada", "success", "IndexedDB + HTTP cache reiniciados");
  }, [purge, onNotify]);

  const onReset = useCallback(() => {
    reset();
    setTmdbStatus({ status: "idle", message: "" });
    setLlmStatus({ status: "idle", message: "" });
    onNotify("Preferencias restauradas", "info");
  }, [reset, onNotify]);

  const selectedProvider = LLM_PROVIDERS.find((p) => p.id === settings.llmProvider.trim().toLowerCase()) ?? LLM_PROVIDERS[0];

  return (
    <Modal open={open} onClose={onClose} className="h-full w-full">
      <div className="glass relative flex h-full w-full flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(120% 80% at 20% -10%, rgba(255,255,255,0.055) 0%, transparent 55%)" }}
          aria-hidden="true"
        />
        <header className="relative z-10 flex items-center justify-between gap-4 border-b border-white/8 px-6 py-5 sm:px-10">
          <div>
            <p className="type-eyebrow text-[9px]">Panel de configuración</p>
            <h2 className="type-display mt-2 text-[26px] text-[#f4f1ea] sm:text-[32px]">Preferencias de proyección</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onReset}
              className="hidden font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#8a8a94] transition-colors duration-300 hover:text-[#f0938a] sm:block"
            >
              Restaurar valores
            </button>
            <ModalCloseButton onClose={onClose} label="Cerrar configuración" />
          </div>
        </header>

        <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain">
          <Section
            icon={<IconKey size={15} />}
            title="Credenciales TMDB"
            hint="Este despliegue ya incluye acceso comunitario al catálogo mundial: con los campos vacíos, todo visitante explora sin límites. Una clave propia vive únicamente en tu navegador (localStorage), viaja directa a api.themoviedb.org y tiene prioridad sobre la comunitaria."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <TextField
                label="API Key (v3)"
                value={settings.tmdbApiKey}
                onChange={(value) => patch({ tmdbApiKey: value })}
                placeholder="p. ej. 8f2c…"
                type="password"
                hint="Vacío = acceso comunitario incluido · themoviedb.org → Settings → API"
              />
              <TextField
                label="Read Access Token (v4, opcional)"
                value={settings.tmdbReadToken}
                onChange={(value) => patch({ tmdbReadToken: value })}
                placeholder="eyJhbGciOi…"
                type="password"
                hint="Si se rellena, tiene prioridad sobre la v3"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => void onTestTmdb()}
                className="hairline rounded-[2px] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#d9d5cc] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)]"
              >
                Verificar conexión
              </button>
              <StatusLine status={tmdbStatus} />
            </div>
          </Section>

          <Section
            icon={<IconPalette size={15} />}
            title="Idioma de los metadatos"
            hint="Títulos, sinopsis y keywords se solicitan en este idioma; TMDB responde en el original cuando no existe traducción."
          >
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((language) => (
                <button
                  key={language.id}
                  type="button"
                  onClick={() => patch({ language: language.id as MetadataLanguage })}
                  className={cx(
                    "hairline flex items-center gap-2 rounded-[2px] px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    settings.language === language.id
                      ? "border-[color:var(--accent-line)] accent-tint text-[color:var(--accent)]"
                      : "text-[#8b8b95] hover:border-white/20 hover:text-[#d9d5cc]",
                  )}
                >
                  <span className="text-[#7e7e88]">{language.flag}</span>
                  {language.label}
                </button>
              ))}
            </div>
          </Section>

          <Section
            icon={<IconSliders size={15} />}
            title="Calidad de imagen y consumo"
            hint="Controla el escalón de póster, fondo y fotograma que se pide a TMDB. Las paletas siempre se extraen de una miniatura de 3 kB."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {IMAGE_QUALITY_LEVELS.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => patch({ imageQuality: tier.id as ImageQuality })}
                  className={cx(
                    "hairline flex flex-col items-start gap-2 rounded-[3px] px-4 py-4 text-left transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    settings.imageQuality === tier.id
                      ? "border-[color:var(--accent-line)] accent-tint-strong"
                      : "hover:border-white/18 hover:bg-white/[0.02]",
                  )}
                >
                  <span
                    className={cx(
                      "type-eyebrow text-[9.5px]",
                      settings.imageQuality === tier.id ? "accent-text" : "text-[#8b8b95]",
                    )}
                  >
                    {tier.label}
                  </span>
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#7e7e88]">{tier.hint}</span>
                  <span className="mt-1 flex gap-1">
                    {["w185", "w342", "w500", "w780"].map((size) => {
                      const activeSize = tier.poster;
                      const order = ["w154", "w185", "w342", "w500", "w780"];
                      const level = order.indexOf(activeSize);
                      const thisLevel = order.indexOf(size);
                      return (
                        <span
                          key={size}
                          className={cx(
                            "h-[3px] w-5 rounded-full transition-colors duration-500",
                            thisLevel <= level ? "bg-[color:var(--accent)]" : "bg-[#26262c]",
                          )}
                        />
                      );
                    })}
                  </span>
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Toggle
                checked={settings.reduceDataUsage}
                onChange={(value) => patch({ reduceDataUsage: value, imageQuality: value ? "equilibrada" : settings.imageQuality })}
                label="Ahorro de datos"
                description="Limita la calidad máxima y reduce el número de fotogramas precargados"
              />
              <Toggle
                checked={settings.heavyAnimations}
                onChange={(value) => patch({ heavyAnimations: value })}
                label="Animaciones pesadas"
                description="FLIP elástico, rotación de portada y transiciones de héroe. Se desactiva solo con prefers-reduced-motion"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Toggle
                checked={settings.graphPhysics}
                onChange={(value) => patch({ graphPhysics: value })}
                label="Físicas del grafo de afinidades"
                description="Simulación continua en canvas; desactívalo para nodos estáticos"
              />
              <Toggle
                checked={settings.grainEffect}
                onChange={(value) => patch({ grainEffect: value })}
                label="Grano de película"
                description="Capa de ruido animada sobre toda la interfaz (5 % de opacidad)"
              />
            </div>
          </Section>

          <Section
            icon={<IconSparkle size={15} />}
            title="Motor de ensayos (LLM)"
            hint="Sin proveedor se usa el motor local determinista, que compone el análisis a partir de keywords, década, duración y distancia cromática real entre paletas."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="type-eyebrow text-[9px]">Proveedor</span>
                <select
                  value={settings.llmProvider}
                  onChange={(event) =>
                    patch({
                      llmProvider: event.target.value,
                      llmBaseUrl: endpointForProvider(event.target.value),
                      llmModel: LLM_PROVIDERS.find((p) => p.id === event.target.value)?.models[0] ?? settings.llmModel,
                    })
                  }
                  className="hairline w-full appearance-none rounded-[3px] bg-black/55 px-3.5 py-2.5 font-mono text-[12px] text-[#ece8df] focus:border-[color:var(--accent-line)] focus:outline-none"
                >
                  {LLM_PROVIDERS.map((provider) => (
                    <option key={provider.id || "none"} value={provider.id} className="bg-[#0b0b0d]">
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Clave del proveedor"
                value={settings.llmApiKey}
                onChange={(value) => patch({ llmApiKey: value })}
                placeholder="sk-…"
                type="password"
                hint="Nunca sale de tu navegador: la petición va directa al proveedor"
              />
            </div>
            {settings.llmProvider ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <TextField
                  label="Modelo"
                  value={settings.llmModel}
                  onChange={(value) => patch({ llmModel: value })}
                  placeholder={selectedProvider.models[0] ?? "gpt-4o-mini"}
                  hint={selectedProvider.models.length ? `Sugeridos: ${selectedProvider.models.join(" · ")}` : "Cualquier modelo compatible"}
                />
                <TextField
                  label="Endpoint"
                  value={settings.llmBaseUrl || endpointForProvider(settings.llmProvider)}
                  onChange={(value) => patch({ llmBaseUrl: value })}
                  placeholder={endpointForProvider(settings.llmProvider)}
                  hint="Compatible con el esquema /chat/completions de OpenAI"
                />
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => void onProbeLlm()}
                disabled={!settings.llmProvider}
                className="hairline rounded-[2px] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#d9d5cc] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[color:var(--accent-line)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-white/8 disabled:hover:text-[#d9d5cc]"
              >
                Probar proveedor
              </button>
              <StatusLine status={llmStatus} />
            </div>
          </Section>

          <Section
            icon={<IconSliders size={15} />}
            title="Avanzado"
            hint="Utilidades para despliegues propios: resolución exacta de FilmAffinity y mantenimiento de la caché local."
          >
            <TextField
              label="Base alternativa del CDN de imágenes"
              value={settings.tmdbImageBase}
              onChange={(value) => patch({ tmdbImageBase: value })}
              placeholder="https://image.tmdb.org/t/p"
              hint="Útil con proxy propio o caché de imágenes. Vacío = image.tmdb.org/t/p"
            />
            <TextField
              label="Proxy CORS para FilmAffinity"
              value={settings.corsProxyUrl}
              onChange={(value) => patch({ corsProxyUrl: value })}
              placeholder="https://mi-proxy.workers.dev/?url="
              hint="La URL destino se añade codificada al final. Vacío = enlace a la búsqueda de FilmAffinity"
            />
            <div className="hairline rounded-[3px] bg-black/40 px-4 py-4">
              <p className="type-eyebrow mb-3 text-[9px]">Caché local</p>
              <ul className="flex flex-col gap-1.5">
                {info.map((entry) => (
                  <li key={entry.store} className="flex items-center justify-between gap-4 font-mono text-[10.5px] uppercase tracking-[0.14em]">
                    <span className="text-[#8b8b95]">{entry.label}</span>
                    <span className="type-mono text-[#d9d5cc]">{entry.entries} reg.</span>
                  </li>
                ))}
                {info.length === 0 ? (
                  <li className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#7e7e88]">IndexedDB no disponible</li>
                ) : null}
              </ul>
              <button
                type="button"
                onClick={() => void onPurge()}
                className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8b8b95] transition-colors duration-300 hover:text-[#f0938a]"
              >
                <IconTrash size={13} />
                Vaciar caché y semillas
              </button>
            </div>
            <p className="font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.16em] text-[#7e7e88]">
              Build {BUILD_ENV.buildStamp.slice(0, 10)} · v{BUILD_ENV.version.slice(0, 12)} · base {BUILD_ENV.basePath}
            </p>
          </Section>
        </div>
      </div>
    </Modal>
  );
}
