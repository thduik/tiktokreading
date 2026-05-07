import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePassageVocab, splitPassageIntoSentences } from "./vocab-utils";

type JsonObject = Record<string, unknown>;

type SourceCard = {
  title: string;
  topic_label: string;
  passage: string;
  vocab?: unknown;
};

const defaultDatasetPaths = [
  "../../../../artifacts/readtok/src/lib/reading-material-db.v2.json",
  "../../../../artifacts/readtok/src/lib/reading-material-db.v2.additions.json",
  "../../../../artifacts/readtok/src/lib/reading-material-db.v2.stitched-8plus.json",
];

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCardsContainer(input: unknown): {
  cards: JsonObject[];
  preserveEnvelope: boolean;
} {
  if (Array.isArray(input)) {
    return { cards: input as JsonObject[], preserveEnvelope: false };
  }

  if (isObject(input) && Array.isArray(input.cards)) {
    return { cards: input.cards as JsonObject[], preserveEnvelope: true };
  }

  throw new Error("Dataset must be either an array of cards or an object with cards[].");
}

function isValidVocabItem(item: unknown): item is {
  term: string;
  definition: string;
  meaning_vi?: string;
  sentence_index?: number;
} {
  if (!isObject(item)) {
    return false;
  }

  if (typeof item.term !== "string" || item.term.trim().length === 0) {
    return false;
  }
  if (typeof item.definition !== "string" || item.definition.trim().length === 0) {
    return false;
  }
  if (item.meaning_vi !== undefined && typeof item.meaning_vi !== "string") {
    return false;
  }
  if (
    item.sentence_index !== undefined &&
    (typeof item.sentence_index !== "number" ||
      !Number.isInteger(item.sentence_index) ||
      item.sentence_index < 1)
  ) {
    return false;
  }

  return true;
}

function normalizeExistingVocab(
  existing: unknown,
  passage: string,
  title: string,
  topicLabel: string,
  forceRegenerate: boolean,
) {
  const passageSentenceCount = splitPassageIntoSentences(passage).length;
  const generatedFallback = generatePassageVocab(title, topicLabel, passage);
  const generatedByKey = new Map(
    generatedFallback.map((item) => [item.term.toLowerCase(), item]),
  );

  if (forceRegenerate) {
    return generatedFallback;
  }

  if (!Array.isArray(existing) || existing.length === 0) {
    return generatedFallback;
  }

  const normalized = existing.filter(isValidVocabItem).map((item) => {
    const normalizedTerm = item.term.trim().toLowerCase();
    const generatedMatch = generatedByKey.get(normalizedTerm);
    const sentenceIndex =
      item.sentence_index !== undefined &&
      item.sentence_index >= 1 &&
      item.sentence_index <= passageSentenceCount
        ? item.sentence_index
        : generatedMatch?.sentence_index;

    return {
      term: item.term.trim(),
      definition: item.definition.trim(),
      meaning_vi: item.meaning_vi?.trim() || generatedMatch?.meaning_vi,
      sentence_index: sentenceIndex,
    };
  });

  if (normalized.length === 0) {
    return generatedFallback;
  }

  return normalized;
}

function assertSourceCard(card: JsonObject, index: number): SourceCard {
  const title = card.title;
  const topicLabel = card.topic_label;
  const passage = card.passage;

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error(`card[${index}] missing title`);
  }
  if (typeof topicLabel !== "string" || topicLabel.trim().length === 0) {
    throw new Error(`card[${index}] missing topic_label`);
  }
  if (typeof passage !== "string" || passage.trim().length === 0) {
    throw new Error(`card[${index}] missing passage`);
  }

  return {
    title,
    topic_label: topicLabel,
    passage,
    vocab: card.vocab,
  };
}

async function updateDataset(datasetPath: string, forceRegenerate: boolean) {
  const fileContent = await readFile(datasetPath, "utf8");
  const parsed = JSON.parse(fileContent) as unknown;
  const { cards, preserveEnvelope } = parseCardsContainer(parsed);
  let generatedCount = 0;
  let normalizedCount = 0;

  const updatedCards = cards.map((card, index) => {
    const sourceCard = assertSourceCard(card, index);
    const previousVocab = sourceCard.vocab;
    const nextVocab = normalizeExistingVocab(
      previousVocab,
      sourceCard.passage,
      sourceCard.title,
      sourceCard.topic_label,
      forceRegenerate,
    );

    if (forceRegenerate || !Array.isArray(previousVocab) || previousVocab.length === 0) {
      generatedCount += 1;
    } else {
      normalizedCount += 1;
    }

    return {
      ...card,
      vocab: nextVocab,
    };
  });

  const output = preserveEnvelope
    ? { ...(parsed as JsonObject), cards: updatedCards }
    : updatedCards;

  await writeFile(datasetPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  return {
    cardCount: updatedCards.length,
    generatedCount,
    normalizedCount,
  };
}

async function run() {
  const args = process.argv.slice(2);
  const forceRegenerate = args.includes("--force");
  const explicitPathArgs = args.filter((arg) => arg !== "--force");
  const targetPaths =
    explicitPathArgs.length > 0
      ? explicitPathArgs.map((targetPath) => path.resolve(process.cwd(), targetPath))
      : defaultDatasetPaths.map((relativePath) =>
          path.resolve(path.dirname(fileURLToPath(import.meta.url)), relativePath),
        );

  for (const datasetPath of targetPaths) {
    const result = await updateDataset(datasetPath, forceRegenerate);
    console.log(
      `Updated ${datasetPath}: ${result.cardCount} cards (${result.generatedCount} generated vocab, ${result.normalizedCount} normalized existing vocab).`,
    );
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
