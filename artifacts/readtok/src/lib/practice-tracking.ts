import {
  QUESTION_TYPES,
  normalizeQuestionType,
  type QuestionType,
} from "@/lib/achievements"

export const SESSION_SUMMARY_INTERVAL = 10
export const SESSION_STREAK_BONUS_STREAK = 10
export const SESSION_STREAK_BONUS_LP = 10
export const MAX_STORED_MISTAKES = 100
export const MAX_MISTAKE_TITLE_LENGTH = 140
export const MAX_MISTAKE_PROMPT_LENGTH = 360
export const MAX_MISTAKE_ANSWER_LENGTH = 240

export const QUESTION_TYPE_DISPLAY_LABELS: Record<QuestionType, string> = {
  MCQ: "MCQ",
  TFNG: "TFNG",
  SentenceCompletion: "Sentence Completion",
  ShortAnswer: "Short Answer",
  Matching: "Matching",
}

type SessionQuestionTypeProgress = Record<
  QuestionType,
  {
    attempted: number
    correct: number
  }
>

export interface SessionSummarySnapshot {
  answered: number
  correct: number
  incorrect: number
  accuracyPercent: number
  lpDeltaTotal: number
  lpBonusTotal: number
  xpDeltaTotal: number
  bestType: QuestionType | null
  weakType: QuestionType | null
  bestStreak: number
}

export interface SessionSummaryProgress {
  answered: number
  correct: number
  lpDeltaTotal: number
  lpBonusTotal: number
  xpDeltaTotal: number
  currentCorrectStreak: number
  bestCorrectStreak: number
  questionTypes: SessionQuestionTypeProgress
}

export interface SessionAnswerResultInput {
  isCorrect: boolean
  xpDelta: number
  lpDelta: number
  questionType?: string
}

export interface MistakeEntry {
  id: string
  passageId: string
  questionId: number
  passageTitle: string
  questionPrompt: string
  band: string
  type: string
  userAnswer: string
  correctAnswer: string
  createdAt: string
}

function compactText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : ""
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text
}

function zeroQuestionTypeProgress(): SessionQuestionTypeProgress {
  return {
    MCQ: { attempted: 0, correct: 0 },
    TFNG: { attempted: 0, correct: 0 },
    SentenceCompletion: { attempted: 0, correct: 0 },
    ShortAnswer: { attempted: 0, correct: 0 },
    Matching: { attempted: 0, correct: 0 },
  }
}

export const defaultSessionSummaryProgress: SessionSummaryProgress = {
  answered: 0,
  correct: 0,
  lpDeltaTotal: 0,
  lpBonusTotal: 0,
  xpDeltaTotal: 0,
  currentCorrectStreak: 0,
  bestCorrectStreak: 0,
  questionTypes: zeroQuestionTypeProgress(),
}

export function normalizePracticeQuestionType(value?: string | null) {
  if (!value) {
    return null
  }
  return normalizeQuestionType(value)
}

function pickTypeByAccuracy(
  questionTypes: SessionQuestionTypeProgress,
  direction: "best" | "weak",
) {
  const activeTypes = QUESTION_TYPES
    .map((type) => ({
      type,
      attempted: questionTypes[type].attempted,
      correct: questionTypes[type].correct,
      wrong: questionTypes[type].attempted - questionTypes[type].correct,
      accuracy:
        questionTypes[type].attempted > 0
          ? questionTypes[type].correct / questionTypes[type].attempted
          : 0,
    }))
    .filter((entry) => entry.attempted > 0)

  if (activeTypes.length === 0) {
    return null
  }

  activeTypes.sort((left, right) => {
    if (direction === "best") {
      if (right.accuracy !== left.accuracy) {
        return right.accuracy - left.accuracy
      }
      if (right.correct !== left.correct) {
        return right.correct - left.correct
      }
      return right.attempted - left.attempted
    }

    if (left.accuracy !== right.accuracy) {
      return left.accuracy - right.accuracy
    }
    if (right.wrong !== left.wrong) {
      return right.wrong - left.wrong
    }
    return right.attempted - left.attempted
  })

  return activeTypes[0]?.type ?? null
}

function buildSessionSummarySnapshot(
  progress: SessionSummaryProgress,
): SessionSummarySnapshot {
  const incorrect = Math.max(0, progress.answered - progress.correct)
  const accuracyPercent =
    progress.answered > 0 ? Math.round((progress.correct / progress.answered) * 100) : 0

  return {
    answered: progress.answered,
    correct: progress.correct,
    incorrect,
    accuracyPercent,
    lpDeltaTotal: progress.lpDeltaTotal,
    lpBonusTotal: progress.lpBonusTotal,
    xpDeltaTotal: progress.xpDeltaTotal,
    bestType: pickTypeByAccuracy(progress.questionTypes, "best"),
    weakType: pickTypeByAccuracy(progress.questionTypes, "weak"),
    bestStreak: progress.bestCorrectStreak,
  }
}

export function advanceSessionSummaryProgress(
  previousProgress: SessionSummaryProgress,
  result: SessionAnswerResultInput,
) {
  const normalizedQuestionType = normalizePracticeQuestionType(result.questionType)
  const nextQuestionTypes = {
    ...previousProgress.questionTypes,
  }

  if (normalizedQuestionType) {
    nextQuestionTypes[normalizedQuestionType] = {
      attempted: previousProgress.questionTypes[normalizedQuestionType].attempted + 1,
      correct:
        previousProgress.questionTypes[normalizedQuestionType].correct +
        (result.isCorrect ? 1 : 0),
    }
  }

  const currentCorrectStreak = result.isCorrect
    ? previousProgress.currentCorrectStreak + 1
    : 0
  const bestCorrectStreak = Math.max(
    previousProgress.bestCorrectStreak,
    currentCorrectStreak,
  )
  const earnedStreakBonus =
    result.isCorrect && currentCorrectStreak > 0 && currentCorrectStreak % SESSION_STREAK_BONUS_STREAK === 0
      ? SESSION_STREAK_BONUS_LP
      : 0

  const nextProgress: SessionSummaryProgress = {
    answered: previousProgress.answered + 1,
    correct: previousProgress.correct + (result.isCorrect ? 1 : 0),
    lpDeltaTotal: previousProgress.lpDeltaTotal + Math.trunc(result.lpDelta),
    lpBonusTotal: previousProgress.lpBonusTotal + earnedStreakBonus,
    xpDeltaTotal: previousProgress.xpDeltaTotal + Math.trunc(result.xpDelta),
    currentCorrectStreak,
    bestCorrectStreak,
    questionTypes: nextQuestionTypes,
  }

  if (nextProgress.answered < SESSION_SUMMARY_INTERVAL) {
    return {
      nextProgress,
      snapshot: null,
    }
  }

  return {
    nextProgress: defaultSessionSummaryProgress,
    snapshot: buildSessionSummarySnapshot(nextProgress),
  }
}

export function sanitizeMistakes(value: unknown): MistakeEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  const mistakes = value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => {
      const passageId = typeof entry.passageId === "string" ? entry.passageId.trim() : ""
      const questionId = Number(entry.questionId)
      const createdAt =
        typeof entry.createdAt === "string" && entry.createdAt.trim().length > 0
          ? entry.createdAt
          : new Date().toISOString()

      if (!passageId || !Number.isFinite(questionId)) {
        return null
      }

      return {
        id:
          typeof entry.id === "string" && entry.id.trim().length > 0
            ? entry.id
            : `${passageId}:${Math.trunc(questionId)}:${createdAt}`,
        passageId,
        questionId: Math.trunc(questionId),
        passageTitle: compactText(entry.passageTitle, MAX_MISTAKE_TITLE_LENGTH),
        questionPrompt: compactText(entry.questionPrompt, MAX_MISTAKE_PROMPT_LENGTH),
        band: compactText(entry.band, 20),
        type: compactText(entry.type, 60) || "Unknown",
        userAnswer: compactText(entry.userAnswer, MAX_MISTAKE_ANSWER_LENGTH),
        correctAnswer: compactText(entry.correctAnswer, MAX_MISTAKE_ANSWER_LENGTH),
        createdAt,
      } satisfies MistakeEntry
    })
    .filter((entry): entry is MistakeEntry => Boolean(entry))

  return mistakes.slice(0, MAX_STORED_MISTAKES)
}

export function createMistakeEntry(input: {
  passageId: string
  questionId: number
  passageTitle: string
  questionPrompt: string
  band: string
  type: string
  userAnswer: string
  correctAnswer: string
  createdAt?: string
}): MistakeEntry {
  const createdAt = input.createdAt ?? new Date().toISOString()

  return {
    id: `${input.passageId}:${input.questionId}:${createdAt}`,
    passageId: input.passageId,
    questionId: Math.trunc(input.questionId),
    passageTitle: compactText(input.passageTitle, MAX_MISTAKE_TITLE_LENGTH),
    questionPrompt: compactText(input.questionPrompt, MAX_MISTAKE_PROMPT_LENGTH),
    band: compactText(input.band, 20),
    type: compactText(input.type, 60) || "Unknown",
    userAnswer: compactText(input.userAnswer, MAX_MISTAKE_ANSWER_LENGTH),
    correctAnswer: compactText(input.correctAnswer, MAX_MISTAKE_ANSWER_LENGTH),
    createdAt,
  }
}
