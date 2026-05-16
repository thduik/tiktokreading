import { and, asc, eq, inArray } from "drizzle-orm";
import { db, passages, questions } from "@workspace/db";
import { logger } from "../logger";
import { passagesSearchCatalogCacheKey } from "./cache-keys";
import { getRedisClient } from "./redis-client";
import { readJsonCacheResult, writeJsonCache, type JsonCacheStatus } from "./json-cache";

export type PassageSearchCatalogEntry = {
  id: string;
  exam_index: string;
  exam_label: string;
  band_index: number;
  band_label: string;
  question_set_type_index: string;
  question_set_type_label: string;
  question_type_indexes: string[];
  topic_index: string;
  topic_label: string;
  title: string;
  factory_tag: string;
  language_code: string;
  status: string;
  question_count: number;
  search_title: string;
  search_topic: string;
  search_text: string;
};

const memorySearchCatalog = new Map<string, PassageSearchCatalogEntry[]>();

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchQuery(raw: string) {
  return normalizeSearchText(raw)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function passageSearchCatalogKey(params?: {
  status?: string;
  language_code?: string | null;
}) {
  return passagesSearchCatalogCacheKey({
    status: params?.status ?? "active",
    language_code: params?.language_code ?? null,
  });
}

export async function buildPassageSearchCatalog(params?: {
  status?: string;
  languageCode?: string;
}) {
  const status = params?.status ?? "active";
  const languageCode = params?.languageCode;

  const whereConditions = [eq(passages.status, status)];
  if (languageCode) {
    whereConditions.push(eq(passages.languageCode, languageCode));
  }

  const rows = await db
    .select({
      id: passages.id,
      examIndex: passages.examIndex,
      examLabel: passages.examLabel,
      bandIndex: passages.bandIndex,
      bandLabel: passages.bandLabel,
      questionSetTypeIndex: passages.questionSetTypeIndex,
      questionSetTypeLabel: passages.questionSetTypeLabel,
      topicIndex: passages.topicIndex,
      topicLabel: passages.topicLabel,
      title: passages.title,
      factoryTag: passages.factoryTag,
      languageCode: passages.languageCode,
      status: passages.status,
    })
    .from(passages)
    .where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions))
    .orderBy(asc(passages.bandIndex), asc(passages.title), asc(passages.id));

  const passageIds = rows.map((row) => row.id);
  if (passageIds.length === 0) {
    return [];
  }

  const questionRows = await db
    .select({
      passageId: questions.passageId,
      questionTypeIndex: questions.questionTypeIndex,
    })
    .from(questions)
    .where(inArray(questions.passageId, passageIds));

  const questionTypeMap = new Map<string, Set<string>>();
  const questionCountMap = new Map<string, number>();

  for (const row of questionRows) {
    const typeSet = questionTypeMap.get(row.passageId) ?? new Set<string>();
    typeSet.add(row.questionTypeIndex);
    questionTypeMap.set(row.passageId, typeSet);
    questionCountMap.set(row.passageId, (questionCountMap.get(row.passageId) ?? 0) + 1);
  }

  return rows.map<PassageSearchCatalogEntry>((row) => {
    const searchTitle = normalizeSearchText(row.title);
    const searchTopic = normalizeSearchText(row.topicLabel);
    return {
      id: row.id,
      exam_index: row.examIndex,
      exam_label: row.examLabel,
      band_index: row.bandIndex,
      band_label: row.bandLabel,
      question_set_type_index: row.questionSetTypeIndex,
      question_set_type_label: row.questionSetTypeLabel,
      question_type_indexes: Array.from(questionTypeMap.get(row.id) ?? []).sort(),
      topic_index: row.topicIndex,
      topic_label: row.topicLabel,
      title: row.title,
      factory_tag: row.factoryTag,
      language_code: row.languageCode,
      status: row.status,
      question_count: questionCountMap.get(row.id) ?? 0,
      search_title: searchTitle,
      search_topic: searchTopic,
      search_text: `${searchTitle} ${searchTopic}`.trim(),
    };
  });
}

export async function refreshPassageSearchCatalog(params?: {
  status?: string;
  languageCode?: string;
}) {
  const status = params?.status ?? "active";
  const languageCode = params?.languageCode;
  const key = passageSearchCatalogKey({
    status,
    language_code: languageCode ?? null,
  });
  const catalog = await buildPassageSearchCatalog({ status, languageCode });
  memorySearchCatalog.set(key, catalog);

  const client = await getRedisClient();
  if (client) {
    await writeJsonCache({
      key,
      value: catalog,
      ttlSeconds: 60 * 60 * 24 * 30,
    });
  }

  return {
    ok: true as const,
    key,
    count: catalog.length,
    storage: client ? ("redis+memory" as const) : ("memory" as const),
  };
}

export async function readPassageSearchCatalog(params?: {
  status?: string;
  languageCode?: string;
}): Promise<{
  catalog: PassageSearchCatalogEntry[] | null;
  cacheStatus: JsonCacheStatus;
}> {
  const result = await readJsonCacheResult<PassageSearchCatalogEntry[]>(
    passageSearchCatalogKey({
      status: params?.status ?? "active",
      language_code: params?.languageCode ?? null,
    }),
  );

  if (result.value) {
    memorySearchCatalog.set(
      passageSearchCatalogKey({
        status: params?.status ?? "active",
        language_code: params?.languageCode ?? null,
      }),
      result.value,
    );
  }

  const memoryValue = memorySearchCatalog.get(
    passageSearchCatalogKey({
      status: params?.status ?? "active",
      language_code: params?.languageCode ?? null,
    }),
  );

  return {
    catalog: result.value ?? memoryValue ?? null,
    cacheStatus: result.value || memoryValue ? "HIT" : result.status,
  };
}

export async function ensurePassageSearchCatalogWarm(params?: {
  status?: string;
  languageCode?: string;
}) {
  const { catalog } = await readPassageSearchCatalog(params);
  if (catalog && catalog.length > 0) {
    return { warmed: false as const, count: catalog.length };
  }

  try {
    const refreshed = await refreshPassageSearchCatalog(params);
    return { warmed: true as const, count: refreshed.count };
  } catch (error) {
    logger.warn({ err: error }, "Failed to warm passage search catalog");
    return { warmed: false as const, count: 0 };
  }
}
