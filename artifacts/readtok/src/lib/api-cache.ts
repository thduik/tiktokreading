export type ApiCacheScope = "public" | "user";

export const DEFAULT_API_CACHE_TTL_MS = 10 * 60 * 1000;

type ApiCacheRecord<T> = {
  version: 1;
  cachedAt: number;
  expiresAt: number;
  payload: T;
};

const API_CACHE_STORAGE_PREFIX = "readtok_api_cache_v1:";
const API_CACHE_USER_SCOPE_STORAGE_KEY = "readtok_api_cache_user_scope_v1";
const DEFAULT_USER_SCOPE = "__anon__";
const memoryCache = new Map<string, ApiCacheRecord<unknown>>();
const inflightCache = new Map<string, Promise<unknown>>();

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function buildStorageKey(fullKey: string) {
  return `${API_CACHE_STORAGE_PREFIX}${fullKey}`;
}

function buildScopedKey(key: string, scope: ApiCacheScope) {
  if (scope === "public") {
    return `public:${key}`;
  }

  return `user:${readActiveApiCacheUserScope()}:${key}`;
}

function isExpired(record: Pick<ApiCacheRecord<unknown>, "expiresAt">) {
  return !Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now();
}

function parseApiCacheRecord<T>(value: unknown): ApiCacheRecord<T> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = value as Partial<ApiCacheRecord<T>>;
  if (
    parsed.version !== 1 ||
    typeof parsed.cachedAt !== "number" ||
    typeof parsed.expiresAt !== "number" ||
    !("payload" in parsed)
  ) {
    return null;
  }

  return parsed as ApiCacheRecord<T>;
}

function deleteStorageKey(storageKey: string) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function readRecord<T>(fullKey: string): ApiCacheRecord<T> | null {
  const cachedMemory = memoryCache.get(fullKey);
  if (cachedMemory) {
    if (isExpired(cachedMemory)) {
      memoryCache.delete(fullKey);
      deleteStorageKey(buildStorageKey(fullKey));
      return null;
    }
    return cachedMemory as ApiCacheRecord<T>;
  }

  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(fullKey));
    if (!raw) {
      return null;
    }

    const parsed = parseApiCacheRecord<T>(JSON.parse(raw));
    if (!parsed) {
      deleteStorageKey(buildStorageKey(fullKey));
      return null;
    }

    if (isExpired(parsed)) {
      deleteStorageKey(buildStorageKey(fullKey));
      return null;
    }

    memoryCache.set(fullKey, parsed);
    return parsed;
  } catch {
    deleteStorageKey(buildStorageKey(fullKey));
    return null;
  }
}

function writeRecord<T>(fullKey: string, payload: T, ttlMs: number) {
  const now = Date.now();
  const record: ApiCacheRecord<T> = {
    version: 1,
    cachedAt: now,
    expiresAt: now + Math.max(0, Math.trunc(ttlMs)),
    payload,
  };

  memoryCache.set(fullKey, record);

  if (!canUseStorage()) {
    return payload;
  }

  try {
    window.localStorage.setItem(buildStorageKey(fullKey), JSON.stringify(record));
  } catch {
    // Ignore storage write failures and continue with memory cache.
  }

  return payload;
}

export function readActiveApiCacheUserScope() {
  if (!canUseStorage()) {
    return DEFAULT_USER_SCOPE;
  }

  const raw = window.localStorage.getItem(API_CACHE_USER_SCOPE_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_USER_SCOPE;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : DEFAULT_USER_SCOPE;
}

export function setActiveApiCacheUserScope(userScope: string | null | undefined) {
  if (!canUseStorage()) {
    return;
  }

  if (!userScope || userScope.trim().length === 0) {
    window.localStorage.setItem(API_CACHE_USER_SCOPE_STORAGE_KEY, DEFAULT_USER_SCOPE);
    return;
  }

  window.localStorage.setItem(API_CACHE_USER_SCOPE_STORAGE_KEY, userScope.trim());
}

export function readCachedApiValue<T>(
  key: string,
  scope: ApiCacheScope = "public",
) {
  return readRecord<T>(buildScopedKey(key, scope))?.payload ?? null;
}

export function writeCachedApiValue<T>(
  key: string,
  payload: T,
  ttlMs = DEFAULT_API_CACHE_TTL_MS,
  scope: ApiCacheScope = "public",
) {
  return writeRecord(buildScopedKey(key, scope), payload, ttlMs);
}

export function mutateCachedApiValue<T>(
  key: string,
  updater: (current: T | null) => T | null,
  {
    scope = "public",
    ttlMs = DEFAULT_API_CACHE_TTL_MS,
  }: { scope?: ApiCacheScope; ttlMs?: number } = {},
) {
  const fullKey = buildScopedKey(key, scope);
  const nextValue = updater(readRecord<T>(fullKey)?.payload ?? null);
  if (nextValue === null) {
    memoryCache.delete(fullKey);
    deleteStorageKey(buildStorageKey(fullKey));
    return null;
  }
  return writeRecord(fullKey, nextValue, ttlMs);
}

export function invalidateCachedApiValue(
  key: string,
  scope: ApiCacheScope = "public",
) {
  const fullKey = buildScopedKey(key, scope);
  memoryCache.delete(fullKey);
  deleteStorageKey(buildStorageKey(fullKey));
}

export function invalidateCachedApiPrefix(
  prefix: string,
  scope: ApiCacheScope = "public",
) {
  const scopedPrefix = buildScopedKey(prefix, scope);

  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(scopedPrefix)) {
      memoryCache.delete(key);
    }
  }

  if (!canUseStorage()) {
    return;
  }

  try {
    const storagePrefix = buildStorageKey(scopedPrefix);
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(storagePrefix)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage cleanup failures.
  }
}

export async function getOrFetchCachedApiValue<T>({
  key,
  scope = "public",
  ttlMs = DEFAULT_API_CACHE_TTL_MS,
  fetcher,
}: {
  key: string;
  scope?: ApiCacheScope;
  ttlMs?: number;
  fetcher: () => Promise<T>;
}) {
  const fullKey = buildScopedKey(key, scope);
  const cached = readRecord<T>(fullKey);
  if (cached) {
    return cached.payload;
  }

  const inflight = inflightCache.get(fullKey);
  if (inflight) {
    return (await inflight) as T;
  }

  const request = fetcher()
    .then((payload) => writeRecord(fullKey, payload, ttlMs))
    .finally(() => {
      inflightCache.delete(fullKey);
    });

  inflightCache.set(fullKey, request);
  return request;
}

export function clearAllCachedApiValues() {
  memoryCache.clear();
  inflightCache.clear();

  if (!canUseStorage()) {
    return;
  }

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(API_CACHE_STORAGE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage cleanup failures.
  }
}
