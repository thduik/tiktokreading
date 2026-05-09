import test from "node:test"
import assert from "node:assert/strict"
import {
  SESSION_STREAK_BONUS_LP,
  advanceSessionSummaryProgress,
  createMistakeEntry,
  defaultSessionSummaryProgress,
  sanitizeMistakes,
} from "@/lib/practice-tracking"

test("session summary emits a snapshot after 10 answers", () => {
  let progress = defaultSessionSummaryProgress
  let snapshot = null

  for (let index = 0; index < 10; index += 1) {
    const result = advanceSessionSummaryProgress(progress, {
      isCorrect: index < 7,
      xpDelta: index < 7 ? 10 : 2,
      lpDelta: index < 7 ? 4 : -5,
      questionType: index < 5 ? "TFNG" : "MCQ",
    })
    progress = result.nextProgress
    snapshot = result.snapshot
  }

  assert.ok(snapshot)
  assert.equal(snapshot.answered, 10)
  assert.equal(snapshot.correct, 7)
  assert.equal(snapshot.incorrect, 3)
  assert.equal(snapshot.accuracyPercent, 70)
  assert.equal(snapshot.bestType, "TFNG")
  assert.equal(snapshot.weakType, "MCQ")
  assert.equal(progress.answered, 0)
})

test("session summary awards a 10 LP bonus for a 10-answer correct streak", () => {
  let progress = defaultSessionSummaryProgress
  let snapshot = null

  for (let index = 0; index < 10; index += 1) {
    const result = advanceSessionSummaryProgress(progress, {
      isCorrect: true,
      xpDelta: 10,
      lpDelta: 6,
      questionType: "MatchingHeading",
    })
    progress = result.nextProgress
    snapshot = result.snapshot
  }

  assert.ok(snapshot)
  assert.equal(snapshot.bestStreak, 10)
  assert.equal(snapshot.lpBonusTotal, SESSION_STREAK_BONUS_LP)
  assert.equal(snapshot.bestType, "Matching")
  assert.equal(snapshot.weakType, "Matching")
})

test("sanitizeMistakes keeps only valid entries", () => {
  const validEntry = createMistakeEntry({
    passageId: "passage_1",
    questionId: 2,
    passageTitle: "Safety Matches",
    questionPrompt: "What changed?",
    band: "6.0",
    type: "Sentence Completion",
    userAnswer: "safety",
    correctAnswer: "reactive chemical",
    createdAt: "2026-05-09T16:00:00.000Z",
  })

  const sanitized = sanitizeMistakes([
    validEntry,
    { foo: "bar" },
    { passageId: "", questionId: "x" },
  ])

  assert.deepEqual(sanitized, [validEntry])
})
