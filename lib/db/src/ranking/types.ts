export const BAND_LEVELS = ["6.0", "7.0", "7.5", "8.0"] as const;
export type BandLevel = (typeof BAND_LEVELS)[number];

export const RANK_NAMES = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
] as const;
export type RankName = (typeof RANK_NAMES)[number];

export type RankThreshold = {
  name: RankName;
  minPoints: number;
  maxPoints: number | null;
};

export type UserProgress = {
  userId: string;
  lifetimeXp: number;
  rankedPoints: number;
  currentRank: RankName;
  totalQuestionsAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
};

export type Question = {
  id: string;
  band: BandLevel;
  correctAnswer: string;
};

export type AnswerResult = {
  isCorrect: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  rankedPointsBefore: number;
  rankedPointsAfter: number;
  rankedPointDelta: number;
  lifetimeXpBefore: number;
  lifetimeXpAfter: number;
  xpDelta: number;
  rankBefore: RankName;
  rankAfter: RankName;
  rankedUp: boolean;
  rankedDown: boolean;
};

export type NextRankProgress = {
  currentRank: RankName;
  nextRank: RankName | null;
  pointsIntoCurrentRank: number;
  pointsNeededForNextRank: number;
  progressPercent: number;
};

