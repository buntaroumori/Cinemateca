import { navigate } from "./router";

/**
 * Transición de héroe: se captura el rectángulo del póster en la cuadrícula
 * justo antes de navegar y la ficha lo consume para volar desde esa posición
 * exacta. Vive en memoria (mismo documento, cero recargas) con caducidad.
 */
export interface HeroSnapshot {
  id: number;
  top: number;
  left: number;
  width: number;
  height: number;
  capturedAt: number;
}

let pending: HeroSnapshot | null = null;

export function captureHero(id: number, element: HTMLElement | null): void {
  if (!element) {
    pending = null;
    return;
  }
  const rect = element.getBoundingClientRect();
  pending = {
    id,
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    capturedAt: Date.now(),
  };
}

/** Devuelve el snapshot una única vez (se consume al leerlo). */
export function consumeHero(id: number): HeroSnapshot | null {
  const current = pending;
  pending = null;
  if (!current || current.id !== id) return null;
  if (Date.now() - current.capturedAt > 2500) return null;
  return current;
}

export function peekHero(id: number): HeroSnapshot | null {
  if (!pending || pending.id !== id) return null;
  return pending;
}

export function openFilmWithHero(id: number, element: HTMLElement | null): void {
  captureHero(id, element);
  navigate(`/film/${id}`, { keepScroll: false });
}

export function clearHero(): void {
  pending = null;
}
