import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANSWER_TYPE_VALUES,
  type PassageVocabItem,
  QUESTION_SET_TYPE_VALUES,
  QUESTION_TYPE_VALUES,
  answerKeys,
  db,
  passages,
  questions,
} from "../index";
import { generatePassageVocab, splitPassageIntoSentences } from "./vocab-utils";

type QuestionSetType = (typeof QUESTION_SET_TYPE_VALUES)[number];
type QuestionType = (typeof QUESTION_TYPE_VALUES)[number];
type AnswerType = (typeof ANSWER_TYPE_VALUES)[number];

type JsonObject = Record<string, unknown>;

interface SourceQuestion {
  id: number;
  order_index: number;
  question_type_index: QuestionType;
  question_type_label: string;
  prompt: string;
  payload?: JsonObject;
}

interface SourceAnswerKey {
  question_id: number;
  answer_type: AnswerType;
  answer_value: string;
  accepted_values?: string[];
  explanation: string;
  evidence: SourceEvidence[];
}

interface SourceEvidence {
  sentence_index: number;
  evidence_type: string;
  highlight_text?: string;
  explanation_role?: string;
}

interface SourcePassage {
  id: string;
  schema_version: string;
  exam_index: string;
  exam_label: string;
  band_index: number;
  band_label: string;
  question_set_type_index: QuestionSetType;
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
  questions: SourceQuestion[];
  answer_key: SourceAnswerKey[];
}

type IngestAnomaly = {
  cardId: string;
  title: string;
  questionId: number;
  kind:
    | "answer_value_normalized"
    | "accepted_value_normalized"
    | "answer_type_mismatch";
  before: string;
  after: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toKeywordTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function deriveFallbackEvidence(
  passageSentences: string[],
  prompt: string,
  answerValue: string,
  explanation: string,
): SourceEvidence[] {
  const normalizedAnswer = answerValue.trim().toUpperCase();
  if (normalizedAnswer === "NOT GIVEN") {
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
    const sentence = passageSentences[index].toLowerCase();
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
      sentence_index: bestIndex + 1,
      evidence_type: "support",
      explanation_role: "context_match",
    },
  ];
}

function toSingleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripLeadingQuestionNumber(value: string) {
  return toSingleLine(value.replace(/^\s*\d+\s*[.)]\s*/g, ""));
}

function canonicalizeTfngLabel(value: string) {
  const stripped = stripLeadingQuestionNumber(value)
    .replace(/[-_]/g, " ")
    .toUpperCase();
  const compact = stripped.replace(/\s+/g, " ").trim();
  if (compact === "TRUE") return "TRUE";
  if (compact === "FALSE") return "FALSE";
  if (compact === "NOT GIVEN" || compact === "NOTGIVEN") return "NOT GIVEN";
  return compact;
}

function canonicalizeOptionKey(value: string) {
  const stripped = stripLeadingQuestionNumber(value).toUpperCase();
  const match = stripped.match(/^([A-Z])/);
  if (!match) {
    return stripped;
  }
  return match[1];
}

function canonicalizeTextAnswer(value: string) {
  return stripLeadingQuestionNumber(value);
}

function expectedAnswerType(questionTypeIndex: QuestionType): AnswerType {
  if (questionTypeIndex === "tfng") return "label";
  if (questionTypeIndex === "mcq") return "option_key";
  return "text";
}

function deriveFallbackExampleSentence(
  passageSentences: string[],
  term: string,
  sentenceIndex?: number,
) {
  if (
    sentenceIndex !== undefined &&
    sentenceIndex >= 1 &&
    sentenceIndex <= passageSentences.length
  ) {
    return toSingleLine(passageSentences[sentenceIndex - 1]);
  }

  const normalizedTerm = term.trim().toLowerCase();
  const match = passageSentences.find((sentence) =>
    sentence.toLowerCase().includes(normalizedTerm),
  );
  if (match) {
    return toSingleLine(match);
  }

  return `${term} is an important phrase in this passage.`;
}

function parseSourceCards(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }

  if (isObject(input) && Array.isArray(input.cards)) {
    return input.cards;
  }

  throw new Error(
    "JSON payload must be either an array of cards or an object containing a cards array.",
  );
}

function asString(value: unknown, field: string, errors: string[]): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string.`);
    return "";
  }

  return value;
}

function asInteger(value: unknown, field: string, errors: string[]): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(`${field} must be an integer.`);
    return 0;
  }

  return value;
}

function parseSourceCard(
  rawCard: unknown,
  cardIndex: number,
  anomalies: IngestAnomaly[],
): SourcePassage {
  const errors: string[] = [];

  if (!isObject(rawCard)) {
    throw new Error(`Card at index ${cardIndex} must be an object.`);
  }

  const cardId = asString(rawCard.id, `card[${cardIndex}].id`, errors);
  const schemaVersion = asString(
    rawCard.schema_version,
    `card[${cardIndex}].schema_version`,
    errors,
  );
  const examIndex = asString(
    rawCard.exam_index,
    `card[${cardIndex}].exam_index`,
    errors,
  );
  const examLabel = asString(
    rawCard.exam_label,
    `card[${cardIndex}].exam_label`,
    errors,
  );
  const bandIndex = asInteger(
    rawCard.band_index,
    `card[${cardIndex}].band_index`,
    errors,
  );
  const bandLabel = asString(
    rawCard.band_label,
    `card[${cardIndex}].band_label`,
    errors,
  );
  const questionSetTypeIndex = asString(
    rawCard.question_set_type_index,
    `card[${cardIndex}].question_set_type_index`,
    errors,
  );
  const questionSetTypeLabel = asString(
    rawCard.question_set_type_label,
    `card[${cardIndex}].question_set_type_label`,
    errors,
  );
  const topicIndex = asString(
    rawCard.topic_index,
    `card[${cardIndex}].topic_index`,
    errors,
  );
  const topicLabel = asString(
    rawCard.topic_label,
    `card[${cardIndex}].topic_label`,
    errors,
  );
  const title = asString(rawCard.title, `card[${cardIndex}].title`, errors);
  const languageCode = asString(
    rawCard.language_code,
    `card[${cardIndex}].language_code`,
    errors,
  );
  const status = asString(rawCard.status, `card[${cardIndex}].status`, errors);
  const passage = asString(rawCard.passage, `card[${cardIndex}].passage`, errors);

  if (
    !QUESTION_SET_TYPE_VALUES.includes(
      questionSetTypeIndex as (typeof QUESTION_SET_TYPE_VALUES)[number],
    )
  ) {
    errors.push(
      `card[${cardIndex}].question_set_type_index must be one of: ${QUESTION_SET_TYPE_VALUES.join(", ")}.`,
    );
  }

  const passageMetaRaw = rawCard.passage_meta;
  if (!isObject(passageMetaRaw)) {
    errors.push(`card[${cardIndex}].passage_meta must be an object.`);
  }

  const questionsRaw = rawCard.questions;
  if (!Array.isArray(questionsRaw)) {
    errors.push(`card[${cardIndex}].questions must be an array.`);
  }

  const answerKeyRaw = rawCard.answer_key;
  if (!Array.isArray(answerKeyRaw)) {
    errors.push(`card[${cardIndex}].answer_key must be an array.`);
  }
  const vocabRaw = rawCard.vocab;
  if (vocabRaw !== undefined && !Array.isArray(vocabRaw)) {
    errors.push(`card[${cardIndex}].vocab must be an array if provided.`);
  }

  const sentenceCount = asInteger(
    isObject(passageMetaRaw) ? passageMetaRaw.sentence_count : undefined,
    `card[${cardIndex}].passage_meta.sentence_count`,
    errors,
  );
  const wordCount = asInteger(
    isObject(passageMetaRaw) ? passageMetaRaw.word_count : undefined,
    `card[${cardIndex}].passage_meta.word_count`,
    errors,
  );

  const questionsList: SourceQuestion[] = Array.isArray(questionsRaw)
    ? questionsRaw.map((rawQuestion, questionIndex) => {
        if (!isObject(rawQuestion)) {
          errors.push(
            `card[${cardIndex}].questions[${questionIndex}] must be an object.`,
          );
          return {
            id: 0,
            order_index: 0,
            question_type_index: "tfng",
            question_type_label: "",
            prompt: "",
            payload: {},
          };
        }

        const questionTypeIndex = asString(
          rawQuestion.question_type_index,
          `card[${cardIndex}].questions[${questionIndex}].question_type_index`,
          errors,
        );

        if (
          !QUESTION_TYPE_VALUES.includes(
            questionTypeIndex as (typeof QUESTION_TYPE_VALUES)[number],
          )
        ) {
          errors.push(
            `card[${cardIndex}].questions[${questionIndex}].question_type_index must be one of: ${QUESTION_TYPE_VALUES.join(", ")}.`,
          );
        }

        const payload = rawQuestion.payload;
        if (payload !== undefined && !isObject(payload)) {
          errors.push(
            `card[${cardIndex}].questions[${questionIndex}].payload must be an object if provided.`,
          );
        }

        return {
          id: asInteger(
            rawQuestion.id,
            `card[${cardIndex}].questions[${questionIndex}].id`,
            errors,
          ),
          order_index: asInteger(
            rawQuestion.order_index,
            `card[${cardIndex}].questions[${questionIndex}].order_index`,
            errors,
          ),
          question_type_index: questionTypeIndex as QuestionType,
          question_type_label: asString(
            rawQuestion.question_type_label,
            `card[${cardIndex}].questions[${questionIndex}].question_type_label`,
            errors,
          ),
          prompt: asString(
            rawQuestion.prompt,
            `card[${cardIndex}].questions[${questionIndex}].prompt`,
            errors,
          ),
          payload: (payload as JsonObject | undefined) ?? {},
        };
      })
    : [];

  const answerKeyList: SourceAnswerKey[] = Array.isArray(answerKeyRaw)
    ? answerKeyRaw.map((rawAnswer, answerIndex) => {
        if (!isObject(rawAnswer)) {
          errors.push(
            `card[${cardIndex}].answer_key[${answerIndex}] must be an object.`,
          );
          return {
            question_id: 0,
            answer_type: "text",
            answer_value: "",
            explanation: "",
            evidence: [],
          };
        }

        const answerType = asString(
          rawAnswer.answer_type,
          `card[${cardIndex}].answer_key[${answerIndex}].answer_type`,
          errors,
        );

        if (
          !ANSWER_TYPE_VALUES.includes(
            answerType as (typeof ANSWER_TYPE_VALUES)[number],
          )
        ) {
          errors.push(
            `card[${cardIndex}].answer_key[${answerIndex}].answer_type must be one of: ${ANSWER_TYPE_VALUES.join(", ")}.`,
          );
        }

        const acceptedValues = rawAnswer.accepted_values;
        if (
          acceptedValues !== undefined &&
          (!Array.isArray(acceptedValues) ||
            acceptedValues.some((value) => typeof value !== "string"))
        ) {
          errors.push(
            `card[${cardIndex}].answer_key[${answerIndex}].accepted_values must be an array of strings if provided.`,
          );
        }

        const rawEvidence = rawAnswer.evidence;
        if (rawEvidence !== undefined && !Array.isArray(rawEvidence)) {
          errors.push(
            `card[${cardIndex}].answer_key[${answerIndex}].evidence must be an array if provided.`,
          );
        }

        const parsedEvidence: SourceEvidence[] = [];
        if (Array.isArray(rawEvidence)) {
          for (let evidenceIndex = 0; evidenceIndex < rawEvidence.length; evidenceIndex += 1) {
            const entry = rawEvidence[evidenceIndex];
            if (!isObject(entry)) {
              errors.push(
                `card[${cardIndex}].answer_key[${answerIndex}].evidence[${evidenceIndex}] must be an object.`,
              );
              continue;
            }

            const sentenceIndexRaw =
              typeof entry.sentence_index === "number"
                ? entry.sentence_index
                : typeof entry.sentence_id === "string"
                  ? Number(entry.sentence_id.replace(/^s/i, ""))
                  : undefined;

            if (
              typeof sentenceIndexRaw !== "number" ||
              !Number.isInteger(sentenceIndexRaw)
            ) {
              errors.push(
                `card[${cardIndex}].answer_key[${answerIndex}].evidence[${evidenceIndex}].sentence_index must be an integer.`,
              );
              continue;
            }

            const evidenceType = asString(
              entry.evidence_type,
              `card[${cardIndex}].answer_key[${answerIndex}].evidence[${evidenceIndex}].evidence_type`,
              errors,
            );

            const highlightText =
              typeof entry.highlight_text === "string"
                ? entry.highlight_text
                : undefined;
            const explanationRole =
              typeof entry.explanation_role === "string"
                ? entry.explanation_role
                : undefined;

            parsedEvidence.push({
              sentence_index: sentenceIndexRaw,
              evidence_type: evidenceType,
              highlight_text: highlightText,
              explanation_role: explanationRole,
            });
          }
        }

        return {
          question_id: asInteger(
            rawAnswer.question_id,
            `card[${cardIndex}].answer_key[${answerIndex}].question_id`,
            errors,
          ),
          answer_type: answerType as AnswerType,
          answer_value: asString(
            rawAnswer.answer_value,
            `card[${cardIndex}].answer_key[${answerIndex}].answer_value`,
            errors,
          ),
          accepted_values: (acceptedValues as string[] | undefined) ?? undefined,
          explanation: asString(
            rawAnswer.explanation,
            `card[${cardIndex}].answer_key[${answerIndex}].explanation`,
            errors,
          ),
          evidence: parsedEvidence,
        };
      })
    : [];

  const vocabList: PassageVocabItem[] = Array.isArray(vocabRaw)
    ? vocabRaw.map((rawVocabItem, vocabIndex) => {
        if (!isObject(rawVocabItem)) {
          errors.push(`card[${cardIndex}].vocab[${vocabIndex}] must be an object.`);
          return {
            term: "",
            definition: "",
          };
        }

        const term = asString(
          rawVocabItem.term,
          `card[${cardIndex}].vocab[${vocabIndex}].term`,
          errors,
        );
        const definition = asString(
          rawVocabItem.definition,
          `card[${cardIndex}].vocab[${vocabIndex}].definition`,
          errors,
        );

        const meaningViRaw = rawVocabItem.meaning_vi;
        if (meaningViRaw !== undefined && typeof meaningViRaw !== "string") {
          errors.push(
            `card[${cardIndex}].vocab[${vocabIndex}].meaning_vi must be a string if provided.`,
          );
        }
        const simpleMeaningEnRaw = rawVocabItem.simple_meaning_en;
        if (
          simpleMeaningEnRaw !== undefined &&
          typeof simpleMeaningEnRaw !== "string"
        ) {
          errors.push(
            `card[${cardIndex}].vocab[${vocabIndex}].simple_meaning_en must be a string if provided.`,
          );
        }
        const exampleSentenceEnRaw = rawVocabItem.example_sentence_en;
        if (
          exampleSentenceEnRaw !== undefined &&
          typeof exampleSentenceEnRaw !== "string"
        ) {
          errors.push(
            `card[${cardIndex}].vocab[${vocabIndex}].example_sentence_en must be a string if provided.`,
          );
        }

        const sentenceIndexRaw = rawVocabItem.sentence_index;
        if (
          sentenceIndexRaw !== undefined &&
          (typeof sentenceIndexRaw !== "number" || !Number.isInteger(sentenceIndexRaw))
        ) {
          errors.push(
            `card[${cardIndex}].vocab[${vocabIndex}].sentence_index must be an integer if provided.`,
          );
        }

        return {
          term,
          definition,
          simple_meaning_en:
            typeof simpleMeaningEnRaw === "string"
              ? simpleMeaningEnRaw
              : undefined,
          example_sentence_en:
            typeof exampleSentenceEnRaw === "string"
              ? exampleSentenceEnRaw
              : undefined,
          meaning_vi: typeof meaningViRaw === "string" ? meaningViRaw : undefined,
          sentence_index:
            typeof sentenceIndexRaw === "number" && Number.isInteger(sentenceIndexRaw)
              ? sentenceIndexRaw
              : undefined,
        };
      })
    : [];

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const questionIds = new Set<number>();
  const orderIndices = new Set<number>();
  for (const question of questionsList) {
    if (questionIds.has(question.id)) {
      errors.push(`card[${cardIndex}] has duplicate question id: ${question.id}.`);
    }
    if (orderIndices.has(question.order_index)) {
      errors.push(
        `card[${cardIndex}] has duplicate order_index: ${question.order_index}.`,
      );
    }
    questionIds.add(question.id);
    orderIndices.add(question.order_index);
  }

  const answerByQuestionId = new Map<number, SourceAnswerKey>();
  for (const answer of answerKeyList) {
    if (!questionIds.has(answer.question_id)) {
      errors.push(
        `card[${cardIndex}] answer_key references missing question_id=${answer.question_id}.`,
      );
    }
    if (answerByQuestionId.has(answer.question_id)) {
      errors.push(
        `card[${cardIndex}] has duplicate answer_key for question_id=${answer.question_id}.`,
      );
    }
    answerByQuestionId.set(answer.question_id, answer);
  }

  for (const question of questionsList) {
    const answer = answerByQuestionId.get(question.id);
    if (!answer) {
      errors.push(`card[${cardIndex}] missing answer for question_id=${question.id}.`);
      continue;
    }

    const expectedType = expectedAnswerType(question.question_type_index);
    if (answer.answer_type !== expectedType) {
      anomalies.push({
        cardId: cardId,
        title,
        questionId: question.id,
        kind: "answer_type_mismatch",
        before: answer.answer_type,
        after: expectedType,
      });
      answer.answer_type = expectedType;
    }

    const originalAnswerValue = answer.answer_value;
    let normalizedAnswerValue = originalAnswerValue;
    if (question.question_type_index === "tfng") {
      normalizedAnswerValue = canonicalizeTfngLabel(originalAnswerValue);
    } else if (question.question_type_index === "mcq") {
      normalizedAnswerValue = canonicalizeOptionKey(originalAnswerValue);
    } else {
      normalizedAnswerValue = canonicalizeTextAnswer(originalAnswerValue);
    }

    if (normalizedAnswerValue !== originalAnswerValue) {
      anomalies.push({
        cardId,
        title,
        questionId: question.id,
        kind: "answer_value_normalized",
        before: originalAnswerValue,
        after: normalizedAnswerValue,
      });
      answer.answer_value = normalizedAnswerValue;
    }

    if (Array.isArray(answer.accepted_values) && answer.accepted_values.length > 0) {
      const normalizedAcceptedValues = answer.accepted_values.map((value) => {
        if (question.question_type_index === "tfng") {
          return canonicalizeTfngLabel(value);
        }
        if (question.question_type_index === "mcq") {
          return canonicalizeOptionKey(value);
        }
        return canonicalizeTextAnswer(value);
      });

      for (let index = 0; index < answer.accepted_values.length; index += 1) {
        const originalAccepted = answer.accepted_values[index];
        const normalizedAccepted = normalizedAcceptedValues[index];
        if (originalAccepted !== normalizedAccepted) {
          anomalies.push({
            cardId,
            title,
            questionId: question.id,
            kind: "accepted_value_normalized",
            before: originalAccepted,
            after: normalizedAccepted,
          });
        }
      }

      answer.accepted_values = normalizedAcceptedValues;
    }
  }

  const passageSentences = splitPassageIntoSentences(passage);
  const effectiveSentenceCount = passageSentences.length;
  if (sentenceCount !== effectiveSentenceCount) {
    errors.push(
      `card[${cardIndex}].passage_meta.sentence_count=${sentenceCount} does not match parsed passage sentence count ${effectiveSentenceCount}.`,
    );
  }

  for (const question of questionsList) {
    const answer = answerByQuestionId.get(question.id);
    if (!answer) {
      continue;
    }

    const normalizedAnswer = answer.answer_value.trim().toUpperCase();
    if (answer.evidence.length === 0) {
      answer.evidence = deriveFallbackEvidence(
        passageSentences,
        question.prompt,
        answer.answer_value,
        answer.explanation,
      );
    }

    if (normalizedAnswer === "NOT GIVEN" && answer.evidence.length > 0) {
      errors.push(
        `card[${cardIndex}] question ${question.id} is NOT GIVEN and must not include evidence sentence references.`,
      );
    }

    for (const evidence of answer.evidence) {
      if (
        !Number.isInteger(evidence.sentence_index) ||
        evidence.sentence_index < 1 ||
        evidence.sentence_index > effectiveSentenceCount
      ) {
        errors.push(
          `card[${cardIndex}] question ${question.id} has evidence.sentence_index=${evidence.sentence_index}, but valid range is 1..${effectiveSentenceCount}.`,
        );
      }
    }
  }

  for (let vocabIndex = 0; vocabIndex < vocabList.length; vocabIndex += 1) {
    const vocabItem = vocabList[vocabIndex];
    if (
      vocabItem.sentence_index !== undefined &&
      (vocabItem.sentence_index < 1 ||
        vocabItem.sentence_index > effectiveSentenceCount)
    ) {
      errors.push(
        `card[${cardIndex}].vocab[${vocabIndex}].sentence_index=${vocabItem.sentence_index} is out of range 1..${effectiveSentenceCount}.`,
      );
    }

    if (!vocabItem.simple_meaning_en || vocabItem.simple_meaning_en.trim().length === 0) {
      vocabItem.simple_meaning_en = toSingleLine(vocabItem.definition);
    } else {
      vocabItem.simple_meaning_en = toSingleLine(vocabItem.simple_meaning_en);
    }

    if (
      !vocabItem.example_sentence_en ||
      vocabItem.example_sentence_en.trim().length === 0
    ) {
      vocabItem.example_sentence_en = deriveFallbackExampleSentence(
        passageSentences,
        vocabItem.term,
        vocabItem.sentence_index,
      );
    } else {
      vocabItem.example_sentence_en = toSingleLine(vocabItem.example_sentence_en);
    }

    if (vocabItem.example_sentence_en.length > 260) {
      vocabItem.example_sentence_en = `${vocabItem.example_sentence_en
        .slice(0, 257)
        .trimEnd()}...`;
    }
  }

  const distinctQuestionTypes = new Set(
    questionsList.map((question) => question.question_type_index),
  );

  if (questionSetTypeIndex === "mixed") {
    const requiredTypes: QuestionType[] = [
      "tfng",
      "mcq",
      "sentence_completion",
      "short_answer",
    ];
    for (const requiredType of requiredTypes) {
      if (!distinctQuestionTypes.has(requiredType)) {
        errors.push(
          `card[${cardIndex}] is mixed but is missing question type ${requiredType}.`,
        );
      }
    }
  } else {
    if (distinctQuestionTypes.size !== 1) {
      errors.push(
        `card[${cardIndex}] must contain only one question type because question_set_type_index=${questionSetTypeIndex}.`,
      );
    }
    if (!distinctQuestionTypes.has(questionSetTypeIndex as QuestionType)) {
      errors.push(
        `card[${cardIndex}] question_set_type_index=${questionSetTypeIndex} does not match question.question_type_index.`,
      );
    }
  }

  if (answerKeyList.length !== questionsList.length) {
    errors.push(
      `card[${cardIndex}] question and answer counts differ (${questionsList.length} questions vs ${answerKeyList.length} answers).`,
    );
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return {
    id: cardId,
    schema_version: schemaVersion,
    exam_index: examIndex,
    exam_label: examLabel,
    band_index: bandIndex,
    band_label: bandLabel,
    question_set_type_index: questionSetTypeIndex as QuestionSetType,
    question_set_type_label: questionSetTypeLabel,
    topic_index: topicIndex,
    topic_label: topicLabel,
    title,
    language_code: languageCode,
    status,
    passage,
    passage_meta: {
      sentence_count: sentenceCount,
      word_count: wordCount,
    },
    vocab:
      vocabList.length > 0
        ? vocabList
        : generatePassageVocab(title, topicLabel, passage),
    questions: questionsList,
    answer_key: answerKeyList,
  };
}

function buildQuestionRecordId(passageId: string, sourceQuestionId: number) {
  return `${passageId}::q${sourceQuestionId}`;
}

async function run() {
  const defaultInputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../artifacts/readtok/src/lib/reading-material-db.v2.json",
  );
  const defaultAdditionsPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../artifacts/readtok/src/lib/reading-material-db.v2.additions.json",
  );
  const defaultStitchedPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../artifacts/readtok/src/lib/reading-material-db.v2.stitched-8plus.json",
  );

  const requestedPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : defaultInputPath;

  console.log(`Reading source JSON from: ${requestedPath}`);

  const fileContent = await readFile(requestedPath, "utf8");
  const parsed = JSON.parse(fileContent) as unknown;
  const rawCards = parseSourceCards(parsed);

  const optionalSourcePaths = [defaultAdditionsPath, defaultStitchedPath];
  const additionalCards: unknown[] = [];
  for (const optionalPath of optionalSourcePaths) {
    try {
      const sourceContent = await readFile(optionalPath, "utf8");
      const sourceParsed = JSON.parse(sourceContent) as unknown;
      const parsedCards = parseSourceCards(sourceParsed);
      additionalCards.push(...parsedCards);
      if (parsedCards.length > 0) {
        console.log(`Appending ${parsedCards.length} additional cards from: ${optionalPath}`);
      }
    } catch {
      console.log(`No optional dataset loaded (${optionalPath}).`);
    }
  }

  const mergedRawCards = [...rawCards, ...additionalCards];
  const ingestAnomalies: IngestAnomaly[] = [];
  const sourceCards = mergedRawCards.map((rawCard, cardIndex) =>
    parseSourceCard(rawCard, cardIndex, ingestAnomalies),
  );

  const seenPassageIds = new Set<string>();
  for (const card of sourceCards) {
    if (seenPassageIds.has(card.id)) {
      throw new Error(`Duplicate passage id found in merged input: ${card.id}`);
    }
    seenPassageIds.add(card.id);
  }

  await db.transaction(async (tx) => {
    await tx.delete(answerKeys);
    await tx.delete(questions);
    await tx.delete(passages);

    for (const card of sourceCards) {
      await tx.insert(passages).values({
        id: card.id,
        schemaVersion: card.schema_version,
        examIndex: card.exam_index,
        examLabel: card.exam_label,
        bandIndex: card.band_index,
        bandLabel: card.band_label,
        questionSetTypeIndex: card.question_set_type_index,
        questionSetTypeLabel: card.question_set_type_label,
        topicIndex: card.topic_index,
        topicLabel: card.topic_label,
        title: card.title,
        languageCode: card.language_code,
        status: card.status,
        passage: card.passage,
        passageMetaSentenceCount: card.passage_meta.sentence_count,
        passageMetaWordCount: card.passage_meta.word_count,
        vocabJson: card.vocab,
      });

      for (const question of card.questions) {
        const questionId = buildQuestionRecordId(card.id, question.id);
        await tx.insert(questions).values({
          id: questionId,
          passageId: card.id,
          sourceQuestionId: question.id,
          orderIndex: question.order_index,
          questionTypeIndex: question.question_type_index,
          questionTypeLabel: question.question_type_label,
          prompt: question.prompt,
          questionPayloadJson: question.payload ?? {},
        });
      }

      for (const answerKey of card.answer_key) {
        const questionId = buildQuestionRecordId(card.id, answerKey.question_id);
        await tx.insert(answerKeys).values({
          id: `${questionId}::answer`,
          questionId,
          answerType: answerKey.answer_type,
          answerValue: answerKey.answer_value,
          acceptedValuesJson: answerKey.accepted_values ?? null,
          explanation: answerKey.explanation,
          evidenceJson: answerKey.evidence,
        });
      }
    }
  });

  const questionCount = sourceCards.reduce(
    (total, card) => total + card.questions.length,
    0,
  );

  console.log(
    `Imported ${sourceCards.length} passages, ${questionCount} questions, and ${questionCount} answer keys.`,
  );
  if (ingestAnomalies.length > 0) {
    console.log(
      `Detected and auto-fixed ${ingestAnomalies.length} ingest anomalies.`,
    );
    for (const anomaly of ingestAnomalies) {
      console.log(
        `[${anomaly.kind}] ${anomaly.cardId} | ${anomaly.title} | q${anomaly.questionId} | ${anomaly.before} -> ${anomaly.after}`,
      );
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
