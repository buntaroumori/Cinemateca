import { IDB_NAME, IDB_STORES, IDB_VERSION } from "./constants";

/**
 * Caché de dos niveles: LRU en memoria (0 ms, síncrono) + IndexedDB
 * persistente con TTL. Garantiza que una película ya visitada vuelva a
 * renderizarse instantáneamente aunque se cierre el navegador.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  storedAt: number;
}

class MemoryLru {
  private readonly map = new Map<string, CacheEntry<unknown>>();
  constructor(private readonly max: number) {}

  get<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.map.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }

  set<T>(key: string, entry: CacheEntry<T>): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, entry as CacheEntry<unknown>);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next();
      if (!oldest.done) this.map.delete(oldest.value);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const memory = new MemoryLru(400);

let dbPromise: Promise<IDBDatabase | null> | null = null;

function hasIdb(): boolean {
  return typeof indexedDB !== "undefined";
}

export function openDatabase(): Promise<IDBDatabase | null> {
  if (!hasIdb()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of Object.values(IDB_STORES)) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "key" });
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

interface StoredRecord<T> {
  key: string;
  value: T;
  expiresAt: number;
  storedAt: number;
}

async function idbGet<T>(store: string, key: string): Promise<CacheEntry<T> | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readonly");
      const request = tx.objectStore(store).get(key) as IDBRequest<StoredRecord<T> | undefined>;
      request.onsuccess = () => {
        const record = request.result;
        if (!record) {
          resolve(null);
          return;
        }
        if (record.expiresAt < Date.now()) {
          void idbDelete(store, key);
          resolve(null);
          return;
        }
        resolve({ value: record.value, expiresAt: record.expiresAt, storedAt: record.storedAt });
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet<T>(store: string, key: string, value: T, ttl: number): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  const record: StoredRecord<T> = { key, value, storedAt: Date.now(), expiresAt: Date.now() + ttl };
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function cacheGetSync<T>(key: string): T | undefined {
  return memory.get<T>(key)?.value;
}

export async function cacheGet<T>(key: string, store: string = IDB_STORES.api): Promise<T | undefined> {
  const hit = memory.get<T>(key);
  if (hit) return hit.value;
  const persisted = await idbGet<T>(store, key);
  if (persisted) {
    memory.set(key, persisted);
    return persisted.value;
  }
  return undefined;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttl: number,
  store: string = IDB_STORES.api,
): Promise<void> {
  const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttl, storedAt: Date.now() };
  memory.set(key, entry);
  try {
    await idbSet(store, key, value, ttl);
  } catch {
    /* cuota agotada: la capa de memoria sigue funcionando */
  }
}

export async function cacheDelete(key: string, store: string = IDB_STORES.api): Promise<void> {
  memory.delete(key);
  await idbDelete(store, key);
}

export async function cacheClearStore(store: string): Promise<void> {
  memory.clear();
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function cacheStats(): Promise<{ store: string; entries: number; label: string }[]> {
  const db = await openDatabase();
  const labels: Record<string, string> = {
    [IDB_STORES.api]: "Respuestas TMDB",
    [IDB_STORES.palettes]: "Paletas cromáticas",
    [IDB_STORES.essays]: "Ensayos de alma gemela",
  };
  if (!db) return [];
  const stores = Object.values(IDB_STORES) as string[];
  const counts = await Promise.all(
    stores.map(
      (store) =>
        new Promise<number>((resolve) => {
          try {
            const tx = db.transaction(store, "readonly");
            const request = tx.objectStore(store).count();
            request.onsuccess = () => resolve(request.result ?? 0);
            request.onerror = () => resolve(0);
          } catch {
            resolve(0);
          }
        }),
    ),
  );
  return stores.map((store, index) => ({
    store,
    entries: counts[index],
    label: labels[store] ?? store,
  }));
}

/** Deduplica peticiones en vuelo para no duplicar llamadas a TMDB. */
const inflight = new Map<string, Promise<unknown>>();

export async function dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = factory().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

export function memorySize(): number {
  return memory.size;
}
