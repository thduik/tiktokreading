import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type NdQuestionType = "TFNG" | "MCQ" | "SentenceCompletion" | "ShortAnswer";

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

type OutQuestionType = "tfng" | "mcq" | "sentence_completion" | "short_answer";

type OutCard = {
  id: string;
  schema_version: string;
  exam_index: string;
  exam_label: string;
  band_index: number;
  band_label: string;
  question_set_type_index: "mixed";
  question_set_type_label: "Mixed";
  topic_index: string;
  topic_label: string;
  title: string;
  language_code: "en";
  status: "active";
  passage: string;
  passage_meta: {
    sentence_count: number;
    word_count: number;
  };
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
    order_index: number;
    question_type_index: OutQuestionType;
    question_type_label: string;
    prompt: string;
    payload: Record<string, unknown>;
  }>;
  answer_key: Array<{
    question_id: number;
    answer_type: "label" | "option_key" | "text";
    answer_value: string;
    accepted_values?: string[];
    explanation: string;
    evidence: Array<{
      sentence_index: number;
      evidence_type: "support";
      highlight_text?: string;
      explanation_role?: string;
    }>;
  }>;
};

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  return normalizeSpaces(value)
    .toLowerCase()
    .replace(/['’]/g, "")
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

function toQuestionType(type: NdQuestionType): OutQuestionType {
  if (type === "TFNG") return "tfng";
  if (type === "MCQ") return "mcq";
  if (type === "SentenceCompletion") return "sentence_completion";
  return "short_answer";
}

function questionTypeLabel(type: OutQuestionType) {
  if (type === "tfng") return "True / False / Not Given";
  if (type === "mcq") return "Multiple Choice";
  if (type === "sentence_completion") return "Sentence Completion";
  return "Short Answer";
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

function defaultExampleSentence(sentences: string[], term: string, idx?: number) {
  if (idx && idx >= 1 && idx <= sentences.length) return sentences[idx - 1];
  const low = term.toLowerCase();
  const hit = sentences.find((s) => s.toLowerCase().includes(low));
  return hit ?? sentences[0] ?? "";
}

function bandIndexFromLabel(label: NdCard["band"]) {
  if (label === "6.0") return 60;
  if (label === "7.0") return 70;
  if (label === "7.5") return 75;
  return 80;
}

function parseNdjson(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.map((line, i) => {
    try {
      return JSON.parse(line) as NdCard;
    } catch (error) {
      throw new Error(`Invalid JSON at line ${i + 1}: ${(error as Error).message}`);
    }
  });
}

async function run() {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  if (!inputPath) {
    throw new Error("Usage: tsx append-ndjson-cards.ts <input.ndjson> [--start-seq=<n>]");
  }

  const startSeqArg = args.find((arg) => arg.startsWith("--start-seq="));
  const forcedStartSeq = startSeqArg ? Number(startSeqArg.split("=")[1]) : undefined;

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "../../../../");
  const outputPath = path.resolve(
    repoRoot,
    "artifacts/readtok/src/lib/reading-material-db.v2.json",
  );
  const additionsPath = path.resolve(
    repoRoot,
    "artifacts/readtok/src/lib/reading-material-db.v2.additions.json",
  );
  const stitchedPath = path.resolve(
    repoRoot,
    "artifacts/readtok/src/lib/reading-material-db.v2.stitched-8plus.json",
  );

  const existing = JSON.parse(await readFile(outputPath, "utf8")) as OutCard[];
  const existingSeqMax = existing.reduce((max, card) => {
    const m = card.id.match(/_(\d{4})$/);
    const n = m ? Number(m[1]) : 0;
    return n > max ? n : max;
  }, 0);
  const startSeq =
    forcedStartSeq && Number.isInteger(forcedStartSeq) && forcedStartSeq > 0
      ? forcedStartSeq
      : existingSeqMax + 1;

  const raw = await readFile(path.resolve(process.cwd(), inputPath), "utf8");
  const cards = parseNdjson(raw);

  const converted: OutCard[] = cards.map((card, idx) => {
    const bandIndex = bandIndexFromLabel(card.band);
    const sequence = startSeq + idx;
    const id = `ielts_reading_${bandIndex}_mixed_${String(sequence).padStart(4, "0")}`;
    const passage = normalizeSpaces(card.passage);
    const sentences = splitSentences(passage);

    const questions = card.questions.map((q, qIdx) => {
      const qType = toQuestionType(q.type);
      const prompt = normalizeSpaces(
        q.prompt.replace(/\*{3,}/g, "______").replace(/_{3,}/g, "______"),
      );
      const instruction = normalizeSpaces(q.instruction ?? "");
      const payload: Record<string, unknown> = {};

      if (qType === "mcq") {
        payload.options = (q.options ?? []).slice(0, 4).map((text, i) => ({
          key: ["A", "B", "C", "D"][i] ?? String.fromCharCode(65 + i),
          text: normalizeSpaces(text),
        }));
      } else if (qType === "sentence_completion" || qType === "short_answer") {
        const maxWords = parseMaxWords(instruction);
        payload.max_words = maxWords;
        payload.instruction_label = instruction.toUpperCase();
        if (qType === "short_answer") payload.case_sensitive = false;
      }

      return {
        id: qIdx + 1,
        order_index: qIdx + 1,
        question_type_index: qType,
        question_type_label: questionTypeLabel(qType),
        prompt,
        payload,
      };
    });

    const answers = card.answers.map((a, aIdx) => {
      const qType = toQuestionType(a.type);
      const normalizedAnswer = normalizeSpaces(a.answer);
      const answerType =
        qType === "tfng" ? "label" : qType === "mcq" ? "option_key" : "text";

      const acceptedValues =
        qType === "short_answer" || qType === "sentence_completion"
          ? splitAcceptedValues(normalizedAnswer)
          : undefined;

      return {
        question_id: aIdx + 1,
        answer_type: answerType as "label" | "option_key" | "text",
        answer_value:
          qType === "tfng" || qType === "mcq"
            ? normalizedAnswer.toUpperCase()
            : normalizedAnswer,
        accepted_values:
          acceptedValues && acceptedValues.length > 0 ? acceptedValues : undefined,
        explanation: normalizeSpaces(a.explanation),
        evidence: [],
      };
    });

    const vocab = (card.vocab ?? []).map((item) => {
      const sIdx = parseSentenceRef(item.sentence_ref);
      return {
        term: normalizeSpaces(item.term),
        definition: normalizeSpaces(item.meaning_en),
        simple_meaning_en: normalizeSpaces(item.meaning_en),
        example_sentence_en: defaultExampleSentence(
          sentences,
          normalizeSpaces(item.term),
          sIdx,
        ),
        meaning_vi: normalizeSpaces(item.meaning_vi),
        sentence_index: sIdx,
      };
    });

    return {
      id,
      schema_version: "3.0",
      exam_index: "ielts_reading",
      exam_label: "IELTS Reading",
      band_index: bandIndex,
      band_label: card.band,
      question_set_type_index: "mixed",
      question_set_type_label: "Mixed",
      topic_index: slugify(card.topic),
      topic_label: normalizeSpaces(card.topic),
      title: normalizeSpaces(card.title),
      language_code: "en",
      status: "active",
      passage,
      passage_meta: {
        sentence_count: sentences.length,
        word_count: wordCount(passage),
      },
      vocab,
      questions,
      answer_key: answers,
    };
  });

  const existingIds = new Set(existing.map((card) => card.id));
  const dedupedIncoming = converted.filter((card) => !existingIds.has(card.id));
  const merged = [...existing, ...dedupedIncoming];

  await writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  await writeFile(additionsPath, "[]\n", "utf8");
  await writeFile(stitchedPath, "[]\n", "utf8");

  console.log(
    `Converted ${converted.length} cards, appended ${dedupedIncoming.length}, total ${merged.length}.`,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

