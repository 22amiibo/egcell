import "@testing-library/jest-dom/vitest";

/**
 * Node 26 ships an experimental `localStorage` global that stays inert unless the process is
 * started with `--localstorage-file`. It shadows the implementation jsdom would otherwise install,
 * which leaves `window.localStorage` undefined under Vitest.
 *
 * The app already survives that (`createLocalJsonStorage` guards every call), but the tests need a
 * store that actually holds a value in order to prove personal records persist. This installs a
 * minimal one. Browsers never take this path.
 */
function installLocalStorage() {
  const entries = new Map<string, string>();

  const storage: Storage = {
    get length() {
      return entries.size;
    },
    key(index: number) {
      return [...entries.keys()][index] ?? null;
    },
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      entries.set(key, String(value));
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
    writable: false,
  });
}

if (typeof window !== "undefined" && !window.localStorage) {
  installLocalStorage();
}
