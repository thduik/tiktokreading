import type { PassageAnswerKey } from "@/lib/passages-api";

const OPTION_KEY_ORDER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const OPTION_KEY_RANK = new Map(OPTION_KEY_ORDER.map((key, index) => [key, index]));

function normalizeOptionKeyToken(value: string) {
  const normalized = value
    .trim()
    .replace(/^\d+\s*[.)\-:]\s*/g, "")
    .toUpperCase();
  const match = normalized.match(/^([A-Z])/);
  return match ? match[1] : null;
}

function sortOptionKeys(values: string[]) {
  return [...values].sort((left, right) => {
    const leftRank = OPTION_KEY_RANK.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = OPTION_KEY_RANK.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.localeCompare(right);
  });
}

export function splitOptionKeyAnswer(value: string) {
  if (!value.trim()) {
    return [];
  }

  const normalized = value
    .replace(/\band\b/gi, ",")
    .replace(/[&/;+]/g, ",")
    .replace(/\s*,\s*/g, ",");

  const uniqueKeys = new Set<string>();
  for (const part of normalized.split(",")) {
    const key = normalizeOptionKeyToken(part);
    if (key) {
      uniqueKeys.add(key);
    }
  }

  return sortOptionKeys([...uniqueKeys]);
}

export function formatOptionKeyAnswer(value: string | string[]) {
  const keys = Array.isArray(value)
    ? sortOptionKeys([...new Set(value.map((item) => normalizeOptionKeyToken(item) ?? "").filter(Boolean))])
    : splitOptionKeyAnswer(value);

  return keys.join(", ");
}

function getOptionKeyAnswerVariants(answerKey: PassageAnswerKey) {
  if (answerKey.answer_type !== "option_key") {
    return [];
  }

  const variants = [answerKey.answer_value];
  if (Array.isArray(answerKey.accepted_values)) {
    variants.push(...answerKey.accepted_values);
  }

  return variants.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export function getExpectedOptionSelectionCount(answerKey?: PassageAnswerKey) {
  if (!answerKey || answerKey.answer_type !== "option_key") {
    return 1;
  }

  const counts = getOptionKeyAnswerVariants(answerKey)
    .map((variant) => splitOptionKeyAnswer(variant).length)
    .filter((count) => count > 0);

  return counts.length > 0 ? Math.max(...counts) : 1;
}

export function isOptionKeyAnswerCorrect(
  answerKey: PassageAnswerKey | undefined,
  userAnswer: string,
) {
  if (!answerKey || answerKey.answer_type !== "option_key") {
    return false;
  }

  const normalizedUserAnswer = formatOptionKeyAnswer(userAnswer);
  if (!normalizedUserAnswer) {
    return false;
  }

  return getOptionKeyAnswerVariants(answerKey).some(
    (variant) => formatOptionKeyAnswer(variant) === normalizedUserAnswer,
  );
}

export function resolveOptionKeyAnswerForScoring(
  answerKey: PassageAnswerKey | undefined,
  userAnswer: string,
) {
  const normalizedUserAnswer = formatOptionKeyAnswer(userAnswer);
  if (!answerKey || answerKey.answer_type !== "option_key") {
    return normalizedUserAnswer || userAnswer.trim();
  }

  const matchingVariant = getOptionKeyAnswerVariants(answerKey).find(
    (variant) => formatOptionKeyAnswer(variant) === normalizedUserAnswer,
  );

  return matchingVariant ?? normalizedUserAnswer ?? userAnswer.trim();
}
