import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type QuestionType = "tfng" | "mcq" | "sentence_completion" | "short_answer";

type SourceCard = {
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
    question_type_index: QuestionType;
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

function questionTypeLabel(type: QuestionType) {
  if (type === "tfng") return "True / False / Not Given";
  if (type === "mcq") return "Multiple Choice";
  if (type === "sentence_completion") return "Sentence Completion";
  return "Short Answer";
}

function parseMaxWords(instructionLine: string) {
  const upper = instructionLine.toUpperCase();
  const numericMatch = upper.match(/NO MORE THAN\s+(\d+)\s+WORDS?/);
  if (numericMatch) {
    return Number(numericMatch[1]);
  }

  if (upper.includes("ONE WORD ONLY")) return 1;
  if (upper.includes("TWO WORDS")) return 2;
  if (upper.includes("THREE WORDS")) return 3;
  if (upper.includes("FOUR WORDS")) return 4;
  if (upper.includes("FIVE WORDS")) return 5;
  return undefined;
}

function splitAnswerValues(raw: string) {
  return raw
    .split("/")
    .map((part) => normalizeSpaces(part))
    .filter((part) => part.length > 0);
}

function parseCards(
  raw: string,
  options?: {
    startSequence?: number;
  },
) {
  const startSequence =
    options?.startSequence !== undefined && Number.isInteger(options.startSequence)
      ? Math.max(1, options.startSequence)
      : 1;
  const normalized = raw.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n");
  const anchor = normalized.indexOf("Card 1");
  if (anchor < 0) {
    throw new Error("Input text does not contain 'Card 1'.");
  }

  const body = normalized.slice(anchor);
  const cardChunks = body.split(/\n(?=Card\s+\d+\s+–\s+Band\s+[^\n]+?\s+–\s+Mixed)/g);

  const cards: SourceCard[] = [];

  for (const chunk of cardChunks) {
    const trimmedChunk = chunk.trim();
    if (!trimmedChunk) continue;

    const headerMatch = trimmedChunk.match(
      /^Card\s+(\d+)\s+–\s+Band\s+([0-9.]+\+?)\s+–\s+Mixed/m,
    );
    if (!headerMatch) {
      throw new Error(`Cannot parse card header from chunk:\n${trimmedChunk.slice(0, 200)}`);
    }

    const cardNumber = Number(headerMatch[1]);
    const bandLabel = headerMatch[2];
    const bandIndex = bandLabel.startsWith("8") ? 80 : Number(bandLabel.replace(".", "")); // 6.0 -> 60, 7.0 -> 70

    const titleTopicMatch = trimmedChunk.match(/Title:\s*(.+?)Topic:\s*(.+?)\n/i);
    if (!titleTopicMatch) {
      throw new Error(`Card ${cardNumber}: cannot parse Title/Topic line.`);
    }
    const title = normalizeSpaces(titleTopicMatch[1]);
    const topicLabel = normalizeSpaces(titleTopicMatch[2]);

    const passageMatch = trimmedChunk.match(/Topic:[^\n]*\n([\s\S]*?)\n\s*Vocab\s*\/\s*Collocations:/i);
    if (!passageMatch) {
      throw new Error(`Card ${cardNumber}: cannot parse passage.`);
    }
    const passage = normalizeSpaces(passageMatch[1]);
    const passageSentences = splitSentences(passage);
    const expectedSentenceCount = bandIndex === 60 ? 5 : 4;
    if (passageSentences.length !== expectedSentenceCount) {
      throw new Error(
        `Card ${cardNumber}: sentence count ${passageSentences.length} != expected ${expectedSentenceCount}.`,
      );
    }

    const vocabBlockMatch = trimmedChunk.match(/Vocab\s*\/\s*Collocations:\s*\n([\s\S]*?)\n\s*Questions:/i);
    if (!vocabBlockMatch) {
      throw new Error(`Card ${cardNumber}: cannot parse vocab block.`);
    }
    const vocabBlock = vocabBlockMatch[1];
    const vocabLines = vocabBlock
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const vocab = vocabLines.map((line, vocabIndex) => {
      const vocabMatch = line.match(/^(.+?)\s+\(S(\d+)\):\s*(.+?)\s*\/\s*(.+)$/i);
      if (!vocabMatch) {
        throw new Error(`Card ${cardNumber}: invalid vocab line ${vocabIndex + 1}: ${line}`);
      }
      const term = normalizeSpaces(vocabMatch[1]);
      const sentenceIndex = Number(vocabMatch[2]);
      const simpleMeaning = normalizeSpaces(vocabMatch[3]);
      const meaningVi = normalizeSpaces(vocabMatch[4]);

      return {
        term,
        definition: simpleMeaning,
        simple_meaning_en: simpleMeaning,
        example_sentence_en: normalizeSpaces(
          passageSentences[Math.max(0, Math.min(passageSentences.length - 1, sentenceIndex - 1))],
        ),
        meaning_vi: meaningVi,
        sentence_index: sentenceIndex,
      };
    });

    const questionsBlockMatch = trimmedChunk.match(/Questions:\s*\n([\s\S]*?)\n\s*Answers\s*&\s*Explanations:/i);
    if (!questionsBlockMatch) {
      throw new Error(`Card ${cardNumber}: cannot parse questions block.`);
    }
    const questionsBlock = questionsBlockMatch[1];

    const tfngMatch = questionsBlock.match(/\[TFNG\]\s*([^\n]+)/i);
    const mcqMatch = questionsBlock.match(
      /\[MCQ\]\s*([\s\S]*?)A\.\s*([\s\S]*?)B\.\s*([\s\S]*?)C\.\s*([\s\S]*?)D\.\s*([^\n]+)/i,
    );
    const sentenceCompletionMatch = questionsBlock.match(
      /\[Sentence Completion\]\s*([\s\S]*?)Write\s+([^\n]+)/i,
    );
    const shortAnswerMatch = questionsBlock.match(
      /\[Short Answer\]\s*([\s\S]*?)Write\s+([^\n]+)/i,
    );

    if (!tfngMatch || !mcqMatch || !sentenceCompletionMatch || !shortAnswerMatch) {
      throw new Error(`Card ${cardNumber}: one or more question types failed to parse.`);
    }

    const mcqPrompt = normalizeSpaces(mcqMatch[1]);
    const mcqOptions = [
      { key: "A", text: normalizeSpaces(mcqMatch[2]) },
      { key: "B", text: normalizeSpaces(mcqMatch[3]) },
      { key: "C", text: normalizeSpaces(mcqMatch[4]) },
      { key: "D", text: normalizeSpaces(mcqMatch[5]) },
    ];

    const sentencePrompt = normalizeSpaces(sentenceCompletionMatch[1]);
    const sentenceInstruction = normalizeSpaces(sentenceCompletionMatch[2].replace(/\.*$/, ""));
    const sentenceMaxWords = parseMaxWords(sentenceInstruction);

    const shortPrompt = normalizeSpaces(shortAnswerMatch[1]);
    const shortInstruction = normalizeSpaces(shortAnswerMatch[2].replace(/\.*$/, ""));
    const shortMaxWords = parseMaxWords(shortInstruction);

    const questions: SourceCard["questions"] = [
      {
        id: 1,
        order_index: 1,
        question_type_index: "tfng",
        question_type_label: questionTypeLabel("tfng"),
        prompt: normalizeSpaces(tfngMatch[1]),
        payload: {},
      },
      {
        id: 2,
        order_index: 2,
        question_type_index: "mcq",
        question_type_label: questionTypeLabel("mcq"),
        prompt: mcqPrompt,
        payload: { options: mcqOptions },
      },
      {
        id: 3,
        order_index: 3,
        question_type_index: "sentence_completion",
        question_type_label: questionTypeLabel("sentence_completion"),
        prompt: sentencePrompt,
        payload: {
          max_words: sentenceMaxWords,
          instruction_label: sentenceInstruction.toUpperCase(),
        },
      },
      {
        id: 4,
        order_index: 4,
        question_type_index: "short_answer",
        question_type_label: questionTypeLabel("short_answer"),
        prompt: shortPrompt,
        payload: {
          max_words: shortMaxWords,
          instruction_label: shortInstruction.toUpperCase(),
          case_sensitive: false,
        },
      },
    ];

    const answersBlockMatch = trimmedChunk.match(/Answers\s*&\s*Explanations:\s*\n([\s\S]*?)(?:\n(?=Card\s+\d+\s+–)|$)/i);
    if (!answersBlockMatch) {
      throw new Error(`Card ${cardNumber}: cannot parse answers block.`);
    }
    const answerLines = answersBlockMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (answerLines.length < 4) {
      throw new Error(`Card ${cardNumber}: expected 4 answer lines, got ${answerLines.length}.`);
    }

    const parseAnswerLine = (line: string) => {
      const parts = line.split(/\s+—\s+/);
      if (parts.length < 2) {
        throw new Error(`Card ${cardNumber}: bad answer line: ${line}`);
      }
      const answerValue = normalizeSpaces(parts[0]);
      const explanation = normalizeSpaces(parts.slice(1).join(" — "));
      return { answerValue, explanation };
    };

    const tfngAnswer = parseAnswerLine(answerLines[0]);
    const mcqAnswer = parseAnswerLine(answerLines[1]);
    const sentenceAnswer = parseAnswerLine(answerLines[2]);
    const shortAnswer = parseAnswerLine(answerLines[3]);

    const shortAccepted = splitAnswerValues(shortAnswer.answerValue);

    const answer_key: SourceCard["answer_key"] = [
      {
        question_id: 1,
        answer_type: "label",
        answer_value: tfngAnswer.answerValue.toUpperCase(),
        explanation: tfngAnswer.explanation,
        evidence: [],
      },
      {
        question_id: 2,
        answer_type: "option_key",
        answer_value: mcqAnswer.answerValue.toUpperCase(),
        explanation: mcqAnswer.explanation,
        evidence: [],
      },
      {
        question_id: 3,
        answer_type: "text",
        answer_value: sentenceAnswer.answerValue,
        accepted_values: splitAnswerValues(sentenceAnswer.answerValue),
        explanation: sentenceAnswer.explanation,
        evidence: [],
      },
      {
        question_id: 4,
        answer_type: "text",
        answer_value: shortAccepted[0] ?? shortAnswer.answerValue,
        accepted_values: shortAccepted,
        explanation: shortAnswer.explanation,
        evidence: [],
      },
    ];

    const sequenceNumber = startSequence + cardNumber - 1;
    const cardId = `ielts_reading_${bandIndex}_mixed_${String(sequenceNumber).padStart(4, "0")}`;
    cards.push({
      id: cardId,
      schema_version: "3.0",
      exam_index: "ielts_reading",
      exam_label: "IELTS Reading",
      band_index: bandIndex,
      band_label: bandLabel,
      question_set_type_index: "mixed",
      question_set_type_label: "Mixed",
      topic_index: slugify(topicLabel),
      topic_label: topicLabel,
      title,
      language_code: "en",
      status: "active",
      passage,
      passage_meta: {
        sentence_count: passageSentences.length,
        word_count: wordCount(passage),
      },
      vocab,
      questions,
      answer_key,
    });
  }

  return cards;
}

async function run() {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  if (!inputPath) {
    throw new Error(
      "Usage: tsx parse-mixed-batch.ts <input-text-file> [--append] [--start-seq=<n>]",
    );
  }

  const appendMode = args.includes("--append");
  const startSeqArg = args.find((arg) => arg.startsWith("--start-seq="));
  const parsedStartSeq =
    startSeqArg !== undefined ? Number(startSeqArg.split("=")[1]) : undefined;

  const raw = await readFile(path.resolve(process.cwd(), inputPath), "utf8");
  const cards = parseCards(raw, {
    startSequence:
      parsedStartSeq !== undefined && Number.isInteger(parsedStartSeq)
        ? parsedStartSeq
        : undefined,
  });

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

  let outputCards = cards;
  if (appendMode) {
    const existingRaw = await readFile(outputPath, "utf8");
    const existingCards = JSON.parse(existingRaw) as SourceCard[];
    const seenIds = new Set(existingCards.map((card) => card.id));
    const dedupedIncoming = cards.filter((card) => !seenIds.has(card.id));
    outputCards = [...existingCards, ...dedupedIncoming];
  }

  await writeFile(outputPath, `${JSON.stringify(outputCards, null, 2)}\n`, "utf8");
  await writeFile(additionsPath, "[]\n", "utf8");
  await writeFile(stitchedPath, "[]\n", "utf8");

  console.log(
    appendMode
      ? `Parsed ${cards.length} cards and wrote ${outputCards.length} total cards to ${outputPath}`
      : `Parsed ${cards.length} cards to ${outputPath}`,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
