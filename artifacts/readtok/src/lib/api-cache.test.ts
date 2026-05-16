import test from "node:test";
import assert from "node:assert/strict";
import {
  clearAllCachedApiValues,
  getOrFetchCachedApiValue,
  readCachedApiValue,
  setActiveApiCacheUserScope,
  writeCachedApiValue,
} from "@/lib/api-cache";

class MockLocalStorage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

function installMockWindow() {
  const mockWindow = {
    localStorage: new MockLocalStorage(),
  } as unknown as Window & typeof globalThis;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: mockWindow,
  });

  return mockWindow;
}

test.beforeEach(() => {
  installMockWindow();
  clearAllCachedApiValues();
  setActiveApiCacheUserScope(null);
});

test.afterEach(() => {
  clearAllCachedApiValues();
});

test("api cache stores public values and expires them by ttl", async () => {
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;

  try {
    writeCachedApiValue("public:test", { value: 1 }, 1000, "public");
    assert.deepEqual(readCachedApiValue("public:test", "public"), { value: 1 });

    now += 1001;
    assert.equal(readCachedApiValue("public:test", "public"), null);
  } finally {
    Date.now = originalNow;
  }
});

test("api cache scopes user values by active user id", async () => {
  setActiveApiCacheUserScope("user_a");
  writeCachedApiValue("dashboard", { count: 2 }, 1000, "user");

  assert.deepEqual(readCachedApiValue("dashboard", "user"), { count: 2 });

  setActiveApiCacheUserScope("user_b");
  assert.equal(readCachedApiValue("dashboard", "user"), null);
});

test("api cache deduplicates inflight fetches", async () => {
  let fetchCount = 0;

  const [first, second] = await Promise.all([
    getOrFetchCachedApiValue({
      key: "leaderboard:global:50",
      scope: "public",
      ttlMs: 1000,
      fetcher: async () => {
        fetchCount += 1;
        return { ok: true };
      },
    }),
    getOrFetchCachedApiValue({
      key: "leaderboard:global:50",
      scope: "public",
      ttlMs: 1000,
      fetcher: async () => {
        fetchCount += 1;
        return { ok: true };
      },
    }),
  ]);

  assert.deepEqual(first, { ok: true });
  assert.deepEqual(second, { ok: true });
  assert.equal(fetchCount, 1);
});
