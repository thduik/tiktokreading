import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type VocabItem = {
  term: string;
  definition: string;
  simple_meaning_en?: string;
  example_sentence_en?: string;
  meaning_vi?: string;
  sentence_index?: number;
};

type PassageCard = {
  id: string;
  title: string;
  topic_label: string;
  passage: string;
  vocab?: VocabItem[];
};

const DATASET_PATHS = [
  "../../../../artifacts/readtok/src/lib/reading-material-db.v2.json",
  "../../../../artifacts/readtok/src/lib/reading-material-db.v2.additions.json",
  "../../../../artifacts/readtok/src/lib/reading-material-db.v2.stitched-8plus.json",
];

function splitPassageIntoSentences(passage: string) {
  return passage
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length > 0);
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function capSentence(value: string, maxLength = 200) {
  const compact = normalizeSpaces(value);
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

function findSentenceForTerm(
  sentences: string[],
  term: string,
  sentenceIndex?: number,
) {
  if (
    sentenceIndex !== undefined &&
    sentenceIndex >= 1 &&
    sentenceIndex <= sentences.length
  ) {
    return sentences[sentenceIndex - 1];
  }

  const normalizedTerm = term.toLowerCase().trim();
  const sentence = sentences.find((item) =>
    item.toLowerCase().includes(normalizedTerm),
  );
  return sentence ?? null;
}

function simplifyDefinition(definition: string, term: string) {
  const compact = normalizeSpaces(definition);
  if (compact.length === 0) {
    return `${term} is an important IELTS reading phrase.`;
  }

  const sentenceStopIndex = compact.search(/[.;]/);
  const base =
    sentenceStopIndex > 0 ? compact.slice(0, sentenceStopIndex) : compact;
  const withNoLeadingQuote = base.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  const short = withNoLeadingQuote.length > 130
    ? `${withNoLeadingQuote.slice(0, 127).trimEnd()}...`
    : withNoLeadingQuote;

  if (short.toLowerCase().includes(term.toLowerCase())) {
    return short;
  }

  return `${term}: ${short}`;
}

function buildExampleSentence(
  term: string,
  cardTitle: string,
  fallbackSentence: string | null,
) {
  if (fallbackSentence && fallbackSentence.length > 0) {
    const normalized = capSentence(fallbackSentence);
    if (normalized.toLowerCase().includes(term.toLowerCase())) {
      return normalized;
    }
    return capSentence(`In this passage, ${term} appears in context: ${normalized}`);
  }

  return `In the ${cardTitle} passage, ${term} is used in context.`;
}

function ensureCardArray(input: unknown): PassageCard[] {
  if (Array.isArray(input)) {
    return input as PassageCard[];
  }

  if (
    typeof input === "object" &&
    input !== null &&
    "cards" in input &&
    Array.isArray((input as { cards?: unknown }).cards)
  ) {
    return (input as { cards: PassageCard[] }).cards;
  }

  throw new Error("Input JSON must be an array or { cards: [...] }.");
}

async function processDataset(datasetPath: string) {
  const raw = await readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const cards = ensureCardArray(parsed);

  let updatedItems = 0;
  let totalItems = 0;

  for (const card of cards) {
    const sentences = splitPassageIntoSentences(card.passage);
    const vocabItems = Array.isArray(card.vocab) ? card.vocab : [];

    for (const vocabItem of vocabItems) {
      totalItems += 1;
      const term = normalizeSpaces(vocabItem.term);
      const definition = normalizeSpaces(vocabItem.definition);
      const contextSentence = findSentenceForTerm(
        sentences,
        term,
        vocabItem.sentence_index,
      );

      const nextSimpleMeaning = simplifyDefinition(definition, term);
      const nextExampleSentence = buildExampleSentence(
        term,
        card.title,
        contextSentence,
      );

      const prevSimple = vocabItem.simple_meaning_en ?? "";
      const prevExample = vocabItem.example_sentence_en ?? "";

      vocabItem.simple_meaning_en = nextSimpleMeaning;
      vocabItem.example_sentence_en = nextExampleSentence;

      if (
        prevSimple !== vocabItem.simple_meaning_en ||
        prevExample !== vocabItem.example_sentence_en
      ) {
        updatedItems += 1;
      }
    }
  }

  await writeFile(datasetPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return { cardCount: cards.length, totalItems, updatedItems };
}

async function run() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const resolvedPaths = DATASET_PATHS.map((datasetPath) =>
    path.resolve(scriptDir, datasetPath),
  );

  let totalCards = 0;
  let totalItems = 0;
  let totalUpdated = 0;

  for (const datasetPath of resolvedPaths) {
    const result = await processDataset(datasetPath);
    totalCards += result.cardCount;
    totalItems += result.totalItems;
    totalUpdated += result.updatedItems;
    console.log(
      `Updated ${datasetPath}: ${result.cardCount} cards, ${result.updatedItems}/${result.totalItems} vocab items refreshed.`,
    );
  }

  console.log(
    `Enrichment complete: ${totalCards} cards, ${totalUpdated}/${totalItems} vocab items updated.`,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

