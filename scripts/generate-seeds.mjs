#!/usr/bin/env node
/**
 * Generador de semillas estáticas (build-time).
 *
 * Se ejecuta en CI con credenciales que viven ÚNICAMENTE en el runner:
 *   TMDB_API_KEY / TMDB_READ_TOKEN  → catálogo, fichas y IDs externos
 *   OPENAI_API_KEY / LLM_API_KEY    → mini-ensayos de "alma gemela"
 *
 * Salida: public/seed/catalog.json, servido como archivo estático. Ninguna
 * clave se escribe en el artefacto ni se inyecta en el bundle del cliente.
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MOODS, SYSTEM_PROMPT } from "./moods.config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = resolve(root, "public/seed");
const outFile = resolve(outDir, "catalog.json");

/**
 * Carga un `.env` local (gitignored) si existe, sin sobrescribir variables ya
 * presentes en el entorno (CI manda sobre el archivo local). Permite ejecutar
 * `npm run seed` en desarrollo sin exportar credenciales a mano.
 */
function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || match[1].startsWith("#")) continue;
      if (process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sin .env local: las credenciales llegan del entorno (CI) */
  }
}
loadDotEnv();

const env = process.env;
const TMDB_KEY = (env.TMDB_API_KEY ?? env.VITE_TMDB_API_KEY ?? "").trim();
const TMDB_TOKEN = (env.TMDB_READ_TOKEN ?? env.VITE_TMDB_READ_TOKEN ?? "").trim();
const LANGUAGE = (env.TMDB_LANGUAGE ?? env.SEED_LANGUAGE ?? "es-ES").trim();
const PAGES = clampInt(env.SEED_PAGE_COUNT, 1, 3, 2);
const FILM_COUNT = clampInt(env.SEED_FILM_COUNT, 6, 80, 28);
const ESSAY_COUNT = clampInt(env.SEED_ESSAY_COUNT, 0, 60, 24);
const SKIP_FA = (env.SEED_SKIP_FILMAFFINITY ?? "").toLowerCase() === "true";
const FILM_IDS = (env.SEED_FILM_IDS ?? "")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value));

const LLM_KEY = (env.OPENAI_API_KEY ?? env.LLM_API_KEY ?? "").trim();
const LLM_BASE_URL = (env.LLM_BASE_URL ?? "https://api.openai.com/v1/chat/completions").trim();
const LLM_MODEL = (env.LLM_MODEL ?? "gpt-4o-mini").trim();
const LLM_LANGUAGE = (env.LLM_LANGUAGE ?? "es").trim();

const TMDB = "https://api.themoviedb.org/3";
const FA_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function log(...parts) {
  process.stdout.write(`[seed] ${parts.join(" ")}\n`);
}

function headers(extra = {}) {
  const base = { accept: "application/json", ...extra };
  if (TMDB_TOKEN) base.authorization = `Bearer ${TMDB_TOKEN}`;
  return base;
}

async function tmdb(path, params = {}, attempt = 0) {
  const url = new URL(`${TMDB}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  if (!TMDB_TOKEN && TMDB_KEY) url.searchParams.set("api_key", TMDB_KEY);

  try {
    const response = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(25000) });
    if (response.status === 429 && attempt < 4) {
      const wait = Number.parseInt(response.headers.get("retry-after") ?? "1", 10) * 1000 + 400 * (attempt + 1);
      log(`429 en ${path} — esperando ${wait} ms`);
      await sleep(wait);
      return tmdb(path, params, attempt + 1);
    }
    if (!response.ok) {
      log(`AVISO ${response.status} en ${path}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    if (attempt < 2) {
      await sleep(900 * (attempt + 1));
      return tmdb(path, params, attempt + 1);
    }
    log(`AVISO de red en ${path}: ${error.message}`);
    return null;
  }
}

async function writeEmpty(reason) {
  await mkdir(outDir, { recursive: true });
  const bundle = {
    generatedAt: null,
    language: LANGUAGE,
    available: false,
    trending: [],
    moods: [],
    films: {},
    essays: [],
    filmaffinity: {},
    genres: [],
    notice: reason,
  };
  await writeFile(outFile, `${JSON.stringify(bundle)}\n`, "utf8");
  log(reason);
  log(`Escrito ${outFile} (bundle vacío)`);
}

function trimMovie(movie) {
  if (!movie) return null;
  return {
    id: movie.id,
    title: movie.title ?? "",
    original_title: movie.original_title ?? movie.title ?? "",
    overview: movie.overview ?? "",
    poster_path: movie.poster_path ?? null,
    backdrop_path: movie.backdrop_path ?? null,
    release_date: movie.release_date ?? null,
    vote_average: movie.vote_average ?? 0,
    vote_count: movie.vote_count ?? 0,
    genre_ids: movie.genre_ids ?? movie.genres?.map((genre) => genre.id) ?? [],
    popularity: movie.popularity ?? 0,
    adult: Boolean(movie.adult),
  };
}

async function resolveFilmAffinity(title, year) {
  const url = `https://www.filmaffinity.com/es/search.php?stype=title&stext=${encodeURIComponent(title)}${
    year ? `&fromyear=${year}&toyear=${year}` : ""
  }`;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": FA_UA, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const pattern = /film(\d{5,7})\.html/gi;
    const counts = new Map();
    let match;
    while ((match = pattern.exec(html)) !== null) {
      counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    }
    if (counts.size === 0) return null;
    if (year) {
      const yearPattern = new RegExp(`film(\\d{5,7})\\.html[^]{0,900}?\\b${year}\\b`, "i");
      const yearMatch = yearPattern.exec(html);
      if (yearMatch) return yearMatch[1];
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  } catch {
    return null;
  }
}

async function callLlm(source, target) {
  const crewName = (film, job) => film?.credits?.crew?.find((member) => member.job === job)?.name ?? "desconocida";
  const prompt = [
    `PELÍCULA ACTUAL: "${source.title}" (${(source.release_date ?? "").slice(0, 4) || "s.a."})`,
    `Dirección: ${crewName(source, "Director")} · Fotografía: ${crewName(source, "Director of Photography")}`,
    `Duración: ${source.runtime ?? "?"} min · Géneros: ${(source.genres ?? []).map((g) => g.name).join(", ") || "sin datos"}`,
    `Keywords: ${(source.keywords?.keywords ?? []).slice(0, 12).map((k) => k.name).join(", ") || "sin datos"}`,
    `Sinopsis: ${(source.overview ?? "").slice(0, 420)}`,
    source.tagline ? `Tagline: ${source.tagline}` : "",
    "",
    `ALMA GEMEA: "${target.title}" (${(target.release_date ?? "").slice(0, 4) || "s.a."})`,
    `Duración: ${target.runtime ?? "?"} min · Géneros: ${(target.genres ?? []).map((g) => g.name).join(", ") || "sin datos"}`,
    `Keywords: ${(target.keywords?.keywords ?? []).slice(0, 12).map((k) => k.name).join(", ") || "sin datos"}`,
    `Sinopsis: ${(target.overview ?? "").slice(0, 420)}`,
    "",
    `Escribe el análisis en ${LLM_LANGUAGE}. Devuelve solo el JSON.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(LLM_BASE_URL, {
      method: "POST",
      headers: headers({ "content-type": "application/json", authorization: `Bearer ${LLM_KEY}` }),
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.8,
        max_tokens: 700,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!response.ok) {
      log(`AVISO LLM ${response.status}`);
      return null;
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const parsed = JSON.parse(content.slice(start, end + 1));
    const lines = Array.isArray(parsed.lines) ? parsed.lines.filter((line) => typeof line === "string" && line.trim().length > 8) : [];
    if (lines.length < 3) return null;
    return {
      headline: String(parsed.headline ?? "Vínculo latente").slice(0, 72),
      lines: lines.slice(0, 3).map((line) => line.replace(/\s+/g, " ").trim().slice(0, 320)),
      model: LLM_MODEL,
    };
  } catch (error) {
    log(`AVISO LLM: ${error.message}`);
    return null;
  }
}

async function main() {
  if (!TMDB_KEY && !TMDB_TOKEN) {
    await writeEmpty(
      "Sin TMDB_API_KEY ni TMDB_READ_TOKEN: se genera un bundle vacío. La app funcionará con la clave que introduzca el usuario en Configuración.",
    );
    return;
  }

  log(`Idioma ${LANGUAGE} · ${PAGES} página(s) por vibra · ${FILM_COUNT} fichas enriquecidas`);
  await rm(outFile, { force: true });

  const genreData = await tmdb("/genre/movie/list", { language: LANGUAGE });
  const genres = genreData?.genres ?? [];
  log(`Géneros: ${genres.length}`);

  const trending = [];
  const trendingSeen = new Set();
  for (let page = 1; page <= Math.min(PAGES, 2); page++) {
    const data = await tmdb("/trending/movie/week", { page, language: LANGUAGE });
    for (const item of data?.results ?? []) {
      if (!item || trendingSeen.has(item.id)) continue;
      trendingSeen.add(item.id);
      trending.push(item);
    }
    await sleep(260);
  }
  log(`Tendencias: ${trending.length}`);

  const moods = [];
  const candidateIds = new Set();
  for (const mood of MOODS) {
    const items = [];
    for (let page = 1; page <= PAGES; page++) {
      const data = await tmdb("/discover/movie", {
        language: LANGUAGE,
        page,
        include_adult: false,
        sort_by: mood.sortBy,
        "vote_count.gte": mood.minVoteCount,
        with_genres: mood.genreIds.join("|"),
        with_keywords: mood.keywordIds.join("|"),
        "vote_average.gte": mood.sortBy === "vote_average.desc" ? 6 : undefined,
      });
      items.push(...(data?.results ?? []));
      await sleep(280);
      if (!data || page >= (data.total_pages ?? 1)) break;
    }
    const unique = new Map();
    for (const item of items) if (item && item.poster_path) unique.set(item.id, item);
    // Si la combinación géneros+keywords quedó raquilita, se rellena con el
    // territorio genérico de la vibra (mismo orden y umbral de votos).
    if (unique.size < 16) {
      for (let page = 1; page <= PAGES; page++) {
        const fallback = await tmdb("/discover/movie", {
          language: LANGUAGE,
          page,
          include_adult: false,
          sort_by: mood.sortBy,
          "vote_count.gte": mood.minVoteCount,
          with_genres: mood.genreIds.join("|"),
          "vote_average.gte": mood.sortBy === "vote_average.desc" ? 6.5 : 6,
        });
        for (const item of fallback?.results ?? []) if (item && item.poster_path) unique.set(item.id, item);
        await sleep(280);
        if (!fallback || page >= (fallback.total_pages ?? 1) || unique.size >= 40) break;
      }
    }
    const list = [...unique.values()].slice(0, 40);
    list.forEach((item) => candidateIds.add(item.id));
    moods.push({ id: mood.id, generatedAt: new Date().toISOString(), items: list });
    log(`${mood.label}: ${list.length} títulos`);
  }

  trending.slice(0, 24).forEach((item) => item && candidateIds.add(item.id));
  FILM_IDS.forEach((id) => candidateIds.add(id));

  const POOL_LIMIT = clampInt(env.SEED_POOL_LIMIT, 20, 400, 240);
  const EXPAND_LIMIT = clampInt(env.SEED_EXPAND_LIMIT, 0, 300, 120);
  log(`Colección objetivo: hasta ${POOL_LIMIT} títulos + ${EXPAND_LIMIT} ampliaciones`);

  const ordered = [...candidateIds]
    .map((id) => {
      const found =
        trending.find((item) => item?.id === id) ??
        moods.flatMap((mood) => mood.items).find((item) => item.id === id) ??
        null;
      return { id, score: (found?.vote_average ?? 0) * 10 + Math.min(found?.vote_count ?? 0, 20000) / 2000 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, POOL_LIMIT)
    .map((entry) => entry.id);

  const filmsDir = resolve(outDir, "films");
  await rm(filmsDir, { recursive: true, force: true });
  await mkdir(filmsDir, { recursive: true });

  const filmStore = new Map();
  const expandIds = new Set();
  let writtenFiles = 0;

  /**
   * Descarga una ficha completa, la recorta y la publica como archivo estático
   * independiente (`seed/films/<id>.json`): el navegador la servirá con
   * `force-cache` + IndexedDB, sin credenciales y sin red viva.
   */
  async function enrich(id, { expand = true } = {}) {
    const details = await tmdb(`/movie/${id}`, {
      language: LANGUAGE,
      append_to_response: "credits,images,keywords,external_ids,recommendations,similar,videos",
      include_image_language: "en,null,es,fr,it,de,ja,ko,zh",
    });
    await sleep(240);
    if (!details || !details.title) return null;

    if (details.images) {
      details.images.backdrops = (details.images.backdrops ?? []).slice(0, 12);
      details.images.posters = (details.images.posters ?? []).slice(0, 6);
      details.images.stills = (details.images.stills ?? []).slice(0, 24);
    }
    if (details.credits) {
      details.credits.cast = (details.credits.cast ?? []).slice(0, 14);
      details.credits.crew = (details.credits.crew ?? []).slice(0, 40);
    }
    if (details.similar) details.similar.results = (details.similar.results ?? []).slice(0, 20);
    if (details.recommendations) details.recommendations.results = (details.recommendations.results ?? []).slice(0, 20);
    if (details.videos) details.videos.results = (details.videos.results ?? []).slice(0, 8);

    filmStore.set(id, details);
    await writeFile(resolve(filmsDir, `${id}.json`), JSON.stringify(details), "utf8");
    writtenFiles += 1;

    if (expand) {
      const neighbours = [
        ...(details.recommendations?.results ?? []).slice(0, 6),
        ...(details.similar?.results ?? []).slice(0, 6),
      ];
      for (const item of neighbours) {
        if (item?.id && !candidateIds.has(item.id) && !filmStore.has(item.id)) expandIds.add(item.id);
      }
    }
    return details;
  }

  for (const id of ordered) {
    const details = await enrich(id);
    if (details) log(`Ficha ${id} — ${details.title}`);
  }

  const films = {};
  const essays = [];
  const filmaffinity = {};

  if (!SKIP_FA) {
    for (const id of ordered.slice(0, FILM_COUNT)) {
      const details = filmStore.get(id);
      if (!details) continue;
      const year = Number.parseInt((details.release_date ?? "").slice(0, 4), 10);
      const faId = await resolveFilmAffinity(details.original_title ?? details.title, Number.isFinite(year) ? year : null);
      await sleep(420);
      if (faId) {
        filmaffinity[`${details.title} ${Number.isFinite(year) ? year : ""}`.trim()] = faId;
        log(`  FilmAffinity ${faId}`);
      }
    }
  }

  for (const id of [...expandIds].slice(0, EXPAND_LIMIT)) {
    const details = await enrich(id, { expand: false });
    if (details) log(`Ficha ampliada ${id} — ${details.title}`);
  }

  if (LLM_KEY && ESSAY_COUNT > 0) {
    log(`Generando hasta ${ESSAY_COUNT} ensayos con ${LLM_MODEL}`);
    let written = 0;
    for (const film of filmStore.values()) {
      if (written >= ESSAY_COUNT) break;
      const neighbours = [
        ...(film.recommendations?.results ?? []),
        ...(film.similar?.results ?? []),
      ].filter((item) => item && item.id !== film.id);
      const seen = new Set();
      for (const neighbour of neighbours) {
        if (written >= ESSAY_COUNT) break;
        if (seen.has(neighbour.id)) continue;
        seen.add(neighbour.id);
        const target =
          filmStore.get(neighbour.id) ?? (await enrich(neighbour.id, { expand: false }));
        if (!target) continue;
        const draft = await callLlm(film, target);
        await sleep(240);
        if (!draft) continue;
        essays.push({
          filmId: film.id,
          targetId: target.id,
          targetTitle: target.title ?? neighbour.title,
          targetYear: Number.parseInt((target.release_date ?? "").slice(0, 4), 10) || null,
          targetPosterPath: target.poster_path ?? neighbour.poster_path ?? null,
          headline: draft.headline,
          lines: draft.lines,
          source: "seed",
          model: draft.model,
        });
        written += 1;
        log(`  Ensayo ${film.id} → ${target.id}`);
      }
    }
  } else {
    log("Sin clave LLM: los ensayos se compondrán en el navegador con el motor sensorial local.");
  }

  const bundle = {
    generatedAt: new Date().toISOString(),
    language: LANGUAGE,
    available: true,
    trending: trending.map(trimMovie).filter(Boolean).slice(0, 40),
    moods: moods.map((mood) => ({ ...mood, items: mood.items.map(trimMovie).filter(Boolean) })),
    films,
    filmFiles: writtenFiles,
    essays,
    filmaffinity,
    genres,
  };

  await mkdir(outDir, { recursive: true });
  const json = JSON.stringify(bundle);
  await writeFile(outFile, `${json}\n`, "utf8");
  log(
    `Bundle escrito: ${(json.length / 1024).toFixed(0)} KB · ${writtenFiles} fichas en seed/films · ${essays.length} ensayos · ${
      Object.keys(filmaffinity).length
    } FilmAffinity`,
  );
}

main().catch(async (error) => {
  log(`FALLO: ${error?.stack ?? error}`);
  await writeEmpty("Error durante la generación: bundle vacío para no bloquear el build.");
  process.exitCode = 0;
});
