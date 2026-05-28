import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActivePassageResumeStorageKey,
  createActivePassageBackupEntry,
  formatElapsedTimer,
  initiateActivePassageSnapshot,
  readActivePassageResume,
  readIdArrayFromStorage,
  selectRandomIdsFromPool,
  uniqueIds,
  writeActivePassageResume,
  writeIdArrayToStorage,
  ACTIVE_PASSAGE_RESUME_TTL_MS,
} from "@/lib/passage-feed-runtime";
import type { ActivePassageResumeSnapshot } from "@/lib/passage-feed-runtime";
import type { PassageDetail } from "@/lib/passages-api";

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

function createTestPassage(id: string, status = "active"): PassageDetail {
  return {
    id,
    schema_version: "1",
    exam_index: "e1",
    exam_label: "Exam 1",
    band_index: 75,
    band_label: "7.5",
    question_set_type_index: "mixed",
    question_set_type_label: "Mixed",
    topic_index: "topic",
    topic_label: "Topic",
    title: `Passage ${id}`,
    factory_tag: status === "backup" ? "cold_backup" : "v6",
    language_code: "en",
    status,
    passage: "Text",
    passage_meta: { sentence_count: 1, word_count: 1 },
    vocab: [],
    passage_sentences: [{ sentence_index: 1, text: "Text" }],
    questions: [],
    answer_key: [],
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

test("passage feed runtime caps stored random shown ids to recent entries", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const localStorage = createMockStorage();
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };

  try {
    writeIdArrayToStorage("shown", ["p1", "p2", "p3", "p4"], { maxIds: 2 });
    assert.deepEqual(readIdArrayFromStorage("shown"), ["p3", "p4"]);

    localStorage.setItem("shown-raw", JSON.stringify(["p1", "p2", "p3"]));
    assert.deepEqual(readIdArrayFromStorage("shown-raw", { maxIds: 2 }), [
      "p2",
      "p3",
    ]);
  } finally {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

test("passage feed runtime ignores localStorage quota failures for id arrays", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const localStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("QuotaExceededError");
    },
    removeItem() {
      // no-op
    },
  };
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };

  try {
    assert.doesNotThrow(() => {
      writeIdArrayToStorage("shown", ["p1", "p2"], { maxIds: 1 });
    });
  } finally {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
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

test("passage feed runtime initiates from recent resume snapshot when available", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const localStorage = createMockStorage();
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };

  const resumeSnapshot: ActivePassageResumeSnapshot = {
    factoryTagFilter: "v6",
    entry: createActivePassageBackupEntry(createTestPassage("resume"), {
      answersByQuestionId: { "1": "A" },
      revealedByQuestionId: { "1": true },
      elapsedSeconds: 12,
      viewedAt: 5_000,
    }),
  };

  try {
    writeActivePassageResume(resumeSnapshot, 5_000);
    const initiated = initiateActivePassageSnapshot({
      factoryTagFilter: "v6",
      defaultPassage: createTestPassage("backup", "backup"),
      now: 5_000 + ACTIVE_PASSAGE_RESUME_TTL_MS - 1,
    });

    assert.equal(initiated.source, "resume");
    assert.deepEqual(initiated.snapshot, resumeSnapshot);
  } finally {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

test("passage feed runtime initiates from default backup snapshot without resume", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const localStorage = createMockStorage();
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };

  const defaultPassage = createTestPassage("backup", "backup");

  try {
    const initiated = initiateActivePassageSnapshot({
      factoryTagFilter: null,
      defaultPassage,
      now: 6_000,
    });

    assert.equal(initiated.source, "default_backup");
    assert.equal(initiated.snapshot.factoryTagFilter, null);
    assert.equal(initiated.snapshot.entry.passage, defaultPassage);
    assert.deepEqual(initiated.snapshot.entry.answersByQuestionId, {});
    assert.deepEqual(initiated.snapshot.entry.revealedByQuestionId, {});
    assert.equal(initiated.snapshot.entry.elapsedSeconds, 0);
    assert.equal(initiated.snapshot.entry.viewedAt, 6_000);
  } finally {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

test("passage feed runtime ignores mismatched resume when a target passage is required", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const localStorage = createMockStorage();
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };

  try {
    writeActivePassageResume(
      {
        factoryTagFilter: "v6",
        entry: createActivePassageBackupEntry(createTestPassage("old-resume"), {
          viewedAt: 7_000,
        }),
      },
      7_000,
    );

    const initiated = initiateActivePassageSnapshot({
      factoryTagFilter: "v6",
      defaultPassage: createTestPassage("backup", "backup"),
      targetPassageId: "required-passage",
      now: 7_000,
    });

    assert.equal(initiated.source, "default_backup");
    assert.equal(initiated.snapshot.entry.passage.id, "backup");
  } finally {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});
