import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { eq, inArray } from "drizzle-orm";
import { answerKeys, db, passages, pool, questions } from "../index";

type NdQuestionType =
  | "TFNG"
  | "MCQ"
  | "SentenceCompletion"
  | "ShortAnswer"
  | "MatchingHeading"
  | "MatchingInformation";
type OutQuestionType = "tfng" | "mcq" | "sentence_completion" | "short_answer";
type OutQuestionSetType =
  | "tfng"
  | "mcq"
  | "sentence_completion"
  | "short_answer"
  | "mixed";
type OutAnswerType = "label" | "option_key" | "text";

type NdCard = {
  card_no: number;
  band: "6.0" | "7.0" | "7.5" | "8.0+";
  title: string;
  topic: string;
  passage: string;
  vocab: Array<{
    term: string;
    sentence_ref?: string;
    meaning_en: string;
    meaning_vi: string;
  }>;
  questions: Array<{
    type: NdQuestionType;
    prompt: string;
    instruction: string;
    options: string[];
  }>;
  answers: Array<{
    type: NdQuestionType;
    answer: string;
    explanation: string;
  }>;
};

type ConvertedCard = {
  id: string;
  bandIndex: number;
  bandLabel: string;
  questionSetTypeIndex: OutQuestionSetType;
  questionSetTypeLabel: string;
  topicIndex: string;
  topicLabel: string;
  title: string;
  passage: string;
  passageSentenceCount: number;
  passageWordCount: number;
  vocab: Array<{
    term: string;
    definition: string;
    simple_meaning_en: string;
    example_sentence_en: string;
    meaning_vi: string;
    sentence_index?: number;
  }>;
  questions: Array<{
    id: number;
    orderIndex: number;
    questionTypeIndex: OutQuestionType;
    questionTypeLabel: string;
    prompt: string;
    payload: Record<string, unknown>;
  }>;
  answerKey: Array<{
    questionId: number;
    answerType: OutAnswerType;
    answerValue: string;
    acceptedValues?: string[];
    explanation: string;
    evidence: Array<{
      sentence_index: number;
      evidence_type: "support";
      explanation_role?: string;
    }>;
  }>;
};

type Anomaly = {
  cardNo: number;
  title: string;
  kind: string;
  before: string;
  after: string;
};

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toAsciiPunctuation(value: string) {
  return value
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-");
}

function toQuestionType(type: NdQuestionType): OutQuestionType {
  if (type === "TFNG") return "tfng";
  if (type === "MCQ") return "mcq";
  if (type === "MatchingHeading" || type === "MatchingInformation") return "mcq";
  if (type === "SentenceCompletion") return "sentence_completion";
  return "short_answer";
}

function questionTypeLabel(type: OutQuestionType, sourceType: NdQuestionType) {
  if (sourceType === "MatchingHeading") return "Matching Heading";
  if (sourceType === "MatchingInformation") return "Matching Information";
  if (type === "tfng") return "True / False / Not Given";
  if (type === "mcq") return "Multiple Choice";
  if (type === "sentence_completion") return "Sentence Completion";
  return "Short Answer";
}

function questionSetTypeLabel(type: OutQuestionSetType) {
  if (type === "tfng") return "True / False / Not Given";
  if (type === "mcq") return "Multiple Choice";
  if (type === "sentence_completion") return "Sentence Completion";
  if (type === "short_answer") return "Short Answer";
  return "Mixed";
}

function slugify(value: string) {
  return normalizeSpaces(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTitleKey(value: string) {
  return normalizeSpaces(value).toLowerCase();
}

function normalizeFactoryTag(rawTag?: string) {
  if (!rawTag) {
    return "";
  }
  return rawTag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitSentences(passage: string) {
  return passage
    .split(/(?<=[.!?])\s+/)
    .map((line) => normalizeSpaces(line))
    .filter((line) => line.length > 0);
}

function wordCount(value: string) {
  return normalizeSpaces(value)
    .split(/\s+/)
    .filter((token) => token.length > 0).length;
}

function parseSentenceRef(value?: string): number | undefined {
  if (!value) return undefined;
  const m = value.trim().match(/^S(\d+)$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}

function splitAcceptedValues(raw: string) {
  return raw
    .split("/")
    .map((part) => normalizeSpaces(part))
    .filter((part) => part.length > 0);
}

function parseMaxWords(instructionLine: string) {
  const upper = instructionLine.toUpperCase();
  const numericMatch = upper.match(/NO MORE THAN\s+(\d+)\s+WORDS?/);
  if (numericMatch) return Number(numericMatch[1]);
  if (upper.includes("ONE WORD ONLY")) return 1;
  if (upper.includes("TWO WORDS")) return 2;
  if (upper.includes("THREE WORDS")) return 3;
  if (upper.includes("FOUR WORDS")) return 4;
  if (upper.includes("FIVE WORDS")) return 5;
  return undefined;
}

function bandIndexFromLabel(label: NdCard["band"]) {
  if (label === "6.0") return 60;
  if (label === "7.0") return 70;
  if (label === "7.5") return 75;
  return 80;
}

export function canonicalizeTfng(value: string) {
  const compact = normalizeSpaces(value).toUpperCase().replace(/^NOTGIVEN$/, "NOT GIVEN");
  return compact;
}

export function canonicalizeOptionKey(value: string) {
  const stripped = normalizeSpaces(value)
    .replace(/^\d+\s*[.)\-:]\s*/g, "")
    .toUpperCase();
  const m = stripped.match(/^([A-H])/);
  return m ? m[1] : stripped;
}

export function canonicalizeTextAnswer(value: string) {
  return normalizeSpaces(value).replace(/^\d+\s*[.)\-:]\s*/g, "");
}

export function canonicalizeOptionText(value: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return normalizeSpaces(toAsciiPunctuation(value)).replace(
    new RegExp(`^${escapedKey}\\s*[.)\\-:]\\s+`, "i"),
    "",
  );
}

function defaultExampleSentence(sentences: string[], term: string, idx?: number) {
  if (idx && idx >= 1 && idx <= sentences.length) return sentences[idx - 1];
  const low = term.toLowerCase();
  const hit = sentences.find((s) => s.toLowerCase().includes(low));
  return hit ?? sentences[0] ?? "";
}

function deriveQuestionSetType(cardNo: number, questions: ConvertedCard["questions"]) {
  const typeSet = new Set<OutQuestionType>(questions.map((question) => question.questionTypeIndex));
  if (typeSet.size === 1) {
    const onlyType = questions[0]?.questionTypeIndex;
    if (onlyType) {
      return onlyType as OutQuestionSetType;
    }
  }

  const hasTfng = typeSet.has("tfng");
  const hasMcq = typeSet.has("mcq");
  const hasSentenceCompletion = typeSet.has("sentence_completion");
  const hasShortAnswer = typeSet.has("short_answer");

  if (hasTfng && hasMcq && hasSentenceCompletion && hasShortAnswer) {
    return "mixed";
  }

  throw new Error(
    `card_no=${cardNo} has unsupported multi-type mix (${[...typeSet].join(", ")}). ` +
      `Allowed combos are single-type sets or full mixed (tfng, mcq, sentence_completion, short_answer).`,
  );
}

export function parseNdjson(raw: string) {
  const normalized = raw.replace(/\u2028/g, "\n").replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as NdCard;
    } catch (error) {
      throw new Error(`Invalid JSON at line ${index + 1}: ${(error as Error).message}`);
    }
  });
}

export function validateAndConvert(cards: NdCard[]) {
  const anomalies: Anomaly[] = [];
  const converted: ConvertedCard[] = [];

  for (const card of cards) {
    if (!Array.isArray(card.questions) || card.questions.length === 0) {
      throw new Error(`card_no=${card.card_no} must have at least 1 question.`);
    }
    if (!Array.isArray(card.answers) || card.answers.length === 0) {
      throw new Error(`card_no=${card.card_no} must have at least 1 answer.`);
    }
    if (card.answers.length !== card.questions.length) {
      throw new Error(
        `card_no=${card.card_no} must have matching question/answer counts (questions=${card.questions.length}, answers=${card.answers.length}).`,
      );
    }

    const bandIndex = bandIndexFromLabel(card.band);
    const passage = normalizeSpaces(toAsciiPunctuation(card.passage));
    const sentences = splitSentences(passage);

    const outQuestions = card.questions.map((question, index) => {
      const qType = toQuestionType(question.type);
      const prompt = normalizeSpaces(
        toAsciiPunctuation(question.prompt).replace(/\*{3,}|_{3,}/g, "______"),
      );
      const instruction = normalizeSpaces(toAsciiPunctuation(question.instruction ?? ""));
      const payload: Record<string, unknown> = {};

      if (qType === "mcq") {
        payload.options = (question.options ?? []).map((text, i) => ({
          key: ["A", "B", "C", "D"][i] ?? String.fromCharCode(65 + i),
          text: canonicalizeOptionText(
            text,
            ["A", "B", "C", "D"][i] ?? String.fromCharCode(65 + i),
          ),
        }));
      } else if (qType === "sentence_completion" || qType === "short_answer") {
        payload.max_words = parseMaxWords(instruction);
        payload.instruction_label = instruction.toUpperCase();
        if (qType === "short_answer") payload.case_sensitive = false;
      }

      return {
        id: index + 1,
        orderIndex: index + 1,
        questionTypeIndex: qType,
        questionTypeLabel: questionTypeLabel(qType, question.type),
        prompt,
        payload,
      };
    });

    const outAnswers = card.answers.map((answer, index) => {
      const qType = outQuestions[index]?.questionTypeIndex;
      const raw = normalizeSpaces(toAsciiPunctuation(answer.answer));
      const expectedType: OutAnswerType =
        qType === "tfng" ? "label" : qType === "mcq" ? "option_key" : "text";

      let answerValue = raw;
      if (expectedType === "label") {
        const canonical = canonicalizeTfng(raw);
        if (canonical !== raw) {
          anomalies.push({
            cardNo: card.card_no,
            title: card.title,
            kind: "answer_value_normalized",
            before: raw,
            after: canonical,
          });
        }
        answerValue = canonical;
      } else if (expectedType === "option_key") {
        const canonical = canonicalizeOptionKey(raw);
        if (canonical !== raw) {
          anomalies.push({
            cardNo: card.card_no,
            title: card.title,
            kind: "answer_value_normalized",
            before: raw,
            after: canonical,
          });
        }
        answerValue = canonical;
      } else {
        const canonical = canonicalizeTextAnswer(raw);
        if (canonical !== raw) {
          anomalies.push({
            cardNo: card.card_no,
            title: card.title,
            kind: "answer_value_normalized",
            before: raw,
            after: canonical,
          });
        }
        answerValue = canonical;
      }

      let acceptedValues: string[] | undefined;
      if (expectedType === "text" && raw.includes("/")) {
        const split = splitAcceptedValues(raw);
        if (split.length > 1) {
          acceptedValues = split;
          answerValue = split[0];
          anomalies.push({
            cardNo: card.card_no,
            title: card.title,
            kind: "accepted_values_split",
            before: raw,
            after: split.join(" | "),
          });
        }
      }

      return {
        questionId: index + 1,
        answerType: expectedType,
        answerValue,
        acceptedValues,
        explanation: normalizeSpaces(toAsciiPunctuation(answer.explanation)),
        evidence: [],
      };
    });

    const vocab = (card.vocab ?? []).map((item) => {
      const sentenceIndex = parseSentenceRef(item.sentence_ref);
      const term = normalizeSpaces(toAsciiPunctuation(item.term));
      return {
        term,
        definition: normalizeSpaces(toAsciiPunctuation(item.meaning_en)),
        simple_meaning_en: normalizeSpaces(toAsciiPunctuation(item.meaning_en)),
        example_sentence_en: defaultExampleSentence(sentences, term, sentenceIndex),
        meaning_vi: normalizeSpaces(item.meaning_vi),
        sentence_index: sentenceIndex,
      };
    });

    const questionSetTypeIndex = deriveQuestionSetType(card.card_no, outQuestions);

    converted.push({
      id: "",
      bandIndex,
      bandLabel: card.band,
      questionSetTypeIndex,
      questionSetTypeLabel: questionSetTypeLabel(questionSetTypeIndex),
      topicIndex: slugify(card.topic),
      topicLabel: normalizeSpaces(toAsciiPunctuation(card.topic)),
      title: normalizeSpaces(toAsciiPunctuation(card.title)),
      passage,
      passageSentenceCount: sentences.length,
      passageWordCount: wordCount(passage),
      vocab,
      questions: outQuestions,
      answerKey: outAnswers,
    });
  }

  return { converted, anomalies };
}

function buildQuestionRecordId(passageId: string, sourceQuestionId: number) {
  return `${passageId}::q${sourceQuestionId}`;
}

async function run() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: tsx ingest-ndjson-cards.ts <input.ndjson>");
  }
  const factoryTagArg = process.argv
    .slice(3)
    .find((arg) => arg.startsWith("--factory-tag="));
  const factoryTag =
    normalizeFactoryTag(factoryTagArg?.slice("--factory-tag=".length) ?? "v2") ||
    "v2";

  const absInputPath = path.resolve(process.cwd(), inputPath);
  const raw = await readFile(absInputPath, "utf8");
  const parsedCards = parseNdjson(raw);
  const { converted, anomalies } = validateAndConvert(parsedCards);

  const idRows = await db
    .select({ id: passages.id })
    .from(passages)
    .where(eq(passages.examIndex, "ielts_reading"));

  let maxSeq = idRows.reduce((max, row) => {
    const match = row.id.match(/_(\d{4})$/);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

  const bandLabels = Array.from(new Set(converted.map((card) => card.bandLabel)));
  const existingTitlesByBandRows = await db
    .select({
      bandLabel: passages.bandLabel,
      title: passages.title,
    })
    .from(passages)
    .where(inArray(passages.bandLabel, bandLabels));

  const existingTitleKeysByBand = new Map<string, Set<string>>();
  for (const row of existingTitlesByBandRows) {
    const set =
      existingTitleKeysByBand.get(row.bandLabel) ?? new Set<string>();
    set.add(normalizeTitleKey(row.title));
    existingTitleKeysByBand.set(row.bandLabel, set);
  }

  for (const card of converted) {
    const set =
      existingTitleKeysByBand.get(card.bandLabel) ?? new Set<string>();
    const baseTitle = card.title;
    const baseKey = normalizeTitleKey(baseTitle);

    let nextTitle = baseTitle;
    if (set.has(baseKey)) {
      let suffix = 2;
      while (set.has(normalizeTitleKey(`${baseTitle} ${suffix}`))) {
        suffix += 1;
      }
      nextTitle = `${baseTitle} ${suffix}`;
      card.title = nextTitle;
    }

    set.add(normalizeTitleKey(nextTitle));
    existingTitleKeysByBand.set(card.bandLabel, set);

    maxSeq += 1;
    card.id = `ielts_reading_${card.bandIndex}_${card.questionSetTypeIndex}_${String(maxSeq).padStart(4, "0")}`;
  }

  await db.transaction(async (tx) => {
    for (const card of converted) {
      await tx
        .insert(passages)
        .values({
          id: card.id,
          schemaVersion: "3.0",
          examIndex: "ielts_reading",
          examLabel: "IELTS Reading",
          bandIndex: card.bandIndex,
          bandLabel: card.bandLabel,
          questionSetTypeIndex: card.questionSetTypeIndex,
          questionSetTypeLabel: card.questionSetTypeLabel,
          topicIndex: card.topicIndex,
          topicLabel: card.topicLabel,
          title: card.title,
          factoryTag,
          languageCode: "en",
          status: "active",
          passage: card.passage,
          passageMetaSentenceCount: card.passageSentenceCount,
          passageMetaWordCount: card.passageWordCount,
          vocabJson: card.vocab,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: passages.id,
          set: {
            schemaVersion: "3.0",
            examIndex: "ielts_reading",
            examLabel: "IELTS Reading",
            bandIndex: card.bandIndex,
            bandLabel: card.bandLabel,
            questionSetTypeIndex: card.questionSetTypeIndex,
            questionSetTypeLabel: card.questionSetTypeLabel,
            topicIndex: card.topicIndex,
            topicLabel: card.topicLabel,
            title: card.title,
            factoryTag,
            languageCode: "en",
            status: "active",
            passage: card.passage,
            passageMetaSentenceCount: card.passageSentenceCount,
            passageMetaWordCount: card.passageWordCount,
            vocabJson: card.vocab,
            updatedAt: new Date(),
          },
        });

      const existingQuestions = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.passageId, card.id));

      const existingQuestionIds = existingQuestions.map((row) => row.id);
      if (existingQuestionIds.length > 0) {
        await tx.delete(answerKeys).where(inArray(answerKeys.questionId, existingQuestionIds));
      }
      await tx.delete(questions).where(eq(questions.passageId, card.id));

      for (const question of card.questions) {
        const questionId = buildQuestionRecordId(card.id, question.id);
        await tx.insert(questions).values({
          id: questionId,
          passageId: card.id,
          sourceQuestionId: question.id,
          orderIndex: question.orderIndex,
          questionTypeIndex: question.questionTypeIndex,
          questionTypeLabel: question.questionTypeLabel,
          prompt: question.prompt,
          questionPayloadJson: question.payload,
        });
      }

      for (const answer of card.answerKey) {
        const questionId = buildQuestionRecordId(card.id, answer.questionId);
        await tx.insert(answerKeys).values({
          id: `${questionId}::answer`,
          questionId,
          answerType: answer.answerType,
          answerValue: answer.answerValue,
          acceptedValuesJson: answer.acceptedValues ?? null,
          explanation: answer.explanation,
          evidenceJson: answer.evidence,
        });
      }
    }
  });

  const inserted = converted.length;
  const updated = 0;
  const created = inserted;

  console.log(`Input cards: ${parsedCards.length}`);
  console.log(`Factory tag: ${factoryTag || "(none)"}`);
  console.log(`Upserted passages: ${inserted} (created: ${created}, updated: ${updated})`);
  console.log(`Ingest anomalies auto-fixed: ${anomalies.length}`);
  for (const anomaly of anomalies) {
    console.log(
      `[${anomaly.kind}] card_no=${anomaly.cardNo} | ${anomaly.title} | ${anomaly.before} -> ${anomaly.after}`,
    );
  }

  await pool.end();
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  run().catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
}
