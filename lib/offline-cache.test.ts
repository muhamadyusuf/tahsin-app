import { describe, expect, test, vi } from "vitest";
import { cachedFetch, KeyValueStore } from "./offline-cache";

function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    async getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
  };
}

describe("cachedFetch", () => {
  test("returns fresh data on success", async () => {
    const store = createMemoryStore();
    const fetcher = vi.fn().mockResolvedValue({ hello: "world" });

    const result = await cachedFetch("greeting", fetcher, store);

    expect(result).toEqual({ hello: "world" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("falls back to the last cached value when the fetch fails", async () => {
    const store = createMemoryStore();
    await cachedFetch("greeting", () => Promise.resolve({ hello: "world" }), store);

    const failingFetcher = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await cachedFetch("greeting", failingFetcher, store);

    expect(result).toEqual({ hello: "world" });
  });

  test("rethrows the original error when the fetch fails and nothing is cached", async () => {
    const store = createMemoryStore();
    const error = new Error("network down");

    await expect(
      cachedFetch("greeting", () => Promise.reject(error), store)
    ).rejects.toThrow("network down");
  });

  test("always prefers fresh data over the cache when the network succeeds", async () => {
    const store = createMemoryStore();
    await cachedFetch("greeting", () => Promise.resolve({ version: 1 }), store);
    const result = await cachedFetch("greeting", () => Promise.resolve({ version: 2 }), store);

    expect(result).toEqual({ version: 2 });
  });

  test("keeps separate cache entries per key", async () => {
    const store = createMemoryStore();
    await cachedFetch("a", () => Promise.resolve("A"), store);
    await cachedFetch("b", () => Promise.resolve("B"), store);

    const resultA = await cachedFetch("a", () => Promise.reject(new Error("down")), store);
    const resultB = await cachedFetch("b", () => Promise.reject(new Error("down")), store);

    expect(resultA).toBe("A");
    expect(resultB).toBe("B");
  });

  test("treats a corrupted cache entry as a miss instead of throwing", async () => {
    const store = createMemoryStore();
    await store.setItem("@tahsin_cache:broken", "{not json");

    await expect(
      cachedFetch("broken", () => Promise.reject(new Error("down")), store)
    ).rejects.toThrow("down");
  });
});
