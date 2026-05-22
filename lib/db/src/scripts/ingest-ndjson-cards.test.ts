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

test("band label normalization accepts open input forms", () => {
  assert.equal(ingestModule.normalizeBandLabel("6"), "6.0");
  assert.equal(ingestModule.normalizeBandLabel("Band 7.0"), "7.0");
  assert.equal(ingestModule.normalizeBandLabel("7.5"), "7.5");
  assert.equal(ingestModule.normalizeBandLabel("8.0"), "8.0+");
  assert.equal(ingestModule.normalizeBandLabel("8.0+"), "8.0+");
  assert.equal(ingestModule.normalizeBandLabel(""), null);
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

test("converter accepts v5 vocab fields and band override for blank-band cards", () => {
  const rawCard: Parameters<typeof ingestModule.validateAndConvert>[0][number] = {
    card_no: 2,
    band: "",
    title: "Blank Band V5 Card",
    topic: "Testing",
    passage: "First sentence introduces the concept. Second sentence shows the example.",
    vocab: [
      {
        term: "concept",
        sentence_ref: "S1",
        quick_explanation: "A general idea.",
        meaning_vi: "khai niem",
        example_sentence: "This example sentence should be preserved.",
      },
    ],
    questions: [
      {
        type: "TFNG",
        prompt: "The passage introduces a concept.",
        instruction: "",
        options: [],
      },
    ],
    answers: [{ type: "TFNG", answer: "TRUE", explanation: "Sentence one." }],
  };

  const { converted } = ingestModule.validateAndConvert([rawCard], {
    defaultBandLabel: "7.0",
  });
  const card = converted[0];
  assert.equal(card?.bandLabel, "7.0");
  assert.equal(card?.bandIndex, 70);
  assert.equal(card?.vocab[0]?.definition, "A general idea.");
  assert.equal(card?.vocab[0]?.example_sentence_en, "This example sentence should be preserved.");
});

test("converter preserves multi-answer MCQ keys for pick-two questions", () => {
  const rawCard: Parameters<typeof ingestModule.validateAndConvert>[0][number] = {
    card_no: 4,
    band: "7.5",
    title: "Pick Two MCQ Card",
    topic: "Testing",
    passage: "First sentence introduces the problem. Second sentence gives the answer.",
    vocab: [],
    questions: [
      {
        type: "MCQ",
        prompt: "Which TWO options are correct?",
        instruction: "Choose TWO options.",
        options: ["A. one", "B. two", "C. three", "D. four", "E. five"],
      },
    ],
    answers: [{ type: "MCQ", answer: "D and B", explanation: "Options B and D." }],
  };

  const { converted, anomalies } = ingestModule.validateAndConvert([rawCard]);
  const answer = converted[0]?.answerKey[0];

  assert.equal(answer?.answerValue, "B, D");
  assert.deepEqual(answer?.acceptedValues, ["D and B", "B, D"]);
  assert.equal(anomalies.filter((anomaly) => anomaly.kind === "answer_value_normalized").length, 1);
});

test("converter rejects blank band without override", () => {
  const rawCard: Parameters<typeof ingestModule.validateAndConvert>[0][number] = {
    card_no: 3,
    band: "",
    title: "Missing Band Card",
    topic: "Testing",
    passage: "Only one sentence is needed here.",
    vocab: [],
    questions: [
      {
        type: "TFNG",
        prompt: "Testing prompt.",
        instruction: "",
        options: [],
      },
    ],
    answers: [{ type: "TFNG", answer: "TRUE", explanation: "Sentence one." }],
  };

  assert.throws(
    () => ingestModule.validateAndConvert([rawCard]),
    /missing a valid band label/,
  );
});
