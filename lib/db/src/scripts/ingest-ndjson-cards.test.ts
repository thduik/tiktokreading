import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";

const ingestModule = await import("./ingest-ndjson-cards");

test("option answer canonicalization strips question prefixes and keeps A-H keys", () => {
  assert.equal(ingestModule.canonicalizeOptionKey("4.A"), "A");
  assert.equal(ingestModule.canonicalizeOptionKey("6 - E"), "E");
  assert.equal(ingestModule.canonicalizeOptionKey("H"), "H");
});

test("text answer canonicalization strips question prefixes without changing content", () => {
  assert.equal(ingestModule.canonicalizeTextAnswer("4. good roads"), "good roads");
});

test("option text canonicalization strips duplicated option labels", () => {
  assert.equal(ingestModule.canonicalizeOptionText("A. First option", "A"), "First option");
  assert.equal(ingestModule.canonicalizeOptionText("b) Second option", "B"), "Second option");
  assert.equal(
    ingestModule.canonicalizeOptionText("A normal sentence without a label", "A"),
    "A normal sentence without a label",
  );
});

test("converter keeps matching options beyond D and stores them as matching labels", () => {
  const rawCard: Parameters<typeof ingestModule.validateAndConvert>[0][number] = {
    card_no: 1,
    band: "8.0+",
    title: "Test Matching Passage",
    topic: "Testing",
    passage:
      "First sentence gives context. Second sentence adds support. Third sentence closes the passage.",
    vocab: [],
    questions: [
      {
        type: "TFNG",
        prompt: "The passage has context.",
        instruction: "",
        options: [],
      },
      {
        type: "MCQ",
        prompt: "Which option is correct?",
        instruction: "",
        options: ["A. one", "B. two", "C. three", "D. four"],
      },
      {
        type: "SentenceCompletion",
        prompt: "The passage adds ______.",
        instruction: "Write ONE WORD ONLY.",
        options: [],
      },
      {
        type: "ShortAnswer",
        prompt: "What closes the passage?",
        instruction: "Write NO MORE THAN TWO WORDS.",
        options: [],
      },
      {
        type: "MatchingHeading",
        prompt: "Choose the best heading.",
        instruction: "",
        options: ["A head", "B head", "C head", "D head", "E head"],
      },
      {
        type: "MatchingInformation",
        prompt: "Where is the information found?",
        instruction: "",
        options: ["A info", "B info", "C info", "D info", "E info", "F info"],
      },
    ],
    answers: [
      { type: "TFNG", answer: "TRUE", explanation: "Sentence one." },
      { type: "MCQ", answer: "A", explanation: "Option A." },
      {
        type: "SentenceCompletion",
        answer: "support",
        explanation: "Sentence two.",
      },
      {
        type: "ShortAnswer",
        answer: "third sentence",
        explanation: "Sentence three.",
      },
      { type: "MatchingHeading", answer: "5.E", explanation: "Heading E." },
      {
        type: "MatchingInformation",
        answer: "6.F",
        explanation: "Information F.",
      },
    ],
  };

  const { converted, anomalies } = ingestModule.validateAndConvert([rawCard]);
  const card = converted[0];
  const matchingHeading = card?.questions[4];
  const matchingInfo = card?.questions[5];

  assert.equal(card?.questions.length, 6);
  assert.equal(matchingHeading?.questionTypeIndex, "mcq");
  assert.equal(matchingHeading?.questionTypeLabel, "Matching Heading");
  assert.equal(matchingInfo?.questionTypeLabel, "Matching Information");
  assert.deepEqual(
    (matchingHeading?.payload.options as Array<{ key: string; text: string }>).map(
      (option) => option.key,
    ),
    ["A", "B", "C", "D", "E"],
  );
  assert.deepEqual(
    (matchingInfo?.payload.options as Array<{ key: string; text: string }>).map(
      (option) => option.key,
    ),
    ["A", "B", "C", "D", "E", "F"],
  );
  assert.deepEqual(
    (card?.questions[1]?.payload.options as Array<{ key: string; text: string }>).map(
      (option) => option.text,
    ),
    ["one", "two", "three", "four"],
  );
  assert.equal(card?.answerKey[4]?.answerValue, "E");
  assert.equal(card?.answerKey[5]?.answerValue, "F");
  assert.equal(anomalies.filter((anomaly) => anomaly.kind === "answer_value_normalized").length, 2);
});
