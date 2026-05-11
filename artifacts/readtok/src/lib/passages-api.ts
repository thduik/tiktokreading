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
export type PassageFactoryTag = "v1" | "v2" | "v3" | "v4";

export const PASSAGE_FACTORY_TAG_VALUES: PassageFactoryTag[] = [
  "v1",
  "v2",
  "v3",
  "v4",
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
  };
}

interface PassageIdsResponse {
  ids: string[];
  total: number;
  version: string;
  status: string;
  language_code: string | null;
  factory_tag: string | null;
}

interface PassageFeedBootstrapResponse {
  random_passages: PassageDetail[];
  selected_ids: string[];
  all_passage_ids: string[];
  total: number;
  version: string;
  factory_tag: string | null;
}

export interface SubmitPassageReportResponse {
  ok: boolean;
  passage_id: string;
  report_type: PassageReportType;
  aggregates: Array<{
    report_type: PassageReportType;
    count: number;
  }>;
}

const PASSAGE_CACHE_VERSION = "2026-05-11-v4";
const LIST_CACHE_PREFIX = `readtok_passage_list_cache_${PASSAGE_CACHE_VERSION}:`;
const DETAIL_CACHE_PREFIX = `readtok_passage_detail_cache_${PASSAGE_CACHE_VERSION}:`;
const LEGACY_LIST_CACHE_PREFIX = "readtok_passage_list_cache_";
const LEGACY_DETAIL_CACHE_PREFIX = "readtok_passage_detail_cache_";
const listMemoryCache = new Map<string, PassageListResponse>();
const detailMemoryCache = new Map<string, PassageDetail>();

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function purgeLegacyPassageCaches() {
  if (!canUseStorage()) {
    return;
  }

  const markerKey = `readtok_passage_cache_migrated_${PASSAGE_CACHE_VERSION}`;
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

export function normalizePassageFactoryTag(
  raw: string | null | undefined,
): PassageFactoryTag | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    PASSAGE_FACTORY_TAG_VALUES.includes(normalized as PassageFactoryTag)
  ) {
    return normalized as PassageFactoryTag;
  }

  return null;
}

export function readStoredPassageFactoryTag() {
  if (!canUseStorage()) {
    return null;
  }

  return normalizePassageFactoryTag(
    window.localStorage.getItem(PASSAGE_FACTORY_TAG_STORAGE_KEY),
  );
}

export function writeStoredPassageFactoryTag(
  factoryTag: PassageFactoryTag | null,
) {
  if (!canUseStorage()) {
    return;
  }

  if (!factoryTag) {
    window.localStorage.removeItem(PASSAGE_FACTORY_TAG_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(PASSAGE_FACTORY_TAG_STORAGE_KEY, factoryTag);
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
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCachedValue<T>(storageKey: string, value: T) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Ignore storage write failures and continue with in-memory cache.
  }
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
  const storageKey = `${LIST_CACHE_PREFIX}${cacheKey}`;

  const cachedMemory = listMemoryCache.get(cacheKey);
  if (cachedMemory) {
    return cachedMemory;
  }

  const cachedStorage = readCachedValue<PassageListResponse>(storageKey);
  if (cachedStorage) {
    listMemoryCache.set(cacheKey, cachedStorage);
    return cachedStorage;
  }

  const response = await fetchJson<PassageListResponse>(url);
  listMemoryCache.set(cacheKey, response);
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

  const query = searchParams.toString();
  const url = `${API_BASE}/passages/ids${query ? `?${query}` : ""}`;
  return fetchJson<PassageIdsResponse>(url);
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
  return fetchJson<PassageFeedBootstrapResponse>(url);
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
  const storageKey = `${DETAIL_CACHE_PREFIX}${cacheKey}`;

  const cachedMemory = detailMemoryCache.get(cacheKey);
  if (cachedMemory) {
    return cachedMemory;
  }

  const cachedStorage = readCachedValue<PassageDetail>(storageKey);
  if (cachedStorage) {
    detailMemoryCache.set(cacheKey, cachedStorage);
    return cachedStorage;
  }

  const response = await fetchJson<PassageDetail>(url);
  detailMemoryCache.set(cacheKey, response);
  writeCachedValue(storageKey, response);
  return response;
}

export function getCachedPassageDetail(id: string, includeAnswerKey = true) {
  const cacheKey = `${id}|${includeAnswerKey ? "1" : "0"}`;
  const storageKey = `${DETAIL_CACHE_PREFIX}${cacheKey}`;

  const cachedMemory = detailMemoryCache.get(cacheKey);
  if (cachedMemory) {
    return cachedMemory;
  }

  const cachedStorage = readCachedValue<PassageDetail>(storageKey);
  if (cachedStorage) {
    detailMemoryCache.set(cacheKey, cachedStorage);
    return cachedStorage;
  }

  return null;
}

export async function submitPassageReport(
  passageId: string,
  reportType: PassageReportType,
) {
  const response = await fetch(`${API_BASE}/passages/${encodeURIComponent(passageId)}/report`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ reportType }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as SubmitPassageReportResponse;
}
