import { useCallback, useEffect, useState } from "react";
import type { Route, RouteName } from "@/lib/types";

/**
 * Enrutador propio de 3 kB: History API + restauración desde el fallback
 * 404.html de GitHub Pages (deep-linking real) + restauración de scroll.
 * Cero recargas de página.
 */

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";

function stripBase(pathname: string): string {
  if (BASE && pathname.startsWith(BASE)) {
    const rest = pathname.slice(BASE.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return pathname;
}

export function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return `${BASE}${clean}${qs ? `?${qs}` : ""}`;
}

export function parseRoute(pathname: string, search: string): Route {
  const path = stripBase(pathname);
  const query = new URLSearchParams(search);
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);

  if (segments.length === 0) {
    return { name: "home", path: "/", params: {}, query };
  }
  if (segments[0] === "film" && segments[1] && /^\d+$/.test(segments[1])) {
    return {
      name: "film",
      path: `/film/${segments[1]}`,
      params: { id: segments[1] },
      query,
    };
  }
  return { name: "not-found", path, params: {}, query };
}

function currentRoute(): Route {
  if (typeof window === "undefined") {
    return { name: "home", path: "/", params: {}, query: new URLSearchParams() };
  }
  return parseRoute(window.location.pathname, window.location.search);
}

type Listener = (route: Route) => void;
const listeners = new Set<Listener>();
let activeRoute: Route = currentRoute();

function emit(route: Route): void {
  activeRoute = route;
  for (const listener of listeners) listener(route);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface NavigateOptions {
  replace?: boolean;
  /** Conserva la posición de scroll actual (transiciones de héroe). */
  keepScroll?: boolean;
}

const scrollMemory = new Map<string, number>();

function rememberScroll(): void {
  scrollMemory.set(activeRoute.path, window.scrollY);
}

export function navigate(to: string, options: NavigateOptions = {}): void {
  if (typeof window === "undefined") return;
  const url = to.startsWith("http") ? to : buildUrl(to);
  if (url === window.location.pathname + window.location.search) return;
  rememberScroll();
  if (options.replace) {
    window.history.replaceState({ path: to }, "", url);
  } else {
    window.history.pushState({ path: to }, "", url);
  }
  const next = parseRoute(window.location.pathname, window.location.search);
  emit(next);
  if (!options.keepScroll) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }
}

export function navigateBack(fallback = "/"): void {
  if (typeof window === "undefined") return;
  if (window.history.length > 1) {
    rememberScroll();
    window.history.back();
    return;
  }
  navigate(fallback, { replace: true });
}

/** Restaura una ruta profunda recibida desde el 404.html de GitHub Pages. */
export function restoreDeepLink(): boolean {
  if (typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  const encoded = query.get("__route");
  const hash = window.location.hash;
  const target = encoded
    ? decodeURIComponent(encoded)
    : hash && hash.length > 1 && hash.startsWith("#/")
      ? decodeURI(hash.slice(1))
      : null;
  if (!target) return false;
  query.delete("__route");
  const [pathPart, searchPart] = target.split("?");
  const merged = new URLSearchParams(searchPart ?? "");
  for (const [key, value] of query.entries()) merged.set(key, value);
  const qs = merged.toString();
  const url = `${BASE}${pathPart}${qs ? `?${qs}` : ""}`;
  window.history.replaceState({ path: pathPart }, "", url);
  emit(parseRoute(window.location.pathname, window.location.search));
  return true;
}

function handlePopState(): void {
  const next = parseRoute(window.location.pathname, window.location.search);
  emit(next);
  const saved = scrollMemory.get(next.path);
  window.scrollTo({ top: saved ?? 0, left: 0, behavior: "auto" });
}

let started = false;
export function startRouter(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("popstate", handlePopState);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(activeRoute);
  const listener = useCallback((next: Route) => setRoute(next), []);
  useEffect(() => subscribe(listener), [listener]);
  return route;
}

export function routeNameToLabel(name: RouteName): string {
  switch (name) {
    case "home":
      return "Cartelera sensorial";
    case "film":
      return "Deep dive";
    case "not-found":
      return "Fuera de programa";
  }
}
