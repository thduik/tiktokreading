import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateRankedPointDelta,
  calculateXpDelta,
  getRankByPoints,
  submitAnswer,
} from "./index";
import type { Question, UserProgress } from "./types";

function baseProgress(overrides: Partial<UserProgress> = {}): UserProgress {
  return {
    userId: "u1",
    lifetimeXp: 0,
    rankedPoints: 0,
    currentRank: "Bronze",
    totalQuestionsAnswered: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    ...overrides,
  };
}

function baseQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    band: "6.0",
    correctAnswer: "A",
    ...overrides,
  };
}

test("rank calculation thresholds", () => {
  assert.equal(getRankByPoints(0).name, "Bronze");
  assert.equal(getRankByPoints(199).name, "Bronze");
  assert.equal(getRankByPoints(200).name, "Silver");
  assert.equal(getRankByPoints(499).name, "Silver");
  assert.equal(getRankByPoints(500).name, "Gold");
  assert.equal(getRankByPoints(900).name, "Platinum");
  assert.equal(getRankByPoints(1400).name, "Diamond");
  assert.equal(getRankByPoints(2000).name, "Master");
  assert.equal(getRankByPoints(2700).name, "Grandmaster");
  assert.equal(getRankByPoints(3500).name, "Challenger");
});

test("rank movement up and down", () => {
  const up = submitAnswer(
    baseProgress({ rankedPoints: 199, currentRank: "Bronze" }),
    baseQuestion({ band: "6.0", correctAnswer: "A" }),
    "A",
  );
  assert.equal(up.answerResult.rankBefore, "Bronze");
  assert.equal(up.answerResult.rankAfter, "Silver");
  assert.equal(up.answerResult.rankedUp, true);

  const down = submitAnswer(
    baseProgress({ rankedPoints: 200, currentRank: "Silver" }),
    baseQuestion({ band: "6.0", correctAnswer: "A" }),
    "B",
  );
  assert.equal(down.answerResult.rankBefore, "Silver");
  assert.equal(down.answerResult.rankAfter, "Bronze");
  assert.equal(down.answerResult.rankedDown, true);

  const same = submitAnswer(
    baseProgress({ rankedPoints: 250, currentRank: "Silver" }),
    baseQuestion({ band: "6.0", correctAnswer: "A" }),
    "A",
  );
  assert.equal(same.answerResult.rankBefore, "Silver");
  assert.equal(same.answerResult.rankAfter, "Silver");
});

test("point calculation matrix values", () => {
  assert.equal(calculateRankedPointDelta("Bronze", "6.0", true), 4);
  assert.equal(calculateRankedPointDelta("Bronze", "8.0", true), 8);
  assert.equal(calculateRankedPointDelta("Bronze", "6.0", false), -5);
  assert.equal(calculateRankedPointDelta("Challenger", "6.0", true), 2);
  assert.equal(calculateRankedPointDelta("Challenger", "8.0", true), 6);
  assert.equal(calculateRankedPointDelta("Challenger", "7.0", false), -8);
});

test("ranked points never go below zero", () => {
  const result = submitAnswer(
    baseProgress({ rankedPoints: 1, currentRank: "Bronze" }),
    baseQuestion({ correctAnswer: "A" }),
    "B",
  );
  assert.equal(result.updatedUserProgress.rankedPoints, 0);
});

test("xp calculation rules", () => {
  assert.equal(calculateXpDelta(true), 10);
  assert.equal(calculateXpDelta(false), 2);

  const wrong = submitAnswer(
    baseProgress({ lifetimeXp: 5 }),
    baseQuestion({ correctAnswer: "A" }),
    "B",
  );
  assert.equal(wrong.updatedUserProgress.lifetimeXp, 7);

  const right = submitAnswer(
    baseProgress({ lifetimeXp: 5 }),
    baseQuestion({ correctAnswer: "A" }),
    "A",
  );
  assert.equal(right.updatedUserProgress.lifetimeXp, 15);
});

test("submitAnswer updates counters and result metadata", () => {
  const correct = submitAnswer(
    baseProgress({ rankedPoints: 100, lifetimeXp: 20 }),
    baseQuestion({ id: "q7", band: "7.5", correctAnswer: "Mercury" }),
    "Mercury",
  );

  assert.equal(correct.updatedUserProgress.totalQuestionsAnswered, 1);
  assert.equal(correct.updatedUserProgress.totalCorrect, 1);
  assert.equal(correct.updatedUserProgress.totalIncorrect, 0);
  assert.equal(correct.answerResult.isCorrect, true);
  assert.equal(correct.answerResult.rankedPointsBefore, 100);
  assert.equal(correct.answerResult.rankedPointsAfter, 107);
  assert.equal(correct.answerResult.lifetimeXpBefore, 20);
  assert.equal(correct.answerResult.lifetimeXpAfter, 30);

  const incorrect = submitAnswer(
    baseProgress({ rankedPoints: 100, lifetimeXp: 20 }),
    baseQuestion({ id: "q8", band: "7.5", correctAnswer: "Mercury" }),
    "Venus",
  );

  assert.equal(incorrect.updatedUserProgress.totalQuestionsAnswered, 1);
  assert.equal(incorrect.updatedUserProgress.totalCorrect, 0);
  assert.equal(incorrect.updatedUserProgress.totalIncorrect, 1);
  assert.equal(incorrect.answerResult.isCorrect, false);
});

