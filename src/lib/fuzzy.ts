/**
 * Búsqueda tolerante: normalización, subcadena, prefijos por token y
 * distancia de Levenshtein acotada. Sin dependencias externas.
 */

export interface FuzzyMatch {
  score: number;
  matched: boolean;
  indices: number[];
}

const DIACRITICS = /[\u0300-\u036f]/g;

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[·._/\\'’"“”\-–—:;,!?()&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string, max = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

function tokenDistance(queryToken: string, targetTokens: string[]): { distance: number; ratio: number } {
  let best = Number.POSITIVE_INFINITY;
  let bestRatio = 0;
  for (const token of targetTokens) {
    const distance = levenshtein(queryToken, token, Math.max(2, Math.floor(queryToken.length / 3)));
    const ratio = 1 - distance / Math.max(queryToken.length, token.length, 1);
    if (distance < best) best = distance;
    if (ratio > bestRatio) bestRatio = ratio;
    if (best === 0) break;
  }
  return { distance: Number.isFinite(best) ? best : 99, ratio: bestRatio };
}

/** Puntúa un candidato contra la consulta. 1 = exacto, 0 = sin relación. */
export function fuzzyScore(query: string, candidate: string): FuzzyMatch {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q) return { score: 0, matched: true, indices: [] };
  if (!c) return { score: 0, matched: false, indices: [] };

  if (c === q) return { score: 1, matched: true, indices: rangeIndices(c, q) };

  const substringIndex = c.indexOf(q);
  if (substringIndex >= 0) {
    const coverage = q.length / c.length;
    const positionBonus = substringIndex === 0 ? 0.14 : 0.04;
    return {
      score: Math.min(0.99, 0.6 + coverage * 0.3 + positionBonus),
      matched: true,
      indices: rangeIndicesAt(substringIndex, q.length),
    };
  }

  const queryTokens = q.split(" ").filter(Boolean);
  const candidateTokens = c.split(" ").filter(Boolean);
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return { score: 0, matched: false, indices: [] };
  }

  let total = 0;
  let matchedTokens = 0;
  for (const token of queryTokens) {
    const { distance, ratio } = tokenDistance(token, candidateTokens);
    const allowed = token.length <= 4 ? 1 : token.length <= 7 ? 2 : 3;
    if (distance <= allowed) {
      matchedTokens += 1;
      total += ratio;
    } else {
      const prefix = candidateTokens.find((t) => t.startsWith(token.slice(0, Math.max(2, token.length - 2))));
      if (prefix) {
        matchedTokens += 0.6;
        total += 0.55;
      }
    }
  }

  const coverage = matchedTokens / queryTokens.length;
  if (coverage < 0.5) return { score: 0, matched: false, indices: [] };
  const score = Math.min(0.86, coverage * (total / Math.max(matchedTokens, 0.001)) * 0.9);
  return { score, matched: score > 0.28, indices: [] };
}

function rangeIndices(haystack: string, needle: string): number[] {
  const index = haystack.indexOf(needle);
  return index >= 0 ? rangeIndicesAt(index, needle.length) : [];
}

function rangeIndicesAt(start: number, length: number): number[] {
  const out: number[] = [];
  for (let i = start; i < start + length; i++) out.push(i);
  return out;
}

export interface FuzzyResult<T> {
  item: T;
  score: number;
}

export function fuzzyFilter<T>(
  query: string,
  items: T[],
  getKeys: (item: T) => string[],
  limit = 60,
): FuzzyResult<T>[] {
  const q = normalize(query);
  if (!q) return [];
  const results: FuzzyResult<T>[] = [];
  for (const item of items) {
    let best = 0;
    for (const key of getKeys(item)) {
      if (!key) continue;
      const { score, matched } = fuzzyScore(q, key);
      if (matched && score > best) best = score;
      if (best > 0.97) break;
    }
    if (best > 0.28) results.push({ item, score: best });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/** Resalta los tramos coincidentes de `text` contra `query`. */
export function highlightSegments(text: string, query: string): { text: string; hit: boolean }[] {
  const q = normalize(query);
  if (!q) return [{ text, hit: false }];
  const normalized = normalize(text);
  const index = normalized.indexOf(q);
  if (index < 0 || normalized.length !== text.length) {
    const lowerText = text.toLowerCase();
    const lowerIndex = lowerText.indexOf(q);
    if (lowerIndex < 0) return [{ text, hit: false }];
    return [
      { text: text.slice(0, lowerIndex), hit: false },
      { text: text.slice(lowerIndex, lowerIndex + q.length), hit: true },
      { text: text.slice(lowerIndex + q.length), hit: false },
    ];
  }
  return [
    { text: text.slice(0, index), hit: false },
    { text: text.slice(index, index + q.length), hit: true },
    { text: text.slice(index + q.length), hit: false },
  ];
}
