import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysToDateKey,
  buildAnswerStatsPeriod,
  normalizeAnswerStatBandGroup,
  normalizeAnswerStatQuestionType,
  normalizeLocalDateKey,
  toAccuracy,
} from "./answer-stats";

test("answer stat band normalization maps IELTS bands into stable groups", () => {
  assert.equal(normalizeAnswerStatBandGroup("6.0"), "Band6");
  assert.equal(normalizeAnswerStatBandGroup("Band 7.0"), "Band7");
  assert.equal(normalizeAnswerStatBandGroup("7.5"), "Band75");
  assert.equal(normalizeAnswerStatBandGroup("8.0+"), "Band8Plus");
  assert.equal(normalizeAnswerStatBandGroup(8), "Band8Plus");
});

test("answer stat question type normalization separates matching from MCQ labels", () => {
  assert.equal(
    normalizeAnswerStatQuestionType({
      questionTypeIndex: "mcq",
      questionTypeLabel: "Multiple Choice",
    }),
    "MCQ",
  );
  assert.equal(
    normalizeAnswerStatQuestionType({
      questionTypeIndex: "mcq",
      questionTypeLabel: "Matching Heading",
    }),
    "Matching",
  );
  assert.equal(
    normalizeAnswerStatQuestionType({
      questionTypeIndex: "tfng",
      questionTypeLabel: "True / False / Not Given",
    }),
    "TFNG",
  );
});

test("date helpers validate local date keys and calculate rolling windows", () => {
  assert.equal(normalizeLocalDateKey("2026-05-09"), "2026-05-09");
  assert.equal(normalizeLocalDateKey("2026-02-31"), null);
  assert.equal(addDaysToDateKey("2026-05-09", -6), "2026-05-03");
  assert.equal(addDaysToDateKey("2026-01-01", -29), "2025-12-03");
});

test("answer stat aggregation returns overall and by band/type totals", () => {
  const period = buildAnswerStatsPeriod([
    {
      bandGroup: "Band8Plus",
      questionType: "TFNG",
      attemptCount: 90,
      correctCount: 50,
      wrongCount: 40,
    },
    {
      bandGroup: "Band8Plus",
      questionType: "MCQ",
      attemptCount: 20,
      correctCount: 15,
      wrongCount: 5,
    },
  ]);

  assert.deepEqual(period.overall, {
    total: 110,
    correct: 65,
    wrong: 45,
    accuracy: 59.1,
  });
  assert.deepEqual(period.byBandAndType.Band8Plus?.TFNG, {
    total: 90,
    correct: 50,
    wrong: 40,
    accuracy: 55.6,
  });
});

test("accuracy is derived from counts and handles empty totals", () => {
  assert.equal(toAccuracy(0, 0), 0);
  assert.equal(toAccuracy(73, 104), 70.2);
});
