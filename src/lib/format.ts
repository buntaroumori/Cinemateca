export function cx(...values: (string | false | null | undefined)[]): string {
  let out = "";
  for (const value of values) {
    if (!value) continue;
    out = out ? `${out} ${value}` : value;
  }
  return out;
}

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, "0")} min`;
}

export function formatMoney(amount: number | null | undefined): string {
  if (!amount || amount <= 0) return "—";
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2).replace(/\.00$/, "")} B $`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")} M $`;
  return `${Math.round(amount / 1000)} K $`;
}

export function formatScore(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toFixed(1).replace(".", ",");
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")} K`;
  return String(value);
}

const DATE_FORMATTERS = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(`${iso.length === 10 ? iso : iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return DATE_FORMATTERS.format(date);
  } catch {
    return iso;
  }
}

export function yearOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const parsed = Number.parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(parsed) && parsed > 1800 ? parsed : null;
}

export function decadeOf(year: number | null): string {
  if (!year) return "sin datar";
  return `${Math.floor(year / 10) * 10}s`;
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* se intenta el fallback */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
