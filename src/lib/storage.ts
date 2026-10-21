import { isTauri } from "./platform";

type StoreLike = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
};

let storePromise: Promise<StoreLike | null> | null = null;

function localKey(key: string) {
  return `stepunder:${key}`;
}

async function getStore(): Promise<StoreLike | null> {
  if (!isTauri) return null;
  if (!storePromise) {
    storePromise = import("@tauri-apps/plugin-store")
      .then(({ load }) => load("app.json") as unknown as Promise<StoreLike>)
      .catch((error) => {
        console.error("Failed to open settings store", error);
        return null;
      });
  }
  return storePromise;
}

/** Read a persisted setting. Falls back to localStorage when running in a browser. */
export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const store = await getStore();
    if (store) {
      const value = await store.get<T>(key);
      return value === undefined || value === null ? fallback : value;
    }
    const raw = localStorage.getItem(localKey(key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (error) {
    console.error(`Failed to read setting "${key}"`, error);
    return fallback;
  }
}

/** Write a persisted setting. */
export async function writeSetting(key: string, value: unknown): Promise<void> {
  try {
    const store = await getStore();
    if (store) {
      await store.set(key, value);
      await store.save();
      return;
    }
    localStorage.setItem(localKey(key), JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write setting "${key}"`, error);
  }
}
