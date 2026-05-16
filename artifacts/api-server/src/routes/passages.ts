import { randomInt } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import {
  QUESTION_TYPE_VALUES,
  QUESTION_SET_TYPE_VALUES,
  answerKeys,
  db,
  type Passage,
  type Question,
  passageReportCounts,
  passages,
  questions,
} from "@workspace/db";
import {
  passageDetailCacheKey,
  passageIdsCacheKey,
  passagesListCacheKey,
} from "../lib/cache/cache-keys";
import {
  passageCacheTtls,
  readJsonCacheResult,
  writeJsonCache,
  type JsonCacheStatus,
} from "../lib/cache/json-cache";
import {
  readPassageSearchCatalog,
  tokenizeSearchQuery,
  type PassageSearchCatalogEntry,
} from "../lib/cache/passage-search-catalog";

const router: IRouter = Router();

const questionSetTypeSet: Set<string> = new Set(QUESTION_SET_TYPE_VALUES);
const questionTypeSet: Set<string> = new Set(QUESTION_TYPE_VALUES);
const REPORT_TYPE_VALUES = [
  "wrong_answer_key",
  "question_unclear",
  "questions_too_easy",
  "passage_text_issue",
  "formatting_issue",
  "other",
] as const;
const reportTypeSet = new Set<string>(REPORT_TYPE_VALUES);

function firstValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function parseFactoryTag(raw: string | undefined) {
  if (raw === undefined) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (normalized.length === 0) {
    return undefined;
  }

  if (!/^v\d+(?:_\d+)?$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function parseOptionalInteger(raw: string | undefined) {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function escapeLikePattern(value: string) {
  return value.replace(/([\\%_])/g, "\\$1");
}

function normalizeVocabTerm(raw: string) {
  return raw.replace(/^[*\-\u2022]+\s*/, "").trim();
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 2000;
const DEFAULT_FEED_BOOTSTRAP_LIMIT = 40;
const MAX_FEED_BOOTSTRAP_LIMIT = 80;

type EvidenceItem = {
  sentence_index: number;
  evidence_type: string;
  highlight_text?: string;
  explanation_role?: string;
};

type VocabItem = {
  term: string;
  definition: string;
  simple_meaning_en?: string;
  example_sentence_en?: string;
  meaning_vi?: string;
  sentence_index?: number;
};

type PassageListItemResponse = {
  id: string;
  exam_index: string;
  exam_label: string;
  band_index: number;
  band_label: string;
  question_set_type_index: string;
  question_set_type_label: string;
  topic_index: string;
  topic_label: string;
  title: string;
  factory_tag: string;
  language_code: string;
  status: string;
  question_count: number;
};

type PassageDetailResponse = {
  id: string;
  schema_version: string;
  exam_index: string;
  exam_label: string;
  band_index: number;
  band_label: string;
  question_set_type_index: string;
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
  vocab: VocabItem[];
  passage_sentences: Array<{ sentence_index: number; text: string }>;
  questions: Array<{
    id: number;
    order_index: number;
    question_type_index: string;
    question_type_label: string;
    prompt: string;
    payload: Record<string, unknown>;
  }>;
  answer_key: Array<{
    question_id: number;
    answer_type: string;
    answer_value: string;
    accepted_values: string[] | null;
    explanation: string;
    evidence: EvidenceItem[];
  }>;
};

type AnswerKeyJoinRow = {
  passageId: string;
  questionId: string;
  sourceQuestionId: number;
  prompt: string;
  answerType: string;
  answerValue: string;
  acceptedValuesJson: string[] | null;
  explanation: string;
  evidenceJson: unknown;
};

type PassageIdPoolResponse = {
  ids: string[];
  total: number;
  version: string;
  factory_tag: string | null;
};

type PassageCatalogSearchParams = {
  titleContains: string;
  bandIndex?: number;
  questionSetTypeIndex?: string;
  questionTypeIndex?: string;
  topicIndex?: string;
  status?: string;
  languageCode?: string;
  factoryTag?: string;
  idsList?: string[];
  limit: number;
  offset: number;
};

function splitPassageIntoSentences(passage: string) {
  return passage
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .map((sentence, index) => ({
      sentence_index: index + 1,
      text: sentence,
    }));
}

function parseEvidenceJson(raw: unknown): EvidenceItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsedItems: EvidenceItem[] = [];

  for (const item of raw) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("sentence_index" in item) ||
      !("evidence_type" in item)
    ) {
      continue;
    }

    const sentenceIndex = (item as { sentence_index?: unknown }).sentence_index;
    const evidenceType = (item as { evidence_type?: unknown }).evidence_type;
    const highlightText = (item as { highlight_text?: unknown }).highlight_text;
    const explanationRole = (item as { explanation_role?: unknown }).explanation_role;

    if (
      typeof sentenceIndex !== "number" ||
      !Number.isInteger(sentenceIndex) ||
      sentenceIndex < 1 ||
      typeof evidenceType !== "string" ||
      evidenceType.length === 0
    ) {
      continue;
    }

    parsedItems.push({
      sentence_index: sentenceIndex,
      evidence_type: evidenceType,
      highlight_text: typeof highlightText === "string" ? highlightText : undefined,
      explanation_role:
        typeof explanationRole === "string" ? explanationRole : undefined,
    });
  }

  return parsedItems;
}

function parseVocabJson(raw: unknown, sentenceCount: number): VocabItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsedItems: VocabItem[] = [];
  for (const item of raw) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("term" in item) ||
      !("definition" in item)
    ) {
      continue;
    }

    const term = (item as { term?: unknown }).term;
    const definition = (item as { definition?: unknown }).definition;
    const meaningVi = (item as { meaning_vi?: unknown }).meaning_vi;
    const simpleMeaningEn = (item as { simple_meaning_en?: unknown }).simple_meaning_en;
    const exampleSentenceEn = (item as { example_sentence_en?: unknown }).example_sentence_en;
    const sentenceIndex = (item as { sentence_index?: unknown }).sentence_index;

    const normalizedTerm = typeof term === "string" ? normalizeVocabTerm(term) : "";

    if (
      normalizedTerm.length === 0 ||
      typeof definition !== "string" ||
      definition.trim().length === 0
    ) {
      continue;
    }

    const normalizedSentenceIndex =
      typeof sentenceIndex === "number" &&
      Number.isInteger(sentenceIndex) &&
      sentenceIndex >= 1 &&
      sentenceIndex <= sentenceCount
        ? sentenceIndex
        : undefined;

    parsedItems.push({
      term: normalizedTerm,
      definition: definition.trim(),
      simple_meaning_en:
        typeof simpleMeaningEn === "string" ? simpleMeaningEn.trim() : undefined,
      example_sentence_en:
        typeof exampleSentenceEn === "string"
          ? exampleSentenceEn.trim()
          : undefined,
      meaning_vi: typeof meaningVi === "string" ? meaningVi.trim() : undefined,
      sentence_index: normalizedSentenceIndex,
    });
  }

  return parsedItems;
}

function scoreCatalogMatch(entry: PassageSearchCatalogEntry, normalizedQuery: string) {
  if (entry.search_title === normalizedQuery) {
    return 400;
  }
  if (entry.search_title.startsWith(normalizedQuery)) {
    return 300;
  }
  if (entry.search_title.includes(normalizedQuery)) {
    return 220;
  }
  if (entry.search_topic.startsWith(normalizedQuery)) {
    return 160;
  }
  if (entry.search_topic.includes(normalizedQuery)) {
    return 120;
  }
  return 80;
}

async function searchPassageCatalog(params: PassageCatalogSearchParams) {
  const {
    titleContains,
    bandIndex,
    questionSetTypeIndex,
    questionTypeIndex,
    topicIndex,
    status,
    languageCode,
    factoryTag,
    idsList,
    limit,
    offset,
  } = params;

  const { catalog, cacheStatus } = await readPassageSearchCatalog({
    status,
    languageCode,
  });

  if (!catalog) {
    return {
      items: null,
      total: 0,
      cacheStatus,
    };
  }

  const tokens = tokenizeSearchQuery(titleContains);
  const normalizedQuery = tokens.join(" ");
  const allowedIds = idsList ? new Set(idsList) : null;

  const matched = catalog
    .filter((entry) => {
      if (bandIndex !== undefined && entry.band_index !== bandIndex) {
        return false;
      }
      if (
        questionSetTypeIndex !== undefined &&
        entry.question_set_type_index !== questionSetTypeIndex
      ) {
        return false;
      }
      if (
        questionTypeIndex !== undefined &&
        !entry.question_type_indexes.includes(questionTypeIndex)
      ) {
        return false;
      }
      if (topicIndex !== undefined && entry.topic_index !== topicIndex) {
        return false;
      }
      if (factoryTag !== undefined && entry.factory_tag !== factoryTag) {
        return false;
      }
      if (allowedIds && !allowedIds.has(entry.id)) {
        return false;
      }
      return tokens.every((token) => entry.search_text.includes(token));
    })
    .map((entry) => ({
      entry,
      score: scoreCatalogMatch(entry, normalizedQuery),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.entry.band_index !== right.entry.band_index) {
        return left.entry.band_index - right.entry.band_index;
      }
      return left.entry.title.localeCompare(right.entry.title) || left.entry.id.localeCompare(right.entry.id);
    });

  const page = matched
    .slice(offset, offset + limit)
    .map(({ entry }) => ({
      id: entry.id,
      exam_index: entry.exam_index,
      exam_label: entry.exam_label,
      band_index: entry.band_index,
      band_label: entry.band_label,
      question_set_type_index: entry.question_set_type_index,
      question_set_type_label: entry.question_set_type_label,
      topic_index: entry.topic_index,
      topic_label: entry.topic_label,
      title: entry.title,
      factory_tag: entry.factory_tag,
      language_code: entry.language_code,
      status: entry.status,
      question_count: entry.question_count,
    }));

  return {
    items: page,
    total: matched.length,
    cacheStatus,
  };
}

function toKeywordTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function deriveFallbackEvidence(
  answerValue: string,
  explanation: string,
  prompt: string,
  passageSentences: Array<{ sentence_index: number; text: string }>,
): EvidenceItem[] {
  if (answerValue.trim().toUpperCase() === "NOT GIVEN") {
    return [];
  }

  const sentenceNumberMatch = explanation.match(/sentence\s+(\d+)/i);
  if (sentenceNumberMatch) {
    const parsedIndex = Number(sentenceNumberMatch[1]);
    if (
      Number.isInteger(parsedIndex) &&
      parsedIndex >= 1 &&
      parsedIndex <= passageSentences.length
    ) {
      return [
        {
          sentence_index: parsedIndex,
          evidence_type: "support",
          explanation_role: "direct_support",
        },
      ];
    }
  }

  const keywordPool = new Set<string>([
    ...toKeywordTokens(prompt),
    ...toKeywordTokens(explanation),
    ...toKeywordTokens(answerValue),
  ]);

  let bestIndex = -1;
  let bestScore = -1;
  for (let index = 0; index < passageSentences.length; index += 1) {
    const sentence = passageSentences[index].text.toLowerCase();
    let score = 0;
    for (const keyword of keywordPool) {
      if (sentence.includes(keyword)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (bestIndex === -1) {
    return [];
  }

  return [
    {
      sentence_index: passageSentences[bestIndex].sentence_index,
      evidence_type: "support",
      explanation_role: "context_match",
    },
  ];
}

function parseBoundedLimit({
  raw,
  fallback,
  max,
}: {
  raw: string | undefined;
  fallback: number;
  max: number;
}) {
  const parsed = parseOptionalInteger(raw);
  if (parsed === null || (parsed !== undefined && (parsed <= 0 || parsed > max))) {
    return null;
  }
  return parsed ?? fallback;
}

function includeAnswerKeyFromQuery(raw: string | undefined) {
  return raw !== "false";
}

function toPassageListItemResponse(row: {
  id: string;
  examIndex: string;
  examLabel: string;
  bandIndex: number;
  bandLabel: string;
  questionSetTypeIndex: string;
  questionSetTypeLabel: string;
  topicIndex: string;
  topicLabel: string;
  title: string;
  factoryTag: string;
  languageCode: string;
  status: string;
  questionCount: number;
}): PassageListItemResponse {
  return {
    id: row.id,
    exam_index: row.examIndex,
    exam_label: row.examLabel,
    band_index: row.bandIndex,
    band_label: row.bandLabel,
    question_set_type_index: row.questionSetTypeIndex,
    question_set_type_label: row.questionSetTypeLabel,
    topic_index: row.topicIndex,
    topic_label: row.topicLabel,
    title: row.title,
    factory_tag: row.factoryTag,
    language_code: row.languageCode,
    status: row.status,
    question_count: row.questionCount,
  };
}

function buildPassageDetailResponse({
  row,
  questionRows,
  answerRows,
  includeAnswerKey,
}: {
  row: Passage;
  questionRows: Question[];
  answerRows: AnswerKeyJoinRow[];
  includeAnswerKey: boolean;
}): PassageDetailResponse {
  const passageSentences = splitPassageIntoSentences(row.passage);
  const vocab = parseVocabJson(row.vocabJson, passageSentences.length);

  return {
    id: row.id,
    schema_version: row.schemaVersion,
    exam_index: row.examIndex,
    exam_label: row.examLabel,
    band_index: row.bandIndex,
    band_label: row.bandLabel,
    question_set_type_index: row.questionSetTypeIndex,
    question_set_type_label: row.questionSetTypeLabel,
    topic_index: row.topicIndex,
    topic_label: row.topicLabel,
    title: row.title,
    factory_tag: row.factoryTag,
    language_code: row.languageCode,
    status: row.status,
    passage: row.passage,
    passage_meta: {
      sentence_count: row.passageMetaSentenceCount,
      word_count: row.passageMetaWordCount,
    },
    vocab,
    passage_sentences: passageSentences,
    questions: questionRows.map((question) => ({
      id: question.sourceQuestionId,
      order_index: question.orderIndex,
      question_type_index: question.questionTypeIndex,
      question_type_label: question.questionTypeLabel,
      prompt: question.prompt,
      payload: question.questionPayloadJson,
    })),
    answer_key: includeAnswerKey
      ? answerRows.map((answer) => {
          const parsedEvidence = parseEvidenceJson(answer.evidenceJson);
          const evidence =
            parsedEvidence.length > 0
              ? parsedEvidence
              : deriveFallbackEvidence(
                  answer.answerValue,
                  answer.explanation,
                  answer.prompt,
                  passageSentences,
                );

          return {
            question_id: answer.sourceQuestionId,
            answer_type: answer.answerType,
            answer_value: answer.answerValue,
            accepted_values: answer.acceptedValuesJson,
            explanation: answer.explanation,
            evidence:
              answer.answerValue.trim().toUpperCase() === "NOT GIVEN"
                ? []
                : evidence,
          };
        })
      : [],
  };
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter((id) => id.length > 0))];
}

function sampleIds(ids: string[], count: number) {
  const candidates = [...ids];
  const targetCount = Math.min(count, candidates.length);

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    const temp = candidates[index];
    candidates[index] = candidates[swapIndex];
    candidates[swapIndex] = temp;
  }

  return candidates.slice(0, targetCount);
}

async function fetchPassageIdPool({
  status,
  languageCode,
  factoryTag,
}: {
  status?: string;
  languageCode?: string;
  factoryTag?: string;
}): Promise<{ pool: PassageIdPoolResponse; cacheStatus: JsonCacheStatus }> {
  const cacheKey = passageIdsCacheKey({
    status,
    language_code: languageCode,
    factory_tag: factoryTag,
  });
  const cached = await readJsonCacheResult<PassageIdPoolResponse>(cacheKey);
  if (cached.value) {
    return { pool: cached.value, cacheStatus: "HIT" };
  }

  const whereConditions = [];
  if (status !== undefined) {
    whereConditions.push(eq(passages.status, status));
  }
  if (languageCode !== undefined) {
    whereConditions.push(eq(passages.languageCode, languageCode));
  }
  if (factoryTag !== undefined) {
    whereConditions.push(eq(passages.factoryTag, factoryTag));
  }
  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const rows = await db
    .select({
      id: passages.id,
      updatedAt: passages.updatedAt,
    })
    .from(passages)
    .where(whereClause)
    .orderBy(asc(passages.id));

  const latestUpdatedAt = rows.reduce<string | null>((latest, row) => {
    const current = row.updatedAt.toISOString();
    return latest === null || current > latest ? current : latest;
  }, null);
  const pool = {
    ids: rows.map((row) => row.id),
    total: rows.length,
    version: `${rows.length}:${latestUpdatedAt ?? "empty"}`,
    factory_tag: factoryTag ?? null,
  };

  await writeJsonCache({
    key: cacheKey,
    value: pool,
    ttlSeconds: passageCacheTtls.idsSeconds,
  });

  return { pool, cacheStatus: cached.status === "BYPASS" ? "BYPASS" : "MISS" };
}

async function fetchPassageDetailResponsesFromDb({
  ids,
  includeAnswerKey,
}: {
  ids: string[];
  includeAnswerKey: boolean;
}) {
  const dedupedIds = uniqueIds(ids);
  if (dedupedIds.length === 0) {
    return new Map<string, PassageDetailResponse>();
  }

  const [passageRows, questionRows, answerRows] = await Promise.all([
    db.select().from(passages).where(inArray(passages.id, dedupedIds)),
    db
      .select()
      .from(questions)
      .where(inArray(questions.passageId, dedupedIds))
      .orderBy(asc(questions.passageId), asc(questions.orderIndex)),
    includeAnswerKey
      ? db
          .select({
            passageId: questions.passageId,
            questionId: questions.id,
            sourceQuestionId: questions.sourceQuestionId,
            prompt: questions.prompt,
            answerType: answerKeys.answerType,
            answerValue: answerKeys.answerValue,
            acceptedValuesJson: answerKeys.acceptedValuesJson,
            explanation: answerKeys.explanation,
            evidenceJson: answerKeys.evidenceJson,
          })
          .from(answerKeys)
          .innerJoin(questions, eq(answerKeys.questionId, questions.id))
          .where(inArray(questions.passageId, dedupedIds))
          .orderBy(asc(questions.passageId), asc(questions.orderIndex))
      : Promise.resolve([] as AnswerKeyJoinRow[]),
  ]);

  const questionsByPassageId = new Map<string, Question[]>();
  for (const question of questionRows) {
    const current = questionsByPassageId.get(question.passageId) ?? [];
    current.push(question);
    questionsByPassageId.set(question.passageId, current);
  }

  const answersByPassageId = new Map<string, AnswerKeyJoinRow[]>();
  for (const answer of answerRows) {
    const current = answersByPassageId.get(answer.passageId) ?? [];
    current.push(answer);
    answersByPassageId.set(answer.passageId, current);
  }

  const responsesById = new Map<string, PassageDetailResponse>();
  for (const row of passageRows) {
    responsesById.set(
      row.id,
      buildPassageDetailResponse({
        row,
        questionRows: questionsByPassageId.get(row.id) ?? [],
        answerRows: answersByPassageId.get(row.id) ?? [],
        includeAnswerKey,
      }),
    );
  }

  return responsesById;
}

async function fetchPassageDetailResponsesByIds({
  ids,
  includeAnswerKey,
}: {
  ids: string[];
  includeAnswerKey: boolean;
}) {
  const dedupedIds = uniqueIds(ids);
  const cachedResults = await Promise.all(
    dedupedIds.map(async (id) => ({
      id,
      result: await readJsonCacheResult<PassageDetailResponse>(
        passageDetailCacheKey({ id, includeAnswerKey }),
      ),
    })),
  );

  const responsesById = new Map<string, PassageDetailResponse>();
  const missingIds: string[] = [];
  let cacheStatus: JsonCacheStatus = "HIT";

  for (const { id, result } of cachedResults) {
    if (result.value) {
      responsesById.set(id, result.value);
      continue;
    }
    missingIds.push(id);
    cacheStatus = result.status === "BYPASS" ? "BYPASS" : "MISS";
  }

  if (missingIds.length > 0) {
    const fetchedById = await fetchPassageDetailResponsesFromDb({
      ids: missingIds,
      includeAnswerKey,
    });

    await Promise.all(
      [...fetchedById.entries()].map(([id, response]) =>
        writeJsonCache({
          key: passageDetailCacheKey({ id, includeAnswerKey }),
          value: response,
          ttlSeconds: passageCacheTtls.detailSeconds,
        }),
      ),
    );

    for (const [id, response] of fetchedById) {
      responsesById.set(id, response);
    }
  }

  return {
    responses: dedupedIds
      .map((id) => responsesById.get(id))
      .filter((response): response is PassageDetailResponse => Boolean(response)),
    cacheStatus,
  };
}

router.get("/passages", async (req, res) => {
  const bandIndexRaw = firstValue(req.query.band_index);
  const questionSetTypeRaw = firstValue(req.query.question_set_type_index);
  const questionTypeRaw = firstValue(req.query.question_type_index);
  const topicIndex = firstValue(req.query.topic_index);
  const status = firstValue(req.query.status);
  const languageCode = firstValue(req.query.language_code);
  const factoryTagRaw = firstValue(req.query.factory_tag);
  const ids = firstValue(req.query.ids);
  const titleContainsRaw = firstValue(req.query.title_contains);
  const titleContains =
    titleContainsRaw && titleContainsRaw.trim().length > 0
      ? titleContainsRaw.trim()
      : undefined;
  const limitRaw = firstValue(req.query.limit);
  const offsetRaw = firstValue(req.query.offset);

  const bandIndex = parseOptionalInteger(bandIndexRaw);
  const factoryTag = parseFactoryTag(factoryTagRaw);
  const parsedLimit = parseOptionalInteger(limitRaw);
  const parsedOffset = parseOptionalInteger(offsetRaw);
  const limit = parsedLimit ?? DEFAULT_LIST_LIMIT;
  const offset = parsedOffset ?? 0;

  if (
    bandIndex === null ||
    factoryTag === null ||
    parsedLimit === null ||
    parsedOffset === null ||
    limit <= 0 ||
    limit > MAX_LIST_LIMIT ||
    offset < 0
  ) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  if (questionSetTypeRaw && !questionSetTypeSet.has(questionSetTypeRaw)) {
    res.status(400).json({
      error: `question_set_type_index must be one of: ${QUESTION_SET_TYPE_VALUES.join(", ")}`,
    });
    return;
  }
  if (questionTypeRaw && !questionTypeSet.has(questionTypeRaw)) {
    res.status(400).json({
      error: `question_type_index must be one of: ${QUESTION_TYPE_VALUES.join(", ")}`,
    });
    return;
  }

  const idsList = ids
    ?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  const listCacheKey = passagesListCacheKey({
    band_index: bandIndex,
    question_set_type_index: questionSetTypeRaw,
    question_type_index: questionTypeRaw,
    factory_tag: factoryTag,
    topic_index: topicIndex,
    status,
    language_code: languageCode,
    ids: idsList?.join(","),
    title_contains: titleContains,
    limit,
    offset,
  });
  const cachedListResponse = await readJsonCacheResult<{
    items: PassageListItemResponse[];
    pagination: {
      limit: number;
      offset: number;
      count: number;
    };
  }>(listCacheKey);

  if (cachedListResponse.value) {
    res.setHeader("x-cache", "HIT");
    res.json(cachedListResponse.value);
    return;
  }

  if (titleContains !== undefined) {
    const searchResult = await searchPassageCatalog({
      titleContains,
      bandIndex: bandIndex ?? undefined,
      questionSetTypeIndex: questionSetTypeRaw,
      questionTypeIndex: questionTypeRaw,
      topicIndex,
      status,
      languageCode,
      factoryTag: factoryTag ?? undefined,
      idsList,
      limit,
      offset,
    });

    if (!searchResult.items) {
      res
        .status(503)
        .json({ error: "Search index is warming up. Please try again in a moment." });
      return;
    }

    const listResponse = {
      items: searchResult.items,
      pagination: {
        limit,
        offset,
        count: searchResult.items.length,
        total: searchResult.total,
      },
    };

    res.setHeader(
      "x-cache",
      searchResult.cacheStatus === "BYPASS" ? "BYPASS" : "MISS",
    );
    res.setHeader("x-search-source", "cache-catalog");
    res.json(listResponse);
    await writeJsonCache({
      key: listCacheKey,
      value: listResponse,
      ttlSeconds: passageCacheTtls.listSeconds,
    });
    return;
  }

  const whereConditions = [];

  if (bandIndex !== undefined) {
    whereConditions.push(eq(passages.bandIndex, bandIndex));
  }
  if (questionSetTypeRaw !== undefined) {
    whereConditions.push(
      eq(passages.questionSetTypeIndex, questionSetTypeRaw),
    );
  }
  if (questionTypeRaw !== undefined) {
    whereConditions.push(
      inArray(
        passages.id,
        db
          .select({ passageId: questions.passageId })
          .from(questions)
          .where(eq(questions.questionTypeIndex, questionTypeRaw)),
      ),
    );
  }
  if (topicIndex !== undefined) {
    whereConditions.push(eq(passages.topicIndex, topicIndex));
  }
  if (status !== undefined) {
    whereConditions.push(eq(passages.status, status));
  }
  if (languageCode !== undefined) {
    whereConditions.push(eq(passages.languageCode, languageCode));
  }
  if (factoryTag !== undefined) {
    whereConditions.push(eq(passages.factoryTag, factoryTag));
  }
  if (idsList && idsList.length > 0) {
    whereConditions.push(inArray(passages.id, idsList));
  }
  if (titleContains !== undefined) {
    whereConditions.push(
      ilike(passages.title, `%${escapeLikePattern(titleContains)}%`),
    );
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

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
      questionCount: db.$count(questions, eq(questions.passageId, passages.id)),
    })
    .from(passages)
    .where(whereClause)
    .orderBy(asc(passages.bandIndex), asc(passages.title), asc(passages.id))
    .limit(limit)
    .offset(offset);

  const listResponse = {
    items: rows.map((row) => toPassageListItemResponse(row)),
    pagination: {
      limit,
      offset,
      count: rows.length,
      total: rows.length,
    },
  };

  res.setHeader(
    "x-cache",
    cachedListResponse.status === "BYPASS" ? "BYPASS" : "MISS",
  );
  res.json(listResponse);
  await writeJsonCache({
    key: listCacheKey,
    value: listResponse,
    ttlSeconds: passageCacheTtls.listSeconds,
  });
});

router.get("/passages/ids", async (req, res) => {
  const status = firstValue(req.query.status) ?? "active";
  const languageCode = firstValue(req.query.language_code);
  const factoryTag = parseFactoryTag(firstValue(req.query.factory_tag));
  if (factoryTag === null) {
    res.status(400).json({ error: "Invalid factory_tag" });
    return;
  }
  const { pool, cacheStatus } = await fetchPassageIdPool({
    status,
    languageCode,
    factoryTag,
  });

  res.setHeader("x-cache", cacheStatus);
  res.json({
    ids: pool.ids,
    total: pool.total,
    version: pool.version,
    status,
    language_code: languageCode ?? null,
    factory_tag: pool.factory_tag,
  });
});

router.get("/passages/feed-bootstrap", async (req, res) => {
  const status = firstValue(req.query.status) ?? "active";
  const languageCode = firstValue(req.query.language_code);
  const factoryTag = parseFactoryTag(firstValue(req.query.factory_tag));
  const includeAnswerKey = includeAnswerKeyFromQuery(
    firstValue(req.query.include_answer_key),
  );
  const limit = parseBoundedLimit({
    raw: firstValue(req.query.limit),
    fallback: DEFAULT_FEED_BOOTSTRAP_LIMIT,
    max: MAX_FEED_BOOTSTRAP_LIMIT,
  });

  if (limit === null || factoryTag === null) {
    res.status(400).json({
      error:
        factoryTag === null
          ? "Invalid factory_tag"
          : `limit must be between 1 and ${MAX_FEED_BOOTSTRAP_LIMIT}`,
    });
    return;
  }

  const { pool, cacheStatus: idPoolCacheStatus } = await fetchPassageIdPool({
    status,
    languageCode,
    factoryTag,
  });
  const selectedIds = sampleIds(pool.ids, limit);
  const detailResult = await fetchPassageDetailResponsesByIds({
    ids: selectedIds,
    includeAnswerKey,
  });

  res.setHeader("x-cache-id-pool", idPoolCacheStatus);
  res.setHeader("x-cache-details", detailResult.cacheStatus);
  res.json({
    random_passages: detailResult.responses,
    selected_ids: detailResult.responses.map((passage) => passage.id),
    all_passage_ids: pool.ids,
    total: pool.total,
    version: pool.version,
    factory_tag: pool.factory_tag,
  });
});

router.get("/passages/:id", async (req, res) => {
  const passageId = req.params.id?.trim();
  if (!passageId) {
    res.status(400).json({ error: "Invalid passage id" });
    return;
  }

  const includeAnswerKey = includeAnswerKeyFromQuery(
    firstValue(req.query.include_answer_key),
  );
  const cachedDetailResponse = await readJsonCacheResult<PassageDetailResponse>(
    passageDetailCacheKey({
      id: passageId,
      includeAnswerKey,
    }),
  );
  if (cachedDetailResponse.value) {
    res.setHeader("x-cache", "HIT");
    res.json(cachedDetailResponse.value);
    return;
  }

  const detailResult = await fetchPassageDetailResponsesFromDb({
    ids: [passageId],
    includeAnswerKey,
  });
  const detailResponse = detailResult.get(passageId);
  if (!detailResponse) {
    res.status(404).json({ error: "Passage not found" });
    return;
  }

  res.setHeader(
    "x-cache",
    cachedDetailResponse.status === "BYPASS" ? "BYPASS" : "MISS",
  );
  res.json(detailResponse);
  await writeJsonCache({
    key: passageDetailCacheKey({ id: passageId, includeAnswerKey }),
    value: detailResponse,
    ttlSeconds: passageCacheTtls.detailSeconds,
  });
});

router.post("/passages/:id/report", async (req, res) => {
  const passageId = req.params.id?.trim();
  if (!passageId) {
    res.status(400).json({ error: "Invalid passage id" });
    return;
  }

  const reportTypeRaw =
    typeof req.body?.reportType === "string" ? req.body.reportType.trim() : "";

  if (!reportTypeSet.has(reportTypeRaw)) {
    res.status(400).json({
      error: `reportType must be one of: ${REPORT_TYPE_VALUES.join(", ")}`,
    });
    return;
  }

  try {
    await db
      .insert(passageReportCounts)
      .values({
        passageId,
        reportType: reportTypeRaw,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [passageReportCounts.passageId, passageReportCounts.reportType],
        set: {
          count: sql`${passageReportCounts.count} + 1`,
          updatedAt: sql`now()`,
        },
      });
  } catch (error) {
    const maybePgError = error as { code?: string } | undefined;
    if (maybePgError?.code === "23503") {
      res.status(404).json({ error: "Passage not found" });
      return;
    }
    res.status(500).json({ error: "Failed to submit report" });
    return;
  }

  const counts = await db
    .select({
      reportType: passageReportCounts.reportType,
      count: passageReportCounts.count,
    })
    .from(passageReportCounts)
    .where(eq(passageReportCounts.passageId, passageId))
    .orderBy(asc(passageReportCounts.reportType));

  res.status(201).json({
    ok: true,
    passage_id: passageId,
    report_type: reportTypeRaw,
    aggregates: counts.map((item) => ({
      report_type: item.reportType,
      count: item.count,
    })),
  });
});

export default router;
