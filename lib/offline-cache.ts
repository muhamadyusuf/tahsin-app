// Generic offline cache for read-only external API calls (Qur'an text, doa,
// hadis, jadwal sholat, …). These sources are effectively static once fetched,
// so a network-first / cache-fallback strategy is enough: always prefer a
// fresh response, but degrade to the last known-good copy instead of an error
// screen when the device has no connection.

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const CACHE_PREFIX = "@tahsin_cache:";

// Lazily required so this module (and its default store) can be unit-tested
// without pulling in the native AsyncStorage module — callers that pass an
// explicit `store` never trigger this require at all.
function defaultStore(): KeyValueStore {
  // Must stay lazy so tests (and any non-native environment) never load it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@react-native-async-storage/async-storage").default;
}

async function readCache<T>(store: KeyValueStore, key: string): Promise<T | null> {
  try {
    const raw = await store.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeCache<T>(
  store: KeyValueStore,
  key: string,
  value: T
): Promise<void> {
  try {
    await store.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Persisting is a nice-to-have — a full disk or storage error must never
    // break the caller, which already has a perfectly good network response.
  }
}

/**
 * Network-first fetch that falls back to the last successful response cached
 * under `key` when `fetcher` fails (offline, timeout, API error). Every
 * successful response is persisted so it can serve as that fallback next
 * time. Pick a key that's stable across calls whose results should be
 * interchangeable as a fallback (e.g. a fixed endpoint URL) — a key that
 * changes on every call defeats the fallback.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  store: KeyValueStore = defaultStore()
): Promise<T> {
  try {
    const data = await fetcher();
    await writeCache(store, key, data);
    return data;
  } catch (error) {
    const cached = await readCache<T>(store, key);
    if (cached !== null) return cached;
    throw error;
  }
}
