import { rankThresholds } from "./config/rank-thresholds";
import { rankedScoringMatrix } from "./config/ranked-scoring-matrix";
import { xpRules } from "./config/xp-rules";
import type {
  AnswerResult,
  BandLevel,
  NextRankProgress,
  Question,
  RankName,
  RankThreshold,
  UserProgress,
} from "./types";

function normalizeComparable(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeBandLevel(rawBand: string): BandLevel {
  const normalized = rawBand.trim();
  if (normalized === "8.0+") {
    return "8.0";
  }
  if (normalized === "8.0") return "8.0";
  if (normalized === "7.5") return "7.5";
  if (normalized === "7.0") return "7.0";
  return "6.0";
}

export function getRankByPoints(points: number): RankThreshold {
  const safePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  let selected = rankThresholds[0];

  for (const rank of rankThresholds) {
    if (safePoints >= rank.minPoints) {
      selected = rank;
      continue;
    }
    break;
  }

  return selected;
}

export function getNextRankProgress(points: number): NextRankProgress {
  const safePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const current = getRankByPoints(safePoints);
  const currentIndex = rankThresholds.findIndex((rank) => rank.name === current.name);
  const next = currentIndex >= 0 ? rankThresholds[currentIndex + 1] : undefined;

  if (!next) {
    return {
      currentRank: current.name,
      nextRank: null,
      pointsIntoCurrentRank: safePoints - current.minPoints,
      pointsNeededForNextRank: 0,
      progressPercent: 100,
    };
  }

  const pointsIntoCurrentRank = Math.max(0, safePoints - current.minPoints);
  const span = Math.max(1, next.minPoints - current.minPoints);
  const pointsNeededForNextRank = Math.max(0, next.minPoints - safePoints);
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((pointsIntoCurrentRank / span) * 100)),
  );

  return {
    currentRank: current.name,
    nextRank: next.name,
    pointsIntoCurrentRank,
    pointsNeededForNextRank,
    progressPercent,
  };
}

export function calculateRankedPointDelta(
  currentRank: RankName,
  questionBand: BandLevel,
  isCorrect: boolean,
) {
  const scoreRow = rankedScoringMatrix[currentRank][questionBand];

  // Safety guard: correct answers should always award LP, incorrect answers should always
  // deduct LP. This keeps behavior consistent with the ranked scoring table intent.
  if (isCorrect) {
    return Math.max(1, Math.abs(scoreRow.correct));
  }

  return -Math.max(1, Math.abs(scoreRow.incorrect));
}

export function calculateXpDelta(isCorrect: boolean) {
  return isCorrect ? xpRules.correct : xpRules.incorrect;
}

export function submitAnswer(
  userProgress: UserProgress,
  question: Question,
  selectedAnswer: string,
): {
  updatedUserProgress: UserProgress;
  answerResult: AnswerResult;
} {
  const rankedPointsBefore = Math.max(0, userProgress.rankedPoints);
  const lifetimeXpBefore = Math.max(0, userProgress.lifetimeXp);
  const rankBefore = getRankByPoints(rankedPointsBefore).name;
  const isCorrect =
    normalizeComparable(selectedAnswer) === normalizeComparable(question.correctAnswer);

  const rankedPointDelta = calculateRankedPointDelta(rankBefore, question.band, isCorrect);
  const xpDelta = calculateXpDelta(isCorrect);

  const rankedPointsAfter = Math.max(0, rankedPointsBefore + rankedPointDelta);
  const lifetimeXpAfter = Math.max(0, lifetimeXpBefore + xpDelta);
  const rankAfter = getRankByPoints(rankedPointsAfter).name;

  const updatedUserProgress: UserProgress = {
    ...userProgress,
    lifetimeXp: lifetimeXpAfter,
    rankedPoints: rankedPointsAfter,
    currentRank: rankAfter,
    totalQuestionsAnswered: userProgress.totalQuestionsAnswered + 1,
    totalCorrect: userProgress.totalCorrect + (isCorrect ? 1 : 0),
    totalIncorrect: userProgress.totalIncorrect + (isCorrect ? 0 : 1),
  };

  const answerResult: AnswerResult = {
    isCorrect,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    rankedPointsBefore,
    rankedPointsAfter,
    rankedPointDelta,
    lifetimeXpBefore,
    lifetimeXpAfter,
    xpDelta,
    rankBefore,
    rankAfter,
    rankedUp: rankBefore !== rankAfter && rankedPointsAfter > rankedPointsBefore,
    rankedDown: rankBefore !== rankAfter && rankedPointsAfter < rankedPointsBefore,
  };

  return { updatedUserProgress, answerResult };
}

export * from "./types";
