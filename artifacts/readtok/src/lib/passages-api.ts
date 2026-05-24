export type QuestionSetTypeIndex =
  | "tfng"
  | "mcq"
  | "sentence_completion"
  | "short_answer"
  | "mixed";

export type QuestionTypeIndex =
  | "tfng"
  | "mcq"
  | "sentence_completion"
  | "short_answer";

export type AnswerType = "label" | "option_key" | "text";
export type PassageFactoryTag = string;
export const PASSAGE_FACTORY_TAG_FILTER_VALUES: PassageFactoryTag[] = [
  "v1",
  "v2",
  "v5",
  "v5_5",
  "v6",
  "v6_plus",
  // Keep this open-ended bucket so future v6/v7/... passage batches appear
  // without another frontend filter change.
  "v5_plus",
];
export const PASSAGE_FACTORY_TAG_STORAGE_KEY =
  "readtok_active_factory_tag_filter_v1";

export interface PassageListItem {
  id: string;
  exam_index: string;
  exam_label: string;
  band_index: number;
  band_label: string;
  question_set_type_index: QuestionSetTypeIndex;
  question_set_type_label: string;
  topic_index: string;
  topic_label: string;
  title: string;
  factory_tag: string;
  language_code: string;
  status: string;
  question_count: number;
}

export interface QuestionPayload {
  [key: string]: unknown;
}

export interface PassageQuestion {
  id: number;
  order_index: number;
  question_type_index: QuestionTypeIndex;
  question_type_label: string;
  prompt: string;
  payload: QuestionPayload;
}

export interface PassageAnswerKey {
  question_id: number;
  answer_type: AnswerType;
  answer_value: string;
  accepted_values?: string[] | null;
  explanation: string;
  evidence?: PassageEvidenceItem[];
}

export interface PassageEvidenceItem {
  sentence_index: number;
  evidence_type: string;
  highlight_text?: string;
  explanation_role?: string;
}

export interface PassageSentence {
  sentence_index: number;
  text: string;
}

export interface PassageVocabItem {
  term: string;
  definition: string;
  simple_meaning_en?: string;
  example_sentence_en?: string;
  meaning_vi?: string;
  sentence_index?: number;
}

export interface PassageDetail {
  id: string;
  schema_version: string;
  exam_index: string;
  exam_label: string;
  band_index: number;
  band_label: string;
  question_set_type_index: QuestionSetTypeIndex;
  question_set_type_label: string;
  topic_index: string;
  topic_label: string;
  title: string;
  factory_tag: string;
  language_code: string;
  status: string;
  passage: string;
  passage_meta: {
    sentence_count: number;
    word_count: number;
  };
  vocab: PassageVocabItem[];
  passage_sentences: PassageSentence[];
  questions: PassageQuestion[];
  answer_key: PassageAnswerKey[];
}

export interface PassageListFilters {
  band_index?: number;
  question_set_type_index?: QuestionSetTypeIndex;
  question_type_index?: QuestionTypeIndex;
  factory_tag?: PassageFactoryTag;
  topic_index?: string;
  status?: string;
  language_code?: string;
  ids?: string[];
  title_contains?: string;
  limit?: number;
  offset?: number;
}

export type PassageReportType =
  | "wrong_answer_key"
  | "question_unclear"
  | "questions_too_easy"
  | "questions_too_hard"
  | "passage_text_issue"
  | "formatting_issue"
  | "other";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(
  /\/$/,
  "",
);

interface PassageListResponse {
  items: PassageListItem[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
    total?: number;
  };
  available_factory_tags?: string[];
}

interface PassageIdsResponse {
  ids: string[];
  total: number;
  version: string;
  status: string;
  language_code: string | null;
  factory_tag: string | null;
  available_factory_tags?: string[];
}

interface PassageFeedBootstrapResponse {
  random_passages: PassageDetail[];
  selected_ids: string[];
  all_passage_ids: string[];
  total: number;
  version: string;
  factory_tag: string | null;
  available_factory_tags?: string[];
}

export interface SubmitPassageReportResponse {
  ok: boolean;
  passage_id: string;
  report_type: PassageReportType;
  custom_feedback_saved: boolean;
  aggregates: Array<{
    report_type: PassageReportType;
    count: number;
  }>;
}

const PASSAGE_CACHE_NAMESPACE_STORAGE_PREFIX = "readtok_passage_cache_namespace_v1:";
const LIST_CACHE_PREFIX = "readtok_passage_list_cache:";
const DETAIL_CACHE_PREFIX = "readtok_passage_detail_cache:";
const IDS_CACHE_PREFIX = "readtok_passage_ids_cache:";
const FEED_BOOTSTRAP_CACHE_PREFIX = "readtok_passage_feed_bootstrap_cache:";
const LEGACY_LIST_CACHE_PREFIX = "readtok_passage_list_cache_";
const LEGACY_DETAIL_CACHE_PREFIX = "readtok_passage_detail_cache_";
const PASSAGE_API_CACHE_TTL_MS = 10 * 60 * 1000;
const listMemoryCache = new Map<string, CachedPayloadRecord<PassageListResponse>>();
const detailMemoryCache = new Map<string, CachedPayloadRecord<PassageDetail>>();
const idsMemoryCache = new Map<string, CachedPayloadRecord<PassageIdsResponse>>();
const feedBootstrapMemoryCache = new Map<
  string,
  CachedPayloadRecord<PassageFeedBootstrapResponse>
>();
const passageNamespaceInflight = new Map<string, Promise<string>>();
const PASSAGE_CACHE_NAMESPACE_TTL_MS = 5 * 60 * 1000;
type CachedPayloadRecord<T> = {
  version: 1;
  cachedAt: number;
  expiresAt: number;
  payload: T;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function purgeLegacyPassageCaches() {
  if (!canUseStorage()) {
    return;
  }

  const markerKey = "readtok_passage_cache_migrated_namespace_v1";
  if (window.localStorage.getItem(markerKey) === "true") {
    return;
  }

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (!key) {
        continue;
      }

      const isLegacyPassageCache =
        (key.startsWith(LEGACY_LIST_CACHE_PREFIX) &&
          !key.startsWith(LIST_CACHE_PREFIX)) ||
        (key.startsWith(LEGACY_DETAIL_CACHE_PREFIX) &&
          !key.startsWith(DETAIL_CACHE_PREFIX));

      if (isLegacyPassageCache) {
        window.localStorage.removeItem(key);
      }
    }

    window.localStorage.setItem(markerKey, "true");
  } catch {
    // Ignore storage cleanup failures.
  }
}

purgeLegacyPassageCaches();

type PassageContentNamespaceRecord = {
  version: string;
  checkedAt: number;
};

function buildPassageNamespaceScopeKey({
  status = "active",
  languageCode,
  factoryTag,
}: {
  status?: string;
  languageCode?: string;
  factoryTag?: PassageFactoryTag | null;
}) {
  return `${status}|${languageCode ?? "all"}|${factoryTag ?? "all"}`;
}

function buildPassageNamespaceStorageKey(scopeKey: string) {
  return `${PASSAGE_CACHE_NAMESPACE_STORAGE_PREFIX}${scopeKey}`;
}

function readPassageContentNamespace(scopeKey: string) {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildPassageNamespaceStorageKey(scopeKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PassageContentNamespaceRecord | null;
    if (
      !parsed ||
      typeof parsed.version !== "string" ||
      typeof parsed.checkedAt !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writePassageContentNamespace(scopeKey: string, version: string) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    buildPassageNamespaceStorageKey(scopeKey),
    JSON.stringify({
      version,
      checkedAt: Date.now(),
    } satisfies PassageContentNamespaceRecord),
  );
}

function getPassageCacheNamespace(scopeKey: string) {
  return readPassageContentNamespace(scopeKey)?.version ?? "bootstrap";
}

function buildListCacheStorageKey(cacheKey: string, scopeKey: string) {
  return `${LIST_CACHE_PREFIX}${getPassageCacheNamespace(scopeKey)}:${cacheKey}`;
}

function buildDetailCacheStorageKey(cacheKey: string) {
  const globalScopeKey = buildPassageNamespaceScopeKey({ status: "active" });
  return `${DETAIL_CACHE_PREFIX}${getPassageCacheNamespace(globalScopeKey)}:${cacheKey}`;
}

export function normalizePassageFactoryTag(
  raw: string | null | undefined,
): PassageFactoryTag | null {
  if (!raw) {
    return null;
  }

  const compact = raw.trim().toLowerCase();
  if (/^v\d+\+$/.test(compact)) {
    return compact.replace(/\+$/, "_plus");
  }

  const normalized = compact.replace(/[^a-z0-9]+/g, "_");
  if (/^v\d+(?:_\d+)?$/.test(normalized) || /^v\d+_plus$/.test(normalized)) {
    return normalized;
  }

  return null;
}

export function normalizePassageFactoryTagFilter(
  raw: string | null | undefined,
): PassageFactoryTag | null {
  const normalized = normalizePassageFactoryTag(raw);
  if (!normalized) {
    return null;
  }

  return PASSAGE_FACTORY_TAG_FILTER_VALUES.includes(normalized) ? normalized : null;
}

function parseFactoryTagSortParts(factoryTag: string) {
  const normalized = normalizePassageFactoryTag(factoryTag);
  if (!normalized) {
    return { major: -1, minor: -1, plus: false, raw: factoryTag };
  }

  const plusMatch = normalized.match(/^v(\d+)_plus$/);
  if (plusMatch) {
    return {
      major: Number(plusMatch[1]),
      minor: Number.MAX_SAFE_INTEGER,
      plus: true,
      raw: normalized,
    };
  }

  const match = normalized.match(/^v(\d+)(?:_(\d+))?$/);
  if (!match) {
    return { major: -1, minor: -1, plus: false, raw: normalized };
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    plus: false,
    raw: normalized,
  };
}

export function sortPassageFactoryTags(tags: Array<string | null | undefined>) {
  const uniqueNormalizedTags = Array.from(
    new Set(
      tags
        .map((tag) => normalizePassageFactoryTag(tag))
        .filter((tag): tag is string => Boolean(tag)),
    ),
  );

  return uniqueNormalizedTags.sort((left, right) => {
    const a = parseFactoryTagSortParts(left);
    const b = parseFactoryTagSortParts(right);

    if (a.major !== b.major) {
      return b.major - a.major;
    }
    if (a.minor !== b.minor) {
      return b.minor - a.minor;
    }

    return a.raw.localeCompare(b.raw);
  });
}

export function formatPassageFactoryTagLabel(factoryTag: string | null | undefined) {
  if (!factoryTag) {
    return "";
  }

  const normalizedFactoryTag = normalizePassageFactoryTag(factoryTag);
  if (!normalizedFactoryTag) {
    return "";
  }

  if (/_plus$/.test(normalizedFactoryTag)) {
    return `V${normalizedFactoryTag.replace(/^v/, "").replace(/_plus$/, "+")}`;
  }

  const normalized = normalizedFactoryTag.replace(/^v/, "");
  const labelValue = normalized.replace(/_/g, ".");
  return `V${labelValue}`;
}

export function readStoredPassageFactoryTag() {
  if (!canUseStorage()) {
    return null;
  }

  return normalizePassageFactoryTagFilter(
    window.localStorage.getItem(PASSAGE_FACTORY_TAG_STORAGE_KEY),
  );
}

export function writeStoredPassageFactoryTag(
  factoryTag: PassageFactoryTag | null,
) {
  if (!canUseStorage()) {
    return;
  }

  const normalized = normalizePassageFactoryTagFilter(factoryTag);

  if (!normalized) {
    window.localStorage.removeItem(PASSAGE_FACTORY_TAG_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(PASSAGE_FACTORY_TAG_STORAGE_KEY, normalized);
}

function readCachedValue<T>(storageKey: string): T | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedPayloadRecord<T> | null;
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.cachedAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      !("payload" in parsed)
    ) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeCachedValue<T>(
  storageKey: string,
  value: T,
  ttlMs = PASSAGE_API_CACHE_TTL_MS,
) {
  if (!canUseStorage()) {
    return;
  }

  try {
    const now = Date.now();
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        cachedAt: now,
        expiresAt: now + ttlMs,
        payload: value,
      } satisfies CachedPayloadRecord<T>),
    );
  } catch {
    // Ignore storage write failures and continue with in-memory cache.
  }
}

function readMemoryCachedValue<T>(
  cache: Map<string, CachedPayloadRecord<T>>,
  key: string,
) {
  const record = cache.get(key);
  if (!record) {
    return null;
  }
  if (!Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return record.payload;
}

function writeMemoryCachedValue<T>(
  cache: Map<string, CachedPayloadRecord<T>>,
  key: string,
  payload: T,
  ttlMs = PASSAGE_API_CACHE_TTL_MS,
) {
  const now = Date.now();
  cache.set(key, {
    version: 1,
    cachedAt: now,
    expiresAt: now + ttlMs,
    payload,
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

async function fetchPassageIdsUncached({
  status = "active",
  languageCode,
  factoryTag,
}: {
  status?: string;
  languageCode?: string;
  factoryTag?: PassageFactoryTag;
} = {}) {
  const searchParams = new URLSearchParams();
  if (status !== undefined) {
    searchParams.set("status", status);
  }
  if (languageCode !== undefined) {
    searchParams.set("language_code", languageCode);
  }
  if (factoryTag !== undefined) {
    searchParams.set("factory_tag", factoryTag);
  }

  const query = searchParams.toString();
  const url = `${API_BASE}/passages/ids${query ? `?${query}` : ""}`;
  return fetchJson<PassageIdsResponse>(url);
}

function syncPassageContentNamespace({
  status = "active",
  languageCode,
  factoryTag,
  version,
}: {
  status?: string;
  languageCode?: string;
  factoryTag?: PassageFactoryTag | null;
  version: string;
}) {
  writePassageContentNamespace(
    buildPassageNamespaceScopeKey({ status, languageCode, factoryTag }),
    version,
  );
  writePassageContentNamespace(
    buildPassageNamespaceScopeKey({ status: "active" }),
    version,
  );
}

export async function ensurePassageContentNamespace({
  status = "active",
  languageCode,
  factoryTag,
}: {
  status?: string;
  languageCode?: string;
  factoryTag?: PassageFactoryTag | null;
} = {}) {
  const scopeKey = buildPassageNamespaceScopeKey({ status, languageCode, factoryTag });
  const existing = readPassageContentNamespace(scopeKey);
  if (existing && Date.now() - existing.checkedAt < PASSAGE_CACHE_NAMESPACE_TTL_MS) {
    return existing.version;
  }

  const inflight = passageNamespaceInflight.get(scopeKey);
  if (inflight) {
    return inflight;
  }

  const request = fetchPassageIdsUncached({
    status,
    languageCode,
    factoryTag: factoryTag ?? undefined,
  })
    .then((response) => {
      syncPassageContentNamespace({
        status,
        languageCode,
        factoryTag,
        version: response.version,
      });
      return response.version;
    })
    .finally(() => {
      passageNamespaceInflight.delete(scopeKey);
    });

  passageNamespaceInflight.set(scopeKey, request);
  return request;
}

export async function fetchPassageList(filters: PassageListFilters = {}) {
  const searchParams = new URLSearchParams();

  if (filters.band_index !== undefined) {
    searchParams.set("band_index", String(filters.band_index));
  }
  if (filters.question_set_type_index !== undefined) {
    searchParams.set("question_set_type_index", filters.question_set_type_index);
  }
  if (filters.question_type_index !== undefined) {
    searchParams.set("question_type_index", filters.question_type_index);
  }
  if (filters.factory_tag !== undefined) {
    searchParams.set("factory_tag", filters.factory_tag);
  }
  if (filters.topic_index !== undefined) {
    searchParams.set("topic_index", filters.topic_index);
  }
  if (filters.status !== undefined) {
    searchParams.set("status", filters.status);
  }
  if (filters.language_code !== undefined) {
    searchParams.set("language_code", filters.language_code);
  }
  if (filters.ids && filters.ids.length > 0) {
    searchParams.set("ids", filters.ids.join(","));
  }
  if (filters.title_contains !== undefined) {
    searchParams.set("title_contains", filters.title_contains);
  }
  if (filters.limit !== undefined) {
    searchParams.set("limit", String(filters.limit));
  }
  if (filters.offset !== undefined) {
    searchParams.set("offset", String(filters.offset));
  }

  const query = searchParams.toString();
  const url = `${API_BASE}/passages${query ? `?${query}` : ""}`;
  const cacheKey = query || "__default__";
  const scopeKey = buildPassageNamespaceScopeKey({
    status: filters.status ?? "active",
    languageCode: filters.language_code,
    factoryTag: filters.factory_tag,
  });
  const storageKey = buildListCacheStorageKey(cacheKey, scopeKey);

  const cachedMemory = readMemoryCachedValue(listMemoryCache, storageKey);
  if (cachedMemory) {
    return cachedMemory;
  }

  const cachedStorage = readCachedValue<PassageListResponse>(storageKey);
  if (cachedStorage) {
    writeMemoryCachedValue(listMemoryCache, storageKey, cachedStorage);
    return cachedStorage;
  }

  const response = await fetchJson<PassageListResponse>(url);
  writeMemoryCachedValue(listMemoryCache, storageKey, response);
  writeCachedValue(storageKey, response);
  return response;
}

export async function fetchPassageIds({
  status = "active",
  languageCode,
  factoryTag,
}: {
  status?: string;
  languageCode?: string;
  factoryTag?: PassageFactoryTag;
} = {}) {
  const searchParams = new URLSearchParams();
  if (status !== undefined) {
    searchParams.set("status", status);
  }
  if (languageCode !== undefined) {
    searchParams.set("language_code", languageCode);
  }
  if (factoryTag !== undefined) {
    searchParams.set("factory_tag", factoryTag);
  }
  const query = searchParams.toString() || "__default__";
  const storageKey = `${IDS_CACHE_PREFIX}${query}`;

  const cachedMemory = readMemoryCachedValue(idsMemoryCache, storageKey);
  if (cachedMemory) {
    syncPassageContentNamespace({
      status,
      languageCode,
      factoryTag: factoryTag ?? null,
      version: cachedMemory.version,
    });
    return cachedMemory;
  }

  const cachedStorage = readCachedValue<PassageIdsResponse>(storageKey);
  if (cachedStorage) {
    writeMemoryCachedValue(idsMemoryCache, storageKey, cachedStorage);
    syncPassageContentNamespace({
      status,
      languageCode,
      factoryTag: factoryTag ?? null,
      version: cachedStorage.version,
    });
    return cachedStorage;
  }

  const response = await fetchPassageIdsUncached({ status, languageCode, factoryTag });
  writeMemoryCachedValue(idsMemoryCache, storageKey, response);
  writeCachedValue(storageKey, response);
  syncPassageContentNamespace({
    status,
    languageCode,
    factoryTag: factoryTag ?? null,
    version: response.version,
  });
  return response;
}

export async function fetchPassageFeedBootstrap({
  status = "active",
  languageCode,
  factoryTag,
  limit,
  includeAnswerKey = true,
}: {
  status?: string;
  languageCode?: string;
  factoryTag?: PassageFactoryTag;
  limit?: number;
  includeAnswerKey?: boolean;
} = {}) {
  const searchParams = new URLSearchParams();
  if (status !== undefined) {
    searchParams.set("status", status);
  }
  if (languageCode !== undefined) {
    searchParams.set("language_code", languageCode);
  }
  if (factoryTag !== undefined) {
    searchParams.set("factory_tag", factoryTag);
  }
  if (limit !== undefined) {
    searchParams.set("limit", String(limit));
  }
  if (!includeAnswerKey) {
    searchParams.set("include_answer_key", "false");
  }

  const query = searchParams.toString();
  const url = `${API_BASE}/passages/feed-bootstrap${query ? `?${query}` : ""}`;
  const storageKey = `${FEED_BOOTSTRAP_CACHE_PREFIX}${query || "__default__"}`;

  const cachedMemory = readMemoryCachedValue(feedBootstrapMemoryCache, storageKey);
  if (cachedMemory) {
    syncPassageContentNamespace({
      status,
      languageCode,
      factoryTag: factoryTag ?? null,
      version: cachedMemory.version,
    });
    return cachedMemory;
  }

  const cachedStorage = readCachedValue<PassageFeedBootstrapResponse>(storageKey);
  if (cachedStorage) {
    writeMemoryCachedValue(feedBootstrapMemoryCache, storageKey, cachedStorage);
    syncPassageContentNamespace({
      status,
      languageCode,
      factoryTag: factoryTag ?? null,
      version: cachedStorage.version,
    });
    return cachedStorage;
  }

  const response = await fetchJson<PassageFeedBootstrapResponse>(url);
  writeMemoryCachedValue(feedBootstrapMemoryCache, storageKey, response);
  writeCachedValue(storageKey, response);
  syncPassageContentNamespace({
    status,
    languageCode,
    factoryTag: factoryTag ?? null,
    version: response.version,
  });
  return response;
}

export async function fetchPassageDetail(id: string, includeAnswerKey = true) {
  const searchParams = new URLSearchParams();
  if (!includeAnswerKey) {
    searchParams.set("include_answer_key", "false");
  }

  const query = searchParams.toString();
  const url = `${API_BASE}/passages/${encodeURIComponent(id)}${
    query ? `?${query}` : ""
  }`;
  const cacheKey = `${id}|${includeAnswerKey ? "1" : "0"}`;
  const storageKey = buildDetailCacheStorageKey(cacheKey);

  const cachedMemory = readMemoryCachedValue(detailMemoryCache, storageKey);
  if (cachedMemory) {
    return cachedMemory;
  }

  const cachedStorage = readCachedValue<PassageDetail>(storageKey);
  if (cachedStorage) {
    writeMemoryCachedValue(detailMemoryCache, storageKey, cachedStorage);
    return cachedStorage;
  }

  const response = await fetchJson<PassageDetail>(url);
  writeMemoryCachedValue(detailMemoryCache, storageKey, response);
  writeCachedValue(storageKey, response);
  return response;
}

export function getCachedPassageDetail(id: string, includeAnswerKey = true) {
  const cacheKey = `${id}|${includeAnswerKey ? "1" : "0"}`;
  const storageKey = buildDetailCacheStorageKey(cacheKey);

  const cachedMemory = readMemoryCachedValue(detailMemoryCache, storageKey);
  if (cachedMemory) {
    return cachedMemory;
  }

  const cachedStorage = readCachedValue<PassageDetail>(storageKey);
  if (cachedStorage) {
    writeMemoryCachedValue(detailMemoryCache, storageKey, cachedStorage);
    return cachedStorage;
  }

  return null;
}

export async function submitPassageReport(
  passageId: string,
  reportType: PassageReportType,
  customFeedback?: string,
) {
  const response = await fetch(`${API_BASE}/passages/${encodeURIComponent(passageId)}/report`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ reportType, customFeedback }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as SubmitPassageReportResponse;
}
