import type { BandLevel, RankName } from "../types";

type ScoreRow = Record<BandLevel, { correct: number; incorrect: number }>;
export type RankedScoringMatrix = Record<RankName, ScoreRow>;

export const rankedScoringMatrix: RankedScoringMatrix = {
  Bronze: {
    "6.0": { correct: 4, incorrect: -5 },
    "7.0": { correct: 6, incorrect: -5 },
    "7.5": { correct: 7, incorrect: -5 },
    "8.0": { correct: 8, incorrect: -5 },
  },
  Silver: {
    "6.0": { correct: 4, incorrect: -5 },
    "7.0": { correct: 6, incorrect: -5 },
    "7.5": { correct: 7, incorrect: -5 },
    "8.0": { correct: 8, incorrect: -5 },
  },
  Gold: {
    "6.0": { correct: 3, incorrect: -6 },
    "7.0": { correct: 5, incorrect: -6 },
    "7.5": { correct: 7, incorrect: -6 },
    "8.0": { correct: 9, incorrect: -6 },
  },
  Platinum: {
    "6.0": { correct: 3, incorrect: -6 },
    "7.0": { correct: 5, incorrect: -6 },
    "7.5": { correct: 7, incorrect: -6 },
    "8.0": { correct: 9, incorrect: -6 },
  },
  Diamond: {
    "6.0": { correct: 2, incorrect: -7 },
    "7.0": { correct: 4, incorrect: -7 },
    "7.5": { correct: 6, incorrect: -7 },
    "8.0": { correct: 8, incorrect: -7 },
  },
  Master: {
    "6.0": { correct: 2, incorrect: -8 },
    "7.0": { correct: 3, incorrect: -8 },
    "7.5": { correct: 5, incorrect: -8 },
    "8.0": { correct: 7, incorrect: -8 },
  },
  Grandmaster: {
    "6.0": { correct: 1, incorrect: -8 },
    "7.0": { correct: 3, incorrect: -8 },
    "7.5": { correct: 5, incorrect: -8 },
    "8.0": { correct: 7, incorrect: -8 },
  },
  Challenger: {
    "6.0": { correct: 2, incorrect: -8 },
    "7.0": { correct: 3, incorrect: -8 },
    "7.5": { correct: 4, incorrect: -8 },
    "8.0": { correct: 6, incorrect: -8 },
  },
};

