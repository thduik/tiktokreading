import test from "node:test";
import assert from "node:assert/strict";
import type { PassageAnswerKey } from "@/lib/passages-api";
import {
  formatOptionKeyAnswer,
  getExpectedOptionSelectionCount,
  isOptionKeyAnswerCorrect,
  resolveOptionKeyAnswerForScoring,
  splitOptionKeyAnswer,
} from "@/lib/mcq-answer";

function createOptionAnswerKey(
  answerValue: string,
  acceptedValues?: string[],
): PassageAnswerKey {
  return {
    question_id: 1,
    answer_type: "option_key",
    answer_value: answerValue,
    accepted_values: acceptedValues ?? null,
    explanation: "",
  };
}

test("splitOptionKeyAnswer normalizes multi-select delimiters and ordering", () => {
  assert.deepEqual(splitOptionKeyAnswer("B and A"), ["A", "B"]);
  assert.deepEqual(splitOptionKeyAnswer("E/D"), ["D", "E"]);
  assert.deepEqual(splitOptionKeyAnswer("C, A, C"), ["A", "C"]);
});

test("getExpectedOptionSelectionCount reflects multi-answer MCQ keys", () => {
  assert.equal(getExpectedOptionSelectionCount(undefined), 1);
  assert.equal(getExpectedOptionSelectionCount(createOptionAnswerKey("C")), 1);
  assert.equal(getExpectedOptionSelectionCount(createOptionAnswerKey("B, D")), 2);
});

test("isOptionKeyAnswerCorrect compares option sets instead of raw string order", () => {
  const answerKey = createOptionAnswerKey("B and D", ["D, B"]);

  assert.equal(isOptionKeyAnswerCorrect(answerKey, "D, B"), true);
  assert.equal(isOptionKeyAnswerCorrect(answerKey, "B and E"), false);
});

test("resolveOptionKeyAnswerForScoring returns a backend-compatible matching variant", () => {
  const answerKey = createOptionAnswerKey("B and D", ["D, B"]);

  assert.equal(resolveOptionKeyAnswerForScoring(answerKey, "D, B"), "B and D");
  assert.equal(resolveOptionKeyAnswerForScoring(answerKey, "A, E"), "A, E");
  assert.equal(formatOptionKeyAnswer("E and C"), "C, E");
});
