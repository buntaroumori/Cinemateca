import type { AppSettings, Palette } from "./types";

export interface LlmConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export function llmConfigFromSettings(settings: AppSettings): LlmConfig {
  const provider = (settings.llmProvider || "").trim().toLowerCase();
  return {
    provider,
    apiKey: (settings.llmApiKey || "").trim(),
    model: (settings.llmModel || "").trim() || DEFAULT_MODEL,
    baseUrl: (settings.llmBaseUrl || "").trim() || endpointForProvider(provider),
  };
}

export function endpointForProvider(provider: string): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "openrouter":
      return "https://openrouter.ai/api/v1/chat/completions";
    case "groq":
      return "https://api.groq.com/openai/v1/chat/completions";
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    case "mistral":
      return "https://api.mistral.ai/v1/chat/completions";
    case "together":
      return "https://api.together.xyz/v1/chat/completions";
    case "custom":
      return DEFAULT_BASE_URL;
    default:
      return DEFAULT_BASE_URL;
  }
}

export const LLM_PROVIDERS: { id: string; label: string; models: string[] }[] = [
  { id: "", label: "Desactivado (motor local determinista)", models: [] },
  { id: "openai", label: "OpenAI", models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"] },
  { id: "openrouter", label: "OpenRouter", models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku", "meta-llama/llama-3.1-70b-instruct"] },
  { id: "groq", label: "Groq", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
  { id: "anthropic", label: "Anthropic", models: ["claude-3-5-haiku-latest", "claude-sonnet-4-5"] },
  { id: "gemini", label: "Google Gemini", models: ["gemini-2.0-flash", "gemini-1.5-flash"] },
  { id: "mistral", label: "Mistral", models: ["mistral-small-latest", "open-mistral-nemo"] },
  { id: "together", label: "Together AI", models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"] },
  { id: "custom", label: "Endpoint propio (compatible OpenAI)", models: [] },
];

export interface EssayRequest {
  source: {
    title: string;
    year: number | null;
    overview: string;
    tagline: string | null;
    director: string | null;
    cinematographer: string | null;
    keywords: string[];
    genres: string[];
    palette: Palette | null;
    runtime: number | null;
  };
  target: {
    id: number;
    title: string;
    year: number | null;
    overview: string;
    keywords: string[];
    genres: string[];
    palette: Palette | null;
    runtime: number | null;
  };
  language: string;
}

export interface EssayDraft {
  headline: string;
  lines: [string, string, string];
  model: string;
}

const SYSTEM_PROMPT = [
  "Eres un crítico de cine de una revista de alta costura: preciso, sensorial, sin adjetivos vacíos.",
  "Comparas dos películas y revelas su conexión profunda: contraste fotográfico, dilema moral compartido,",
  "tratamiento del tiempo, obsesión del personaje o gramática del montaje.",
  "Reglas estrictas de formato: respondes ÚNICAMENTE con JSON válido, sin markdown, con esta forma exacta:",
  '{"headline": string, "lines": [string, string, string]}',
  "Cada línea: entre 14 y 26 palabras, en tercera persona, sin citar los títulos completos más de una vez.",
  "El headline: máximo 6 palabras, evocador, sin punto final.",
  "Prohibido: moralejas, spoilers del tercer acto, listas, emojis, comillas tipográficas dobles dentro del texto.",
].join("\n");

function languageName(code: string): string {
  const map: Record<string, string> = {
    "es-ES": "español",
    "en-US": "inglés",
    "fr-FR": "francés",
    "it-IT": "italiano",
    "de-DE": "alemán",
    "pt-BR": "portugués",
    "ja-JP": "japonés",
    "ko-KR": "coreano",
    "zh-CN": "chino",
  };
  return map[code] ?? "español";
}

function buildUserPrompt(req: EssayRequest): string {
  const paletteText = (p: Palette | null) =>
    p && p.colors.length ? p.colors.map((c) => c.hex).join(" · ") : "paleta no analizada";
  return [
    `PELÍCULA ACTUAL: "${req.source.title}" (${req.source.year ?? "año desconocido"})`,
    `Dirección: ${req.source.director ?? "desconocida"} · Fotografía: ${req.source.cinematographer ?? "desconocida"}`,
    `Duración: ${req.source.runtime ?? "?"} min · Géneros: ${req.source.genres.join(", ") || "sin datos"}`,
    `Keywords: ${req.source.keywords.slice(0, 12).join(", ") || "sin datos"}`,
    `Paleta dominante: ${paletteText(req.source.palette)}`,
    `Sinopsis: ${req.source.overview.slice(0, 420) || "sin sinopsis"}`,
    req.source.tagline ? `Tagline: ${req.source.tagline}` : "",
    "",
    `ALMA GEMEA: "${req.target.title}" (${req.target.year ?? "año desconocido"})`,
    `Duración: ${req.target.runtime ?? "?"} min · Géneros: ${req.target.genres.join(", ") || "sin datos"}`,
    `Keywords: ${req.target.keywords.slice(0, 12).join(", ") || "sin datos"}`,
    `Paleta dominante: ${paletteText(req.target.palette)}`,
    `Sinopsis: ${req.target.overview.slice(0, 420) || "sin sinopsis"}`,
    "",
    `Escribe el análisis en ${languageName(req.language)}. Devuelve solo el JSON.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function sanitizeDraft(raw: string, model: string): EssayDraft | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      headline?: unknown;
      lines?: unknown;
    };
    const lines = Array.isArray(parsed.lines)
      ? parsed.lines.filter((l): l is string => typeof l === "string" && l.trim().length > 8)
      : [];
    if (lines.length < 3) return null;
    const headline = typeof parsed.headline === "string" && parsed.headline.trim() ? parsed.headline.trim() : "Vínculo latente";
    return {
      headline: headline.slice(0, 72),
      lines: [cleanLine(lines[0]), cleanLine(lines[1]), cleanLine(lines[2])],
      model,
    };
  } catch {
    return null;
  }
}

function cleanLine(line: string): string {
  return line.replace(/\s+/g, " ").replace(/^["'•\-–—\s]+/, "").trim().slice(0, 320);
}

async function callAnthropic(config: LlmConfig, req: EssayRequest, signal: AbortSignal): Promise<EssayDraft | null> {
  const response = await fetch(config.baseUrl, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 700,
      temperature: 0.8,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(req) }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}`);
  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("\n");
  return sanitizeDraft(text, config.model);
}

async function callOpenAiCompatible(
  config: LlmConfig,
  req: EssayRequest,
  signal: AbortSignal,
): Promise<EssayDraft | null> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = typeof location !== "undefined" ? location.origin : "https://cinemateca.local";
    headers["X-Title"] = "Cinemateca Sensorial";
  }
  const response = await fetch(config.baseUrl, {
    method: "POST",
    signal,
    headers,
    body: JSON.stringify({
      model: config.model,
      temperature: 0.8,
      top_p: 0.95,
      max_tokens: 700,
      response_format: config.provider === "openai" || config.provider === "groq" ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(req) },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM ${response.status}: ${body.slice(0, 180)}`);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return sanitizeDraft(content, config.model);
}

export async function generateEssay(config: LlmConfig, req: EssayRequest, signal?: AbortSignal): Promise<EssayDraft | null> {
  if (!config.apiKey) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 28000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return config.provider === "anthropic"
      ? await callAnthropic(config, req, controller.signal)
      : await callOpenAiCompatible(config, req, controller.signal);
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}
