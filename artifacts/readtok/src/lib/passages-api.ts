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
  topic_index?: string;
  status?: string;
  language_code?: string;
  ids?: string[];
  title_contains?: string;
  limit?: number;
  offset?: number;
}

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

const PASSAGE_CACHE_VERSION = "2026-05-03-v2";
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
