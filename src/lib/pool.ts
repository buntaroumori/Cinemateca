export interface Task<T> {
  (): Promise<T>;
}

/**
 * Ejecuta tareas asíncronas con un límite de concurrencia, preservando el
 * orden de los resultados. Se usa para hidratar keywords/paletas en paralelo
 * sin saturar el límite de peticiones de TMDB.
 */
export async function runPool<T>(tasks: Task<T>[], limit = 4): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const workers = new Array(Math.max(1, Math.min(limit, tasks.length))).fill(0).map(async () => {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timer: number | undefined;
  const debounced = (...args: A) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, wait);
  };
  debounced.cancel = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}
