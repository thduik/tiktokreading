import test from "node:test";
import assert from "node:assert/strict";
import { formatLocalDayKey, getDailyGoalProgress } from "./daily-goal";

test("daily goal progress caps visual progress while preserving attempted count", () => {
  assert.deepEqual(getDailyGoalProgress(25, 20), {
    attemptedToday: 25,
    goal: 20,
    remaining: 0,
    progressPercent: 100,
    isComplete: true,
  });
});

test("daily goal progress sanitizes negative and fractional attempts", () => {
  assert.deepEqual(getDailyGoalProgress(-3.8, 20), {
    attemptedToday: 0,
    goal: 20,
    remaining: 20,
    progressPercent: 0,
    isComplete: false,
  });

  assert.equal(getDailyGoalProgress(7.9, 20).attemptedToday, 7);
});

test("formatLocalDayKey uses local calendar parts", () => {
  const date = new Date(2026, 4, 9, 23, 59, 0);
  assert.equal(formatLocalDayKey(date), "2026-05-09");
});
