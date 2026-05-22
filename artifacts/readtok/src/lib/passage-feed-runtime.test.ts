import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActivePassageResumeStorageKey,
  formatElapsedTimer,
  readActivePassageResume,
  selectRandomIdsFromPool,
  uniqueIds,
  writeActivePassageResume,
  ACTIVE_PASSAGE_RESUME_TTL_MS,
} from "@/lib/passage-feed-runtime";
import type { ActivePassageResumeSnapshot } from "@/lib/passage-feed-runtime";

function createMockStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("passage feed runtime de-duplicates ids without changing order", () => {
  assert.deepEqual(uniqueIds(["p1", "p2", "p1", "", "p3", "p2"]), [
    "p1",
    "p2",
    "p3",
  ]);
});

test("passage feed runtime prefers fresh unseen ids before recycling", () => {
  const selected = selectRandomIdsFromPool({
    poolIds: ["p1", "p2", "p3", "p4"],
    alreadyShownIds: ["p1", "p2"],
    excludeIds: ["p4"],
    count: 1,
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0], "p3");
});

test("passage feed runtime falls back to the full pool when fresh ids are exhausted", () => {
  const selected = selectRandomIdsFromPool({
    poolIds: ["p1", "p2", "p3"],
    alreadyShownIds: ["p1", "p2", "p3"],
    excludeIds: ["p3"],
    count: 2,
  });

  assert.equal(selected.length, 2);
  assert.ok(selected.every((id) => id === "p1" || id === "p2"));
});

test("passage feed runtime formats elapsed timers defensively", () => {
  assert.equal(formatElapsedTimer(0), "0:00");
  assert.equal(formatElapsedTimer(9), "0:09");
  assert.equal(formatElapsedTimer(125), "2:05");
  assert.equal(formatElapsedTimer(Number.NaN), "0:00");
});

test("passage feed runtime restores a recent active resume snapshot", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const localStorage = createMockStorage();
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };

  const snapshot: ActivePassageResumeSnapshot = {
    factoryTagFilter: "v6",
    entry: {
      passage: {
        id: "p1",
        schema_version: "1",
        exam_index: "e1",
        exam_label: "Exam 1",
        band_index: 75,
        band_label: "7.5",
        question_set_type_index: "mixed",
        question_set_type_label: "Mixed",
        topic_index: "topic",
        topic_label: "Topic",
        title: "Passage 1",
        factory_tag: "v6",
        language_code: "en",
        status: "active",
        passage: "Text",
        passage_meta: { sentence_count: 1, word_count: 1 },
        vocab: [],
        passage_sentences: [{ sentence_index: 1, text: "Text" }],
        questions: [],
        answer_key: [],
      },
      answersByQuestionId: { "1": "A" },
      revealedByQuestionId: { "1": true },
      elapsedSeconds: 45,
      questionOrder: [1, 2, 3],
      viewedAt: 1_000,
    },
  };

  try {
    writeActivePassageResume(snapshot, 1_000);
    assert.equal(
      buildActivePassageResumeStorageKey("v6"),
      "readtok_active_passage_resume_v1:v6",
    );

    const restored = readActivePassageResume("v6", 1_000 + ACTIVE_PASSAGE_RESUME_TTL_MS - 1);
    assert.deepEqual(restored, snapshot);
  } finally {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

test("passage feed runtime drops stale active resume snapshots after five minutes", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const localStorage = createMockStorage();
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };

  const snapshot: ActivePassageResumeSnapshot = {
    factoryTagFilter: null,
    entry: {
      passage: {
        id: "p1",
        schema_version: "1",
        exam_index: "e1",
        exam_label: "Exam 1",
        band_index: 75,
        band_label: "7.5",
        question_set_type_index: "mixed",
        question_set_type_label: "Mixed",
        topic_index: "topic",
        topic_label: "Topic",
        title: "Passage 1",
        factory_tag: "v6",
        language_code: "en",
        status: "active",
        passage: "Text",
        passage_meta: { sentence_count: 1, word_count: 1 },
        vocab: [],
        passage_sentences: [{ sentence_index: 1, text: "Text" }],
        questions: [],
        answer_key: [],
      },
      answersByQuestionId: {},
      revealedByQuestionId: {},
      elapsedSeconds: 0,
      questionOrder: [],
      viewedAt: 2_000,
    },
  };

  try {
    writeActivePassageResume(snapshot, 2_000);
    const restored = readActivePassageResume(null, 2_000 + ACTIVE_PASSAGE_RESUME_TTL_MS + 1);
    assert.equal(restored, null);
    assert.equal(localStorage.getItem(buildActivePassageResumeStorageKey(null)), null);
  } finally {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});
