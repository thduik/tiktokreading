import {
  ANSWER_STAT_BAND_GROUP_VALUES,
  ANSWER_STAT_QUESTION_TYPE_VALUES,
  type AnswerStatBandGroup,
  type AnswerStatQuestionType,
} from "@workspace/db/schema";

export {
  ANSWER_STAT_BAND_GROUP_VALUES,
  ANSWER_STAT_QUESTION_TYPE_VALUES,
  type AnswerStatBandGroup,
  type AnswerStatQuestionType,
};

export type AnswerStatsRow = {
  bandGroup: AnswerStatBandGroup;
  questionType: AnswerStatQuestionType;
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
};

export type AnswerStatCell = {
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
};

export type AnswerStatsPeriod = {
  overall: AnswerStatCell;
  byBandAndType: Partial<
    Record<AnswerStatBandGroup, Partial<Record<AnswerStatQuestionType, AnswerStatCell>>>
  >;
};

export function formatDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysToDateKey(dateKey: string, dayDelta: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dayDelta);
  return formatDateKey(date);
}

export function normalizeLocalDateKey(raw: unknown) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return raw;
}

export function readLocalDateKey(raw: unknown) {
  return normalizeLocalDateKey(raw) ?? formatDateKey(new Date());
}

export function normalizeAnswerStatBandGroup(
  bandLabel: string | number,
): AnswerStatBandGroup {
  const normalized = String(bandLabel).trim().toLowerCase();

  if (normalized === "6" || normalized === "6.0" || normalized === "band 6.0") {
    return "Band6";
  }
  if (normalized === "7" || normalized === "7.0" || normalized === "band 7.0") {
    return "Band7";
  }
  if (
    normalized === "7.5" ||
    normalized === "band 7.5" ||
    normalized === "75"
  ) {
    return "Band75";
  }

  return "Band8Plus";
}

export function normalizeAnswerStatQuestionType({
  questionTypeIndex,
  questionTypeLabel,
}: {
  questionTypeIndex: string;
  questionTypeLabel: string;
}): AnswerStatQuestionType {
  const label = questionTypeLabel.trim().toLowerCase();
  if (label.includes("matching")) {
    return "Matching";
  }

  if (questionTypeIndex === "tfng") {
    return "TFNG";
  }
  if (questionTypeIndex === "sentence_completion") {
    return "SentenceCompletion";
  }
  if (questionTypeIndex === "short_answer") {
    return "ShortAnswer";
  }

  return "MCQ";
}

export function toAccuracy(correct: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((correct / total) * 1000) / 10;
}

export function toAnswerStatCell(row: {
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
}): AnswerStatCell {
  return {
    total: row.attemptCount,
    correct: row.correctCount,
    wrong: row.wrongCount,
    accuracy: toAccuracy(row.correctCount, row.attemptCount),
  };
}

export function buildAnswerStatsPeriod(rows: AnswerStatsRow[]): AnswerStatsPeriod {
  const byBandAndType: AnswerStatsPeriod["byBandAndType"] = {};
  const overall = {
    attemptCount: 0,
    correctCount: 0,
    wrongCount: 0,
  };

  for (const row of rows) {
    overall.attemptCount += row.attemptCount;
    overall.correctCount += row.correctCount;
    overall.wrongCount += row.wrongCount;

    const bandStats = byBandAndType[row.bandGroup] ?? {};
    bandStats[row.questionType] = toAnswerStatCell(row);
    byBandAndType[row.bandGroup] = bandStats;
  }

  return {
    overall: toAnswerStatCell(overall),
    byBandAndType,
  };
}
