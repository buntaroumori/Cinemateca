#!/usr/bin/env node
/**
 * Auditoría de secretos sobre el artefacto compilado.
 * Recorre dist/ y verifica que ninguna credencial del runner se haya colado
 * en el HTML, el JS, el CSS o las semillas estáticas. Falla el pipeline si
 * encuentra una coincidencia.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const target = resolve(process.cwd(), process.argv[2] ?? "dist");

const secrets = [
  ["TMDB_API_KEY", process.env.TMDB_API_KEY],
  ["TMDB_READ_TOKEN", process.env.TMDB_READ_TOKEN],
  ["OPENAI_API_KEY", process.env.OPENAI_API_KEY],
  ["LLM_API_KEY", process.env.LLM_API_KEY],
].filter(([, value]) => typeof value === "string" && value.trim().length >= 12);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function main() {
  let info;
  try {
    info = await stat(target);
  } catch {
    process.stdout.write(`[audit] No existe ${target}: nada que auditar.\n`);
    return;
  }
  if (!info.isDirectory()) {
    process.stderr.write(`[audit] ${target} no es un directorio\n`);
    process.exit(1);
  }

  if (secrets.length === 0) {
    process.stdout.write("[audit] No hay secretos configurados en el entorno: nada que filtrar.\n");
    return;
  }

  const files = (await walk(target)).filter((file) => /\.(js|mjs|cjs|css|html|json|svg|map|txt|webmanifest)$/i.test(file));
  let leaks = 0;
  let scanned = 0;

  for (const file of files) {
    let content;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    scanned += 1;
    for (const [name, value] of secrets) {
      if (value && content.includes(value.trim())) {
        leaks += 1;
        process.stderr.write(`[audit] FILTRACIÓN de ${name} en ${file.replace(`${target}/`, "")}\n`);
      }
    }
  }

  process.stdout.write(`[audit] ${scanned} archivos inspeccionados · ${secrets.length} secretos vigilados\n`);
  if (leaks > 0) {
    process.stderr.write(`[audit] ${leaks} filtraciones detectadas: el despliegue se detiene.\n`);
    process.exit(1);
  }
  process.stdout.write("[audit] Sin credenciales en el artefacto.\n");
}

main().catch((error) => {
  process.stderr.write(`[audit] Error: ${error?.message ?? error}\n`);
  process.exit(1);
});
