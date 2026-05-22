import { and, eq, inArray } from "drizzle-orm";
import { answerKeys, db, passages, pool, questions } from "../index";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { promisify } from "node:util";
import { manualTwoKeyMcqOverrides } from "./repair-v5-plus-multi-key-mcq.overrides";

const execFile = promisify(execFileCallback);

type CandidateRow = {
  passageId: string;
  passageTitle: string;
  factoryTag: string;
  questionId: string;
  sourceQuestionId: number;
  prompt: string;
  instructionLabel: string;
  answerKeyId: string;
  answerValue: string;
  acceptedValues: string[] | null;
  explanation: string;
};

type RepairCandidate = CandidateRow & {
  parsedKeys: string[];
  canonicalAnswer: string;
  acceptedVariants: string[];
  source: "parsed" | "manual_override";
};

type SkippedCandidate = CandidateRow & {
  reason: string;
};

const OPTION_KEY_ORDER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const execRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");

function parseFactoryTagVersion(factoryTag: string) {
  const match = factoryTag.trim().match(/^v(\d+)(?:_(\d+))?$/i);
  if (!match) {
    return null;
  }

  const major = Number(match[1]);
  if (!Number.isFinite(major)) {
    return null;
  }

  if (!match[2]) {
    return major;
  }

  const minorDigits = match[2];
  const minor = Number(minorDigits);
  if (!Number.isFinite(minor)) {
    return null;
  }

  return major + minor / 10 ** minorDigits.length;
}

function isV5PlusFactoryTag(factoryTag: string) {
  const version = parseFactoryTagVersion(factoryTag);
  return version !== null && version >= 5;
}

function normalizeOptionKeyToken(value: string) {
  const normalized = value
    .trim()
    .replace(/^\d+\s*[.)\-:]\s*/g, "")
    .toUpperCase();
  const match = normalized.match(/^([A-Z])/);
  return match ? match[1] : null;
}

function sortOptionKeys(values: string[]) {
  const unique = [...new Set(values)];
  return unique.sort((left, right) => {
    const leftIndex = OPTION_KEY_ORDER.indexOf(left);
    const rightIndex = OPTION_KEY_ORDER.indexOf(right);
    return leftIndex - rightIndex || left.localeCompare(right);
  });
}

function formatOptionKeys(values: string[]) {
  return sortOptionKeys(values).join(", ");
}

function buildAcceptedVariants(keys: string[]) {
  const ordered = sortOptionKeys(keys);
  if (ordered.length !== 2) {
    return [formatOptionKeys(ordered)];
  }

  const [first, second] = ordered;
  return [formatOptionKeys(ordered), `${first} and ${second}`];
}

function indicatesChooseTwo(prompt: string, instructionLabel: string) {
  const combined = `${prompt} ${instructionLabel}`.toUpperCase();
  return (
    combined.includes("CHOOSE TWO") ||
    combined.includes("WHICH TWO") ||
    combined.includes("SELECT TWO") ||
    combined.includes("TWO OPTIONS")
  );
}

export function parseTwoOptionKeysFromExplanation(explanation: string) {
  const normalized = explanation.replace(/\s+/g, " ").trim();

  const pairPatterns = [
    /\b([A-H])\s*(?:,|and)\s*([A-H])\s+are correct\b/gi,
    /\bcorrect answers?\s+(?:are|is)\s+([A-H])\s*(?:,|and)\s*([A-H])\b/gi,
  ];

  for (const pattern of pairPatterns) {
    const matches = [...normalized.matchAll(pattern)];
    for (const match of matches) {
      const keys = sortOptionKeys(
        [normalizeOptionKeyToken(match[1]), normalizeOptionKeyToken(match[2])].filter(
          (value): value is string => Boolean(value),
        ),
      );
      if (keys.length === 2) {
        return keys;
      }
    }
  }

  const singleCorrectMatches = [
    ...normalized.matchAll(/\b([A-H])\s+(?:is|are)\s+(?:also\s+)?correct\b/gi),
  ]
    .map((match) => normalizeOptionKeyToken(match[1]))
    .filter((value): value is string => Boolean(value));

  const keys = sortOptionKeys(singleCorrectMatches);
  return keys.length === 2 ? keys : null;
}

async function fetchCandidates() {
  const rows = await db
    .select({
      passageId: passages.id,
      passageTitle: passages.title,
      factoryTag: passages.factoryTag,
      questionId: questions.id,
      sourceQuestionId: questions.sourceQuestionId,
      prompt: questions.prompt,
      questionPayload: questions.questionPayloadJson,
      answerKeyId: answerKeys.id,
      answerValue: answerKeys.answerValue,
      acceptedValues: answerKeys.acceptedValuesJson,
      explanation: answerKeys.explanation,
    })
    .from(answerKeys)
    .innerJoin(questions, eq(answerKeys.questionId, questions.id))
    .innerJoin(passages, eq(questions.passageId, passages.id))
    .where(
      and(eq(questions.questionTypeIndex, "mcq"), eq(answerKeys.answerType, "option_key")),
    );

  return rows
    .map((row) => {
      const payload = row.questionPayload as Record<string, unknown>;
      return {
        passageId: row.passageId,
        passageTitle: row.passageTitle,
        factoryTag: row.factoryTag,
        questionId: row.questionId,
        sourceQuestionId: row.sourceQuestionId,
        prompt: row.prompt,
        instructionLabel:
          typeof payload.instruction_label === "string" ? payload.instruction_label : "",
        answerKeyId: row.answerKeyId,
        answerValue: row.answerValue,
        acceptedValues: row.acceptedValues,
        explanation: row.explanation,
      } satisfies CandidateRow;
    })
    .filter(
      (row) =>
        isV5PlusFactoryTag(row.factoryTag) &&
        indicatesChooseTwo(row.prompt, row.instructionLabel) &&
        /^[A-H]$/i.test(row.answerValue.trim()),
    );
}

export async function analyzeRepairCandidates() {
  const candidates = await fetchCandidates();
  const repairs: RepairCandidate[] = [];
  const skipped: SkippedCandidate[] = [];

  for (const candidate of candidates) {
    const overrideKey = `${candidate.passageTitle}::${candidate.sourceQuestionId}` as keyof typeof manualTwoKeyMcqOverrides;
    const manualOverride = manualTwoKeyMcqOverrides[overrideKey];
    const parsedKeys = manualOverride
      ? [...manualOverride]
      : parseTwoOptionKeysFromExplanation(candidate.explanation);
    if (!parsedKeys) {
      skipped.push({
        ...candidate,
        reason: "explanation_did_not_yield_exactly_two_correct_keys",
      });
      continue;
    }

    repairs.push({
      ...candidate,
      parsedKeys,
      canonicalAnswer: formatOptionKeys(parsedKeys),
      acceptedVariants: buildAcceptedVariants(parsedKeys),
      source: manualOverride ? "manual_override" : "parsed",
    });
  }

  return { candidates, repairs, skipped };
}

async function refreshPassageCaches() {
  const commands = [
    [
      "corepack",
      "pnpm",
      "--filter",
      "@workspace/api-server",
      "exec",
      "tsx",
      "./src/scripts/invalidate-passage-cache.ts",
    ],
    [
      "corepack",
      "pnpm",
      "--filter",
      "@workspace/api-server",
      "exec",
      "tsx",
      "./src/scripts/refresh-passage-search-catalog.ts",
    ],
  ];

  for (const [command, ...args] of commands) {
    const { stdout } = await execFile(command, args, {
      cwd: execRepoRoot,
      env: process.env,
    });
    if (stdout.trim()) {
      console.log(stdout.trim());
    }
  }
}

async function applyRepairs(repairs: RepairCandidate[]) {
  if (repairs.length === 0) {
    return { updatedRows: 0, touchedPassages: 0 };
  }

  const touchedPassageIds = [...new Set(repairs.map((repair) => repair.passageId))];
  await db.transaction(async (tx) => {
    for (const repair of repairs) {
      await tx
        .update(answerKeys)
        .set({
          answerValue: repair.canonicalAnswer,
          acceptedValuesJson: repair.acceptedVariants,
          updatedAt: new Date(),
        })
        .where(eq(answerKeys.id, repair.answerKeyId));
    }

    await tx
      .update(passages)
      .set({
        updatedAt: new Date(),
      })
      .where(inArray(passages.id, touchedPassageIds));
  });

  await refreshPassageCaches();
  return { updatedRows: repairs.length, touchedPassages: touchedPassageIds.length };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { candidates, repairs, skipped } = await analyzeRepairCandidates();

  console.log(`v5+ choose-two MCQ candidates: ${candidates.length}`);
  console.log(`repairable: ${repairs.length}`);
  console.log(`skipped: ${skipped.length}`);

  for (const repair of repairs.slice(0, 12)) {
    console.log(
      `[repair] ${repair.factoryTag} | ${repair.passageTitle} | Q${repair.sourceQuestionId} | ${repair.answerValue} -> ${repair.canonicalAnswer}`,
    );
  }

  for (const skip of skipped.slice(0, 12)) {
    console.log(
      `[skip:${skip.reason}] ${skip.factoryTag} | ${skip.passageTitle} | Q${skip.sourceQuestionId} | answer=${skip.answerValue}`,
    );
  }

  if (!apply) {
    console.log("dry-run only (pass --apply to write updates)");
    return;
  }

  const result = await applyRepairs(repairs);
  console.log(
    `applied repairs: ${result.updatedRows} answer keys across ${result.touchedPassages} passages`,
  );
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
