export type JsonStorage = {
  read<T>(key: string, fallback: T): T;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
};

/**
 * Backed by `localStorage`, but every path is guarded. Reading returns the fallback when there is
 * no window (server render), when the browser refuses storage (private mode, quota, disabled
 * cookies), or when the stored value will not parse. Writing swallows the same failures.
 *
 * A lost personal record must never take the game down with it.
 */
export function createLocalJsonStorage(): JsonStorage {
  return {
    read<T>(key: string, fallback: T): T {
      if (typeof window === "undefined") {
        return fallback;
      }

      try {
        const raw = window.localStorage.getItem(key);

        return raw === null ? fallback : (JSON.parse(raw) as T);
      } catch {
        return fallback;
      }
    },

    write<T>(key: string, value: T): void {
      if (typeof window === "undefined") {
        return;
      }

      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage is full or blocked. The run still counts for this session.
      }
    },

    remove(key: string): void {
      if (typeof window === "undefined") {
        return;
      }

      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing to do. The value stays until the browser clears it.
      }
    },
  };
}

/** An in-memory stand-in with the same semantics, for tests and for server rendering. */
export function createMemoryJsonStorage(seed: Record<string, unknown> = {}): JsonStorage {
  const values = new Map<string, string>(
    Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]),
  );

  return {
    read<T>(key: string, fallback: T): T {
      const raw = values.get(key);

      if (raw === undefined) {
        return fallback;
      }

      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },

    write<T>(key: string, value: T): void {
      values.set(key, JSON.stringify(value));
    },

    remove(key: string): void {
      values.delete(key);
    },
  };
}
