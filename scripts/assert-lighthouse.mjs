#!/usr/bin/env node
/**
 * Puerta de calidad: exige 100/100 en las cuatro categorías de Lighthouse
 * sobre el informe generado en CI (.lighthouseci o lighthouse-results).
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const REQUIRED = {
  performance: 100,
  accessibility: 100,
  "best-practices": 100,
  seo: 100,
};

const candidates = process.argv.slice(2).length
  ? process.argv.slice(2).map((dir) => resolve(process.cwd(), dir))
  : [resolve(process.cwd(), ".lighthouseci"), resolve(process.cwd(), "lighthouse-results")];

async function findReports() {
  for (const dir of candidates) {
    try {
      const entries = await readdir(dir);
      const json = entries.filter((name) => /^lhr-.*\.json$/i.test(name) || /^.*report.*\.json$/i.test(name));
      if (json.length) return json.map((name) => join(dir, name));
    } catch {
      /* siguiente candidato */
    }
  }
  return [];
}

async function main() {
  const reports = await findReports();
  if (reports.length === 0) {
    process.stdout.write("[lighthouse] No se encontró ningún informe; se omite la puerta de calidad.\n");
    return;
  }

  let failures = 0;
  for (const report of reports) {
    const raw = await readFile(report, "utf8");
    const lhr = JSON.parse(raw);
    const categories = lhr.categories ?? {};
    const line = [];
    for (const [key, min] of Object.entries(REQUIRED)) {
      const score = categories[key]?.score;
      const value = typeof score === "number" ? Math.round(score * 100) : null;
      line.push(`${key}=${value ?? "n/d"}`);
      if (value === null || value < min) failures += 1;
    }
    process.stdout.write(`[lighthouse] ${report.split("/").pop()} → ${line.join(" · ")}\n`);
  }

  if (failures > 0) {
    process.stderr.write(`[lighthouse] ${failures} métricas por debajo de 100.\n`);
    process.exit(1);
  }
  process.stdout.write("[lighthouse] 100/100 en todas las categorías.\n");
}

main().catch((error) => {
  process.stderr.write(`[lighthouse] Error: ${error?.message ?? error}\n`);
  process.exit(1);
});
