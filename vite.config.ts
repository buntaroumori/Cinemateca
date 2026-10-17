import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { compression } from "vite-plugin-compression2";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pickHeroRawItem, type HeroCandidate } from "./src/lib/hero";

const here = dirname(fileURLToPath(import.meta.url));

/** Parser mínimo de `.env` (el mismo contrato que scripts/generate-seeds.mjs). */
function loadDotEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const file = resolve(here, ".env");
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || match[1].startsWith("#")) continue;
    out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const dotEnv = loadDotEnv();

/**
 * Credenciales comunitarias: se leen del entorno del build (secretos de CI o
 * `.env` local, ambos fuera del repositorio) y se incrustan ofuscadas con XOR
 * + base64. En el bundle no existe ningún secreto en claro; el repo tampoco.
 */
const BUILTIN_MASK = "cinemateca-sensorial";
function obfuscate(value: string): string {
  const clean = (value ?? "").trim();
  if (!clean) return "";
  const bytes = Array.from(clean, (char, index) =>
    char.charCodeAt(0) ^ BUILTIN_MASK.charCodeAt(index % BUILTIN_MASK.length),
  );
  return Buffer.from(bytes).toString("base64");
}

const builtinApiKey = process.env.TMDB_API_KEY ?? dotEnv.TMDB_API_KEY ?? "";
const builtinReadToken = process.env.TMDB_READ_TOKEN ?? dotEnv.TMDB_READ_TOKEN ?? "";

const base = (() => {
  const raw = process.env.VITE_BASE_PATH ?? "/";
  const trimmed = raw.trim() === "" ? "/" : raw.trim();
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
})();

/**
 * Inlinea todo el CSS crítico en el HTML y elimina las hojas de estilo
 * externas: cero peticiones bloqueantes de render (Lighthouse 100 en
 * rendimiento) y un único round-trip hasta el primer píxel.
 */
function inlineCssIntoHtml(): Plugin {
  return {
    name: "cinemateca:inline-css",
    apply: "build",
    enforce: "post",
    async generateBundle(_options, bundle) {
      const htmlFiles = Object.keys(bundle).filter((name) => name.endsWith(".html"));
      const cssFiles = Object.keys(bundle).filter((name) => name.endsWith(".css"));
      if (htmlFiles.length === 0 || cssFiles.length === 0) return;

      for (const htmlName of htmlFiles) {
        const asset = bundle[htmlName];
        if (asset.type !== "asset") continue;
        let html = typeof asset.source === "string" ? asset.source : asset.source.toString();

        for (const cssName of cssFiles) {
          const cssAsset = bundle[cssName];
          if (cssAsset.type !== "asset") continue;
          const css = typeof cssAsset.source === "string" ? cssAsset.source : cssAsset.source.toString();
          const escaped = css.replace(/<\/style>/gi, "<\\/style>");
          const linkPattern = new RegExp(
            `<link[^>]*href="[^"]*${cssName.split("/").pop()}"[^>]*>`,
            "gi",
          );
          if (linkPattern.test(html)) {
            html = html.replace(linkPattern, `<style>${escaped}</style>`);
          } else if (!html.includes(escaped.slice(0, 64))) {
            html = html.replace("</head>", `<style>${escaped}</style>\n</head>`);
          }
        }

        asset.source = html;
      }

      for (const cssName of cssFiles) delete bundle[cssName];
    },
  };
}

/**
 * GitHub Pages sirve `404.html` para cualquier ruta desconocida. Este plugin
 * clona el `index.html` compilado como `404.html` inyectando un guion que
 * reescribe la ruta profunda dentro del hash y la redirige al índice, de forma
 * que el enrutador la restore sin pérdida de estado (SPA deep-linking).
 */
function spaFallbackForGitHubPages(): Plugin {
  return {
    name: "cinemateca:spa-404-fallback",
    apply: "build",
    enforce: "post",
    async closeBundle() {
      const configured = this.environment?.config?.build?.outDir;
      const outDir = configured ? resolve(here, configured) : resolve(here, "dist");
      const indexHtml = await readFile(resolve(outDir, "index.html"), "utf8");
      const marker = "<head>";
      const script = [
        "<script>(function(){",
        "try{",
        "var l=window.location,p=l.pathname.replace(/\\/+$/,''),s=l.search||'',h=l.hash||'';",
        "var root=(document.currentScript&&document.currentScript.getAttribute('data-base'))||'/';",
        "if(root.length>1&&p.indexOf(root.replace(/\\/$/,''))===0){p=p.slice(root.replace(/\\/$/,'').length);}",
        "if(!p||p==='/'){return;}",
        "var target='/'+p.replace(/^\\//,'')+s+h;",
        "l.replace(root.replace(/\\/$/,'')+'/?__route='+encodeURIComponent(target)+'#'+encodeURI(target));",
        "}catch(e){}",
        "})();</script>",
      ].join("");
      const tagged = script.replace("<script>", `<script data-base="${base}">`);
      // La página 404 no muestra el hero: fuera el preload de su imagen y el
      // JSON inline del destacado.
      const withoutHero = indexHtml
        .replace(/\s*<link rel="preload" as="image"[^>]*\/>/, "")
        .replace(/\s*<script type="application\/json" id="cinemateca-hero">[\s\S]*?<\/script>/, "");
      const patched = withoutHero.replace(marker, `${marker}\n${tagged}`);
      await mkdir(outDir, { recursive: true });
      await writeFile(resolve(outDir, "404.html"), patched, "utf8");
    },
  };
}

/**
 * La imagen del hero destacado es el LCP de la portada. Su URL es determinista
 * (primer film por orden «esencia» de la semilla, calidad «Alta» → w1280), así
 * que el build inyecta en el HTML: (1) un `<link rel="preload">` de la imagen,
 * que se descarga en paralelo al JS, y (2) el item TMDB en crudo del hero como
 * JSON (<1 KB), que FeaturedSpotlight renderiza en el primer commit de React
 * sin esperar al catálogo completo. Resultado: LCP mínimo y CLS 0.
 */
function preloadHeroImage(): Plugin {
  return {
    name: "cinemateca:preload-hero",
    apply: "build",
    async transformIndexHtml(html) {
      try {
        const raw = await readFile(resolve(here, "public/seed/catalog.json"), "utf8");
        const catalog = JSON.parse(raw) as { trending?: HeroCandidate[] };
        const hero = pickHeroRawItem(catalog.trending ?? []);
        const path = hero ? hero.backdrop_path ?? hero.poster_path : null;
        if (!hero || !path) return html;
        const url = `https://image.tmdb.org/t/p/w1280${path}`;
        const json = JSON.stringify(hero).replace(/</g, "\\u003c");
        return html.replace(
          "</head>",
          [
            `    <link rel="preload" as="image" href="${url}" fetchpriority="high" />`,
            `    <script type="application/json" id="cinemateca-hero">${json}</script>`,
            "  </head>",
          ].join("\n"),
        );
      } catch {
        return html;
      }
    },
  };
}

export default defineConfig({
  base,
  define: {
    __CINEMATECA_BUILTIN_KEY__: JSON.stringify(obfuscate(builtinApiKey)),
    __CINEMATECA_BUILTIN_TOKEN__: JSON.stringify(obfuscate(builtinReadToken)),
  },
  resolve: {
    alias: {
      "@": resolve(here, "src"),
    },
  },
  plugins: [
    react(),
    preloadHeroImage(),
    compression({
      algorithms: ["brotliCompress", "gzip"],
      include: /\.(js|mjs|cjs|css|html|svg|json)$/i,
      threshold: 512,
      logLevel: "silent",
    }),
    inlineCssIntoHtml(),
    spaFallbackForGitHubPages(),
  ],
  build: {
    target: "es2022",
    cssTarget: "chrome110",
    outDir: "dist",
    assetsDir: "assets",
    // Una única hoja de estilo que el plugin `inlineCssIntoHtml` incrusta en el
    // HTML: los chunks diferidos no generan CSS propio que haya que precargar.
    cssCodeSplit: false,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 420,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@fontsource")) return "fonts";
          if (id.includes("react-dom")) return "react-dom";
          if (id.includes("react")) return "react";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
