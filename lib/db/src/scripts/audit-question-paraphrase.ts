import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { and, eq, inArray } from "drizzle-orm";
import { answerKeys, db, passages, pool, questions } from "../index";

type EvidenceItem = {
  sentence_index?: number;
  evidence_type?: string;
  highlight_text?: string;
  explanation_role?: string;
};

type SupportedQuestionType = "tfng" | "sentence_completion" | "short_answer";

type AuditRow = {
  bandLabel: string;
  factoryTag: string;
  passageId: string;
  title: string;
  passage: string;
  questionId: string;
  sourceQuestionId: number;
  questionTypeIndex: string;
  questionTypeLabel: string;
  prompt: string;
  answerValue: string;
  explanation: string;
  evidenceJson: unknown;
};

type SentenceRecord = {
  sentence_index: number;
  text: string;
};

type Candidate = {
  reviewKey: string;
  bandLabel: string;
  factoryTag: string;
  passageId: string;
  title: string;
  questionId: string;
  sourceQuestionId: number;
  questionTypeIndex: SupportedQuestionType;
  questionTypeLabel: string;
  prompt: string;
  answerValue: string;
  explanation: string;
  targetSentenceIndex: number | null;
  targetSentence: string;
  overlapRatio: number;
  sharedTokenCount: number;
  promptTokenCount: number;
  longestSharedPhraseWordCount: number;
  longestSharedPhrase: string;
  exactSubstringMatch: boolean;
  severity: "medium" | "high";
};

type ProgressStatus = "fixed" | "reviewed_ok" | "flagged_other";

type ProgressEntry = {
  reviewKey: string;
  status: ProgressStatus;
  bandLabel: string;
  questionTypeIndex: SupportedQuestionType;
  reviewedAt: string;
  note?: string;
  oldPrompt?: string;
  newPrompt?: string;
};

type FixInstruction = {
  reviewKey: string;
  newPrompt: string;
  note?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../");
const qcDir = path.join(repoRoot, "docs", "qc");
const progressFilePath = path.join(qcDir, "question-paraphrase-progress.ndjson");
const summaryFilePath = path.join(qcDir, "question-paraphrase-summary.json");
const batchFilePath = path.join(qcDir, "question-paraphrase-current-batch.json");

const supportedQuestionTypes: SupportedQuestionType[] = [
  "tfng",
  "sentence_completion",
  "short_answer",
];

const bandOrder = ["8.0+", "7.5", "7.0", "6.0"] as const;

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "later",
  "made",
  "mainly",
  "may",
  "more",
  "most",
  "of",
  "on",
  "or",
  "other",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "therefore",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "used",
  "using",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "with",
]);

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForComparison(value: string) {
  return normalizeSpaces(
    value
      .toLowerCase()
      .replace(/[_]+/g, " blank ")
      .replace(/[^a-z0-9\s]/g, " "),
  );
}

function tokenizeContent(value: string) {
  return normalizeForComparison(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function splitPassageIntoSentences(passage: string): SentenceRecord[] {
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

  const parsed: EvidenceItem[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const sentenceIndex = (item as { sentence_index?: unknown }).sentence_index;
    if (
      typeof sentenceIndex !== "number" ||
      !Number.isInteger(sentenceIndex) ||
      sentenceIndex < 1
    ) {
      continue;
    }
    parsed.push({
      sentence_index: sentenceIndex,
      evidence_type: typeof (item as { evidence_type?: unknown }).evidence_type === "string"
        ? ((item as { evidence_type: string }).evidence_type)
        : undefined,
      highlight_text:
        typeof (item as { highlight_text?: unknown }).highlight_text === "string"
          ? ((item as { highlight_text: string }).highlight_text)
          : undefined,
      explanation_role:
        typeof (item as { explanation_role?: unknown }).explanation_role === "string"
          ? ((item as { explanation_role: string }).explanation_role)
          : undefined,
    });
  }

  return parsed;
}

function deriveTargetSentence(
  row: AuditRow,
  sentences: SentenceRecord[],
): { sentence: SentenceRecord | null; overlapRatio: number } {
  const evidence = parseEvidenceJson(row.evidenceJson);
  const evidenceIndexes = new Set<number>();
  for (const item of evidence) {
    if (typeof item.sentence_index === "number") {
      evidenceIndexes.add(item.sentence_index);
    }
  }

  const candidateSentences =
    evidenceIndexes.size > 0
      ? sentences.filter((sentence) => evidenceIndexes.has(sentence.sentence_index))
      : sentences;

  let bestSentence: SentenceRecord | null = null;
  let bestOverlap = -1;

  for (const sentence of candidateSentences) {
    const overlap = computeOverlapRatio(row.prompt, sentence.text);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestSentence = sentence;
    }
  }

  return {
    sentence: bestSentence,
    overlapRatio: bestOverlap < 0 ? 0 : bestOverlap,
  };
}

function computeOverlapRatio(prompt: string, sentence: string) {
  const promptTokens = tokenizeContent(prompt);
  const sentenceTokenSet = new Set(tokenizeContent(sentence));
  if (promptTokens.length === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of promptTokens) {
    if (sentenceTokenSet.has(token)) {
      shared += 1;
    }
  }

  return shared / promptTokens.length;
}

function longestSharedPhrase(prompt: string, sentence: string) {
  const promptTokens = normalizeForComparison(prompt).split(/\s+/).filter(Boolean);
  const sentenceTokens = normalizeForComparison(sentence).split(/\s+/).filter(Boolean);
  let bestStart = -1;
  let bestLength = 0;

  for (let promptIndex = 0; promptIndex < promptTokens.length; promptIndex += 1) {
    for (let sentenceIndex = 0; sentenceIndex < sentenceTokens.length; sentenceIndex += 1) {
      let length = 0;
      while (
        promptTokens[promptIndex + length] &&
        promptTokens[promptIndex + length] === sentenceTokens[sentenceIndex + length]
      ) {
        length += 1;
      }
      if (length > bestLength) {
        bestLength = length;
        bestStart = promptIndex;
      }
    }
  }

  return {
    wordCount: bestLength,
    phrase:
      bestStart >= 0 && bestLength > 0
        ? promptTokens.slice(bestStart, bestStart + bestLength).join(" ")
        : "",
  };
}

function isExactSubstringMatch(prompt: string, sentence: string) {
  const normalizedPrompt = normalizeForComparison(prompt);
  const normalizedSentence = normalizeForComparison(sentence);
  if (normalizedPrompt.length < 24) {
    return false;
  }
  return normalizedSentence.includes(normalizedPrompt);
}

function candidateSeverity(candidate: Candidate): "medium" | "high" {
  if (
    candidate.exactSubstringMatch ||
    candidate.longestSharedPhraseWordCount >= 5 ||
    candidate.overlapRatio >= 0.82
  ) {
    return "high";
  }
  return "medium";
}

function shouldFlagCandidate(candidate: Candidate) {
  if (candidate.exactSubstringMatch) {
    return true;
  }
  if (candidate.longestSharedPhraseWordCount >= 5) {
    return true;
  }
  if (
    candidate.overlapRatio >= 0.72 &&
    candidate.longestSharedPhraseWordCount >= 3
  ) {
    return true;
  }
  if (
    candidate.questionTypeIndex !== "tfng" &&
    candidate.overlapRatio >= 0.66 &&
    candidate.sharedTokenCount >= 5
  ) {
    return true;
  }
  return false;
}

function reviewKeyForRow(row: {
  passageId: string;
  sourceQuestionId: number;
}) {
  return `${row.passageId}::q${row.sourceQuestionId}`;
}

async function ensureQcDir() {
  await fs.mkdir(qcDir, { recursive: true });
}

async function readProgressMap() {
  try {
    const raw = await fs.readFile(progressFilePath, "utf8");
    const map = new Map<string, ProgressEntry>();
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const entry = JSON.parse(trimmed) as ProgressEntry;
      map.set(entry.reviewKey, entry);
    }
    return map;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Map<string, ProgressEntry>();
    }
    throw error;
  }
}

async function appendProgressEntries(entries: ProgressEntry[]) {
  if (entries.length === 0) {
    return;
  }
  await ensureQcDir();
  const payload = `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
  await fs.appendFile(progressFilePath, payload, "utf8");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const bandArg = args.find((arg) => arg.startsWith("--band="));
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const applyFixesArg = args.find((arg) => arg.startsWith("--apply-fixes="));
  const summary = args.includes("--summary");

  const band = bandArg?.slice("--band=".length) ?? "8.0+";
  const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : 40;
  const applyFixesPath = applyFixesArg?.slice("--apply-fixes=".length);

  if (!bandOrder.includes(band as (typeof bandOrder)[number])) {
    throw new Error(`Unsupported band: ${band}`);
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer.");
  }

  return {
    band,
    limit,
    applyFixesPath,
    summary,
  };
}

async function loadRowsForBand(band: string) {
  return db
    .select({
      bandLabel: passages.bandLabel,
      factoryTag: passages.factoryTag,
      passageId: passages.id,
      title: passages.title,
      passage: passages.passage,
      questionId: questions.id,
      sourceQuestionId: questions.sourceQuestionId,
      questionTypeIndex: questions.questionTypeIndex,
      questionTypeLabel: questions.questionTypeLabel,
      prompt: questions.prompt,
      answerValue: answerKeys.answerValue,
      explanation: answerKeys.explanation,
      evidenceJson: answerKeys.evidenceJson,
    })
    .from(passages)
    .innerJoin(questions, eq(questions.passageId, passages.id))
    .innerJoin(answerKeys, eq(answerKeys.questionId, questions.id))
    .where(
      and(
        eq(passages.status, "active"),
        eq(passages.bandLabel, band),
        inArray(questions.questionTypeIndex, supportedQuestionTypes),
      ),
    );
}

function buildCandidate(row: AuditRow): Candidate | null {
  if (!supportedQuestionTypes.includes(row.questionTypeIndex as SupportedQuestionType)) {
    return null;
  }

  const sentences = splitPassageIntoSentences(row.passage);
  const { sentence, overlapRatio } = deriveTargetSentence(row, sentences);
  const targetSentence = sentence?.text ?? "";
  const promptTokens = tokenizeContent(row.prompt);
  const targetTokenSet = new Set(tokenizeContent(targetSentence));
  let sharedTokenCount = 0;
  for (const token of promptTokens) {
    if (targetTokenSet.has(token)) {
      sharedTokenCount += 1;
    }
  }
  const sharedPhrase = longestSharedPhrase(row.prompt, targetSentence);
  const exactSubstringMatch = isExactSubstringMatch(row.prompt, targetSentence);

  const candidate: Candidate = {
    reviewKey: reviewKeyForRow(row),
    bandLabel: row.bandLabel,
    factoryTag: row.factoryTag,
    passageId: row.passageId,
    title: row.title,
    questionId: row.questionId,
    sourceQuestionId: row.sourceQuestionId,
    questionTypeIndex: row.questionTypeIndex as SupportedQuestionType,
    questionTypeLabel: row.questionTypeLabel,
    prompt: row.prompt,
    answerValue: row.answerValue,
    explanation: row.explanation,
    targetSentenceIndex: sentence?.sentence_index ?? null,
    targetSentence,
    overlapRatio,
    sharedTokenCount,
    promptTokenCount: promptTokens.length,
    longestSharedPhraseWordCount: sharedPhrase.wordCount,
    longestSharedPhrase: sharedPhrase.phrase,
    exactSubstringMatch,
    severity: "medium",
  };

  candidate.severity = candidateSeverity(candidate);
  return candidate;
}

function summarizeCandidates(
  candidates: Candidate[],
  progressMap: Map<string, ProgressEntry>,
) {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const candidate of candidates) {
    byType[candidate.questionTypeIndex] = (byType[candidate.questionTypeIndex] ?? 0) + 1;
    const status = progressMap.get(candidate.reviewKey)?.status ?? "pending";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  return {
    totalFlagged: candidates.length,
    byType,
    byStatus,
  };
}

function summarizeLedgerForBand(
  progressMap: Map<string, ProgressEntry>,
  bandLabel: string,
) {
  const byStatus: Record<string, number> = {};
  let total = 0;

  for (const entry of progressMap.values()) {
    if (entry.bandLabel !== bandLabel) {
      continue;
    }
    total += 1;
    byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1;
  }

  return {
    totalReviewed: total,
    byStatus,
  };
}

async function writeSummaryFile(summary: Record<string, unknown>) {
  await ensureQcDir();
  await fs.writeFile(summaryFilePath, JSON.stringify(summary, null, 2), "utf8");
}

async function writeBatchFile(candidates: Candidate[]) {
  await ensureQcDir();
  await fs.writeFile(batchFilePath, JSON.stringify(candidates, null, 2), "utf8");
}

async function applyFixes(fixFilePath: string, progressMap: Map<string, ProgressEntry>) {
  const raw = await fs.readFile(path.resolve(fixFilePath), "utf8");
  const instructions = JSON.parse(raw) as FixInstruction[];
  if (!Array.isArray(instructions) || instructions.length === 0) {
    throw new Error("Fix file must be a non-empty JSON array.");
  }

  const reviewKeys = instructions.map((instruction) => instruction.reviewKey);
  const rows = await db
    .select({
      bandLabel: passages.bandLabel,
      passageId: passages.id,
      questionId: questions.id,
      sourceQuestionId: questions.sourceQuestionId,
      questionTypeIndex: questions.questionTypeIndex,
      prompt: questions.prompt,
    })
    .from(passages)
    .innerJoin(questions, eq(questions.passageId, passages.id))
    .where(
      and(
        eq(passages.status, "active"),
        inArray(questions.id, reviewKeys),
      ),
    );

  const rowMap = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    rowMap.set(reviewKeyForRow(row), row);
  }

  const progressEntries: ProgressEntry[] = [];

  await db.transaction(async (tx) => {
    for (const instruction of instructions) {
      const row = rowMap.get(instruction.reviewKey);
      if (!row) {
        throw new Error(`Could not find question for ${instruction.reviewKey}`);
      }
      const normalizedNewPrompt = normalizeSpaces(instruction.newPrompt);
      if (!normalizedNewPrompt || normalizedNewPrompt === row.prompt.trim()) {
        throw new Error(`Invalid or unchanged prompt for ${instruction.reviewKey}`);
      }

      await tx
        .update(questions)
        .set({
          prompt: normalizedNewPrompt,
          updatedAt: new Date(),
        })
        .where(eq(questions.id, row.questionId));

      progressEntries.push({
        reviewKey: instruction.reviewKey,
        status: "fixed",
        bandLabel: row.bandLabel,
        questionTypeIndex: row.questionTypeIndex as SupportedQuestionType,
        reviewedAt: new Date().toISOString(),
        note: instruction.note,
        oldPrompt: row.prompt,
        newPrompt: normalizedNewPrompt,
      });
    }
  });

  await appendProgressEntries(progressEntries);
  for (const entry of progressEntries) {
    progressMap.set(entry.reviewKey, entry);
  }

  return progressEntries;
}

async function run() {
  const { band, limit, applyFixesPath, summary } = parseArgs();
  await ensureQcDir();
  const progressMap = await readProgressMap();

  if (applyFixesPath) {
    const applied = await applyFixes(applyFixesPath, progressMap);
    console.log(`Applied fixes: ${applied.length}`);
    for (const entry of applied) {
      console.log(`[fixed] ${entry.reviewKey} | ${entry.oldPrompt} -> ${entry.newPrompt}`);
    }
  }

  const rows = (await loadRowsForBand(band)) as AuditRow[];
  const candidates = rows
    .map(buildCandidate)
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .filter(shouldFlagCandidate)
    .sort((left, right) => {
      const severityDiff =
        (right.severity === "high" ? 1 : 0) - (left.severity === "high" ? 1 : 0);
      if (severityDiff !== 0) {
        return severityDiff;
      }
      if (right.overlapRatio !== left.overlapRatio) {
        return right.overlapRatio - left.overlapRatio;
      }
      if (right.longestSharedPhraseWordCount !== left.longestSharedPhraseWordCount) {
        return right.longestSharedPhraseWordCount - left.longestSharedPhraseWordCount;
      }
      return left.reviewKey.localeCompare(right.reviewKey);
    });

  const unresolved = candidates.filter((candidate) => {
    const status = progressMap.get(candidate.reviewKey)?.status;
    return status !== "fixed" && status !== "reviewed_ok";
  });

  const nextBatch = unresolved.slice(0, limit);
  await writeBatchFile(nextBatch);

  const summaryPayload = {
    generatedAt: new Date().toISOString(),
    currentBand: band,
    totalRowsScanned: rows.length,
    ...summarizeCandidates(candidates, progressMap),
    ledger: summarizeLedgerForBand(progressMap, band),
    nextBatchCount: nextBatch.length,
    nextBands: bandOrder.slice(bandOrder.indexOf(band as (typeof bandOrder)[number]) + 1),
  };
  await writeSummaryFile(summaryPayload);

  if (summary) {
    console.log(JSON.stringify(summaryPayload, null, 2));
    return;
  }

  console.log(`Band: ${band}`);
  console.log(`Rows scanned: ${rows.length}`);
  console.log(`Flagged candidates: ${candidates.length}`);
  console.log(`Unresolved candidates: ${unresolved.length}`);
  console.log(`Wrote batch: ${batchFilePath}`);
  for (const candidate of nextBatch) {
    console.log(
      `[${candidate.severity}] ${candidate.reviewKey} | ${candidate.questionTypeLabel} | overlap=${candidate.overlapRatio.toFixed(
        2,
      )} | phrase="${candidate.longestSharedPhrase}"`,
    );
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  run()
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    })
    .finally(async () => {
      await pool.end();
    });
}
