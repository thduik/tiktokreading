import { Router, type IRouter } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  QUESTION_SET_TYPE_VALUES,
  answerKeys,
  db,
  passages,
  questions,
} from "@workspace/db";

const router: IRouter = Router();

const questionSetTypeSet: Set<string> = new Set(QUESTION_SET_TYPE_VALUES);

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

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;

router.get("/passages", async (req, res) => {
  const bandIndexRaw = firstValue(req.query.band_index);
  const questionSetTypeRaw = firstValue(req.query.question_set_type_index);
  const topicIndex = firstValue(req.query.topic_index);
  const status = firstValue(req.query.status);
  const languageCode = firstValue(req.query.language_code);
  const ids = firstValue(req.query.ids);
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

  const idsList = ids
    ?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  const whereConditions = [];

  if (bandIndex !== undefined) {
    whereConditions.push(eq(passages.bandIndex, bandIndex));
  }
  if (questionSetTypeRaw !== undefined) {
    whereConditions.push(
      eq(passages.questionSetTypeIndex, questionSetTypeRaw),
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
      questionCount: sql<number>`(SELECT COUNT(*)::int FROM questions q WHERE q.passage_id = ${passages.id})`,
    })
    .from(passages)
    .where(whereClause)
    .orderBy(asc(passages.bandIndex), asc(passages.title), asc(passages.id))
    .limit(limit)
    .offset(offset);

  res.json({
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
  });
});

router.get("/passages/:id", async (req, res) => {
  const passageId = req.params.id?.trim();
  if (!passageId) {
    res.status(400).json({ error: "Invalid passage id" });
    return;
  }

  const includeAnswerKey = firstValue(req.query.include_answer_key) !== "false";

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
          answerType: answerKeys.answerType,
          answerValue: answerKeys.answerValue,
          acceptedValuesJson: answerKeys.acceptedValuesJson,
          explanation: answerKeys.explanation,
        })
        .from(answerKeys)
        .innerJoin(questions, eq(answerKeys.questionId, questions.id))
        .where(eq(questions.passageId, passageId))
        .orderBy(asc(questions.orderIndex))
    : [];

  const row = passageRow[0];

  res.json({
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
    questions: questionRows.map((question) => ({
      id: question.sourceQuestionId,
      order_index: question.orderIndex,
      question_type_index: question.questionTypeIndex,
      question_type_label: question.questionTypeLabel,
      prompt: question.prompt,
      payload: question.questionPayloadJson,
    })),
    answer_key: includeAnswerKey
      ? answerRows.map((answer) => ({
          question_id: answer.sourceQuestionId,
          answer_type: answer.answerType,
          answer_value: answer.answerValue,
          accepted_values: answer.acceptedValuesJson,
          explanation: answer.explanation,
        }))
      : [],
  });
});

export default router;
