import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";

const repairModule = await import("./repair-v5-plus-multi-key-mcq");

test("parseTwoOptionKeysFromExplanation reads paired 'are correct' phrases", () => {
  assert.deepEqual(
    repairModule.parseTwoOptionKeysFromExplanation(
      "B and E are correct because both statements preserve the passage's limitation.",
    ),
    ["B", "E"],
  );
});

test("parseTwoOptionKeysFromExplanation reads separate 'is correct' clauses", () => {
  assert.deepEqual(
    repairModule.parseTwoOptionKeysFromExplanation(
      "A is correct because Sentence 4 states the barrier condition. B is correct because Sentence 5 keeps expert input necessary.",
    ),
    ["A", "B"],
  );
});

test("parseTwoOptionKeysFromExplanation skips ambiguous or single-answer explanations", () => {
  assert.equal(
    repairModule.parseTwoOptionKeysFromExplanation(
      "C is correct because it matches the passage and the others distort the scope.",
    ),
    null,
  );
});

test("manual override list includes known skipped passages", async () => {
  const overridesModule = await import("./repair-v5-plus-multi-key-mcq.overrides");
  const overrides = overridesModule.manualTwoKeyMcqOverrides as Record<string, readonly string[]>;
  assert.equal("Sortition in Climate Assemblies::2" in overrides, false);
  assert.deepEqual(
    overrides["National Human Rights Institution Reviews::8"],
    ["A", "B"],
  );
});
