import { readFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
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
  band?: string;
  title: string;
  topic: string;
  passage: string;
  vocab: Array<{
    term: string;
    sentence_ref?: string;
    meaning_en?: string;
    quick_explanation?: string;
    meaning_vi: string;
    example_sentence?: string;
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

type NormalizedBandLabel = "6.0" | "7.0" | "7.5" | "8.0+";

type ConvertOptions = {
  defaultBandLabel?: string;
};

const execFile = promisify(execFileCallback);

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

export function normalizeBandLabel(rawLabel?: string | null): NormalizedBandLabel | null {
  if (!rawLabel) return null;
  const normalized = rawLabel.trim().toLowerCase().replace(/^band\s*/i, "");
  if (normalized === "6" || normalized === "6.0") return "6.0";
  if (normalized === "7" || normalized === "7.0") return "7.0";
  if (normalized === "7.5") return "7.5";
  if (normalized === "8" || normalized === "8.0" || normalized === "8.0+") return "8.0+";
  return null;
}

function bandIndexFromLabel(label: NormalizedBandLabel) {
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

function splitOptionKeyValues(raw: string) {
  const normalized = normalizeSpaces(raw)
    .replace(/\band\b/gi, ",")
    .replace(/[&/;+]/g, ",");

  const values = normalized
    .split(",")
    .map((part) => canonicalizeOptionKey(part))
    .filter((part) => part.length > 0);

  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function formatOptionKeyValues(values: string[]) {
  return values.join(", ");
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

function parseBandOverrideArg(rawArg?: string) {
  if (!rawArg) return undefined;
  const rawValue = rawArg.includes("=") ? rawArg.slice(rawArg.indexOf("=") + 1) : rawArg;
  const normalized = normalizeBandLabel(rawValue);
  if (!normalized) {
    throw new Error(
      `Invalid band override "${rawValue}". Expected one of 6.0, 7.0, 7.5, or 8.0+.`,
    );
  }
  return normalized;
}

export function validateAndConvert(cards: NdCard[], options: ConvertOptions = {}) {
  const anomalies: Anomaly[] = [];
  const converted: ConvertedCard[] = [];
  const defaultBandLabel = parseBandOverrideArg(options.defaultBandLabel);

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

    const bandLabel = normalizeBandLabel(card.band) ?? defaultBandLabel;
    if (!bandLabel) {
      throw new Error(
        `card_no=${card.card_no} (${normalizeSpaces(card.title)}) is missing a valid band label. ` +
          `Provide one in the data or pass --band-label=<6.0|7.0|7.5|8.0+>.`,
      );
    }

    const bandIndex = bandIndexFromLabel(bandLabel);
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
      let acceptedValues: string[] | undefined;
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
        const split = splitOptionKeyValues(raw);
        const canonical = formatOptionKeyValues(split);
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
        if (split.length > 1) {
          acceptedValues = [raw, canonical].filter(
            (value, index, values) =>
              value.trim().length > 0 && values.indexOf(value) === index,
          );
        }
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
      const definitionSource = item.meaning_en ?? item.quick_explanation ?? "";
      const definition = normalizeSpaces(toAsciiPunctuation(definitionSource));
      const exampleSentence = normalizeSpaces(
        toAsciiPunctuation(
          item.example_sentence ?? defaultExampleSentence(sentences, term, sentenceIndex),
        ),
      );
      return {
        term,
        definition,
        simple_meaning_en: definition,
        example_sentence_en: exampleSentence,
        meaning_vi: normalizeSpaces(item.meaning_vi),
        sentence_index: sentenceIndex,
      };
    });

    const questionSetTypeIndex = deriveQuestionSetType(card.card_no, outQuestions);

    converted.push({
      id: "",
      bandIndex,
      bandLabel,
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
  const defaultFactoryTag =
    normalizeFactoryTag(process.env.READTOK_FACTORY_TAG_DEFAULT ?? "v6") || "v6";
  const factoryTagArg = process.argv
    .slice(3)
    .find((arg) => arg.startsWith("--factory-tag="));
  const bandLabelArg = process.argv
    .slice(3)
    .find((arg) => arg.startsWith("--band-label=") || arg.startsWith("--default-band-label="));
  const factoryTag =
    normalizeFactoryTag(
      factoryTagArg?.slice("--factory-tag=".length) ?? defaultFactoryTag,
    ) || defaultFactoryTag;

  const absInputPath = path.resolve(process.cwd(), inputPath);
  const raw = await readFile(absInputPath, "utf8");
  const parsedCards = parseNdjson(raw);
  const { converted, anomalies } = validateAndConvert(parsedCards, {
    defaultBandLabel: bandLabelArg,
  });

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
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "../../../../");

  console.log(`Input cards: ${parsedCards.length}`);
  console.log(`Factory tag: ${factoryTag || "(none)"} (default=${defaultFactoryTag})`);
  if (bandLabelArg) {
    console.log(`Band override: ${parseBandOverrideArg(bandLabelArg)}`);
  }
  console.log(`Upserted passages: ${inserted} (created: ${created}, updated: ${updated})`);
  console.log(`Ingest anomalies auto-fixed: ${anomalies.length}`);
  for (const anomaly of anomalies) {
    console.log(
      `[${anomaly.kind}] card_no=${anomaly.cardNo} | ${anomaly.title} | ${anomaly.before} -> ${anomaly.after}`,
    );
  }

  try {
    const { stdout } = await execFile(
      "corepack",
      [
        "pnpm",
        "--filter",
        "@workspace/api-server",
        "exec",
        "tsx",
        "./src/scripts/refresh-passage-search-catalog.ts",
      ],
      {
        cwd: repoRoot,
        env: process.env,
      },
    );
    if (stdout.trim().length > 0) {
      console.log(`[search-catalog] ${stdout.trim()}`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown search catalog refresh error";
    console.warn(`[search-catalog] refresh skipped after ingest: ${message}`);
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
