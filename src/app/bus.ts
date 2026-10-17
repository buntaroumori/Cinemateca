/** Bus de eventos de interfaz: acopla cabecera, capas modales y páginas. */

export type BusEvent =
  | "search:open"
  | "settings:open"
  | "moods:reveal"
  | "hero:done"
  | "palette:reset";

type Handler = () => void;

const handlers = new Map<BusEvent, Set<Handler>>();

export function on(event: BusEvent, handler: Handler): () => void {
  const set = handlers.get(event) ?? new Set<Handler>();
  set.add(handler);
  handlers.set(event, set);
  return () => {
    set.delete(handler);
  };
}

export function emit(event: BusEvent): void {
  handlers.get(event)?.forEach((handler) => handler());
}
