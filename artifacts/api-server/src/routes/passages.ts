import { Router, type IRouter } from "express";
import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import {
  QUESTION_TYPE_VALUES,
  QUESTION_SET_TYPE_VALUES,
  answerKeys,
  db,
  passages,
  questions,
} from "@workspace/db";
import {
  passageDetailCacheKey,
  passagesListCacheKey,
} from "../lib/cache/cache-keys";
import {
  passageCacheTtls,
  readJsonCache,
  writeJsonCache,
} from "../lib/cache/json-cache";

const router: IRouter = Router();

const questionSetTypeSet: Set<string> = new Set(QUESTION_SET_TYPE_VALUES);
const questionTypeSet: Set<string> = new Set(QUESTION_TYPE_VALUES);

function firstValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }

  return typeof value === "string" ? value : undefined;
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
const MAX_LIST_LIMIT = 500;

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

router.get("/passages", async (req, res) => {
  const bandIndexRaw = firstValue(req.query.band_index);
  const questionSetTypeRaw = firstValue(req.query.question_set_type_index);
  const questionTypeRaw = firstValue(req.query.question_type_index);
  const topicIndex = firstValue(req.query.topic_index);
  const status = firstValue(req.query.status);
  const languageCode = firstValue(req.query.language_code);
  const ids = firstValue(req.query.ids);
  const titleContainsRaw = firstValue(req.query.title_contains);
  const titleContains =
    titleContainsRaw && titleContainsRaw.trim().length > 0
      ? titleContainsRaw.trim()
      : undefined;
  const limitRaw = firstValue(req.query.limit);
  const offsetRaw = firstValue(req.query.offset);

  const bandIndex = parseOptionalInteger(bandIndexRaw);
  const parsedLimit = parseOptionalInteger(limitRaw);
  const parsedOffset = parseOptionalInteger(offsetRaw);
  const limit = parsedLimit ?? DEFAULT_LIST_LIMIT;
  const offset = parsedOffset ?? 0;

  if (
    bandIndex === null ||
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
    topic_index: topicIndex,
    status,
    language_code: languageCode,
    ids: idsList?.join(","),
    title_contains: titleContains,
    limit,
    offset,
  });
  const cachedListResponse = await readJsonCache<{
    items: Array<{
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
      language_code: string;
      status: string;
      question_count: number;
    }>;
    pagination: {
      limit: number;
      offset: number;
      count: number;
    };
  }>(listCacheKey);

  if (cachedListResponse) {
    res.setHeader("x-cache", "HIT");
    res.json(cachedListResponse);
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
    items: rows.map((row) => ({
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
      language_code: row.languageCode,
      status: row.status,
      question_count: row.questionCount,
    })),
    pagination: {
      limit,
      offset,
      count: rows.length,
    },
  };

  res.setHeader("x-cache", "MISS");
  res.json(listResponse);
  await writeJsonCache({
    key: listCacheKey,
    value: listResponse,
    ttlSeconds: passageCacheTtls.listSeconds,
  });
});

router.get("/passages/:id", async (req, res) => {
  const passageId = req.params.id?.trim();
  if (!passageId) {
    res.status(400).json({ error: "Invalid passage id" });
    return;
  }

  const includeAnswerKey = firstValue(req.query.include_answer_key) !== "false";
  const detailCacheKey = passageDetailCacheKey({
    id: passageId,
    includeAnswerKey,
  });
  const cachedDetailResponse = await readJsonCache<Record<string, unknown>>(
    detailCacheKey,
  );
  if (cachedDetailResponse) {
    res.setHeader("x-cache", "HIT");
    res.json(cachedDetailResponse);
    return;
  }

  const passageRow = await db
    .select()
    .from(passages)
    .where(eq(passages.id, passageId))
    .limit(1);

  if (passageRow.length === 0) {
    res.status(404).json({ error: "Passage not found" });
    return;
  }

  const questionRows = await db
    .select()
    .from(questions)
    .where(eq(questions.passageId, passageId))
    .orderBy(asc(questions.orderIndex));

  const answerRows = includeAnswerKey
    ? await db
        .select({
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
        .where(eq(questions.passageId, passageId))
        .orderBy(asc(questions.orderIndex))
    : [];

  const row = passageRow[0];
  const passageSentences = splitPassageIntoSentences(row.passage);
  const vocab = parseVocabJson(row.vocabJson, passageSentences.length);

  const detailResponse = {
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
              answer.answerValue.trim().toUpperCase() === "NOT GIVEN" ? [] : evidence,
          };
        })
      : [],
  };

  res.setHeader("x-cache", "MISS");
  res.json(detailResponse);
  await writeJsonCache({
    key: detailCacheKey,
    value: detailResponse,
    ttlSeconds: passageCacheTtls.detailSeconds,
  });
});

export default router;
