import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://readtok:test@127.0.0.1:5432/readtok_test";

const profileUtils = await import("./profile-utils");
const profileStore = await import("./profile-store");

test("profile-store helpers normalize optional display names and emails", () => {
  assert.equal(profileUtils.normalizeDisplayName("  Linh  "), "Linh");
  assert.equal(profileUtils.normalizeDisplayName("   "), null);
  assert.equal(profileUtils.normalizeDisplayName(123), undefined);

  assert.equal(
    profileUtils.readEmailFromClaims({ email: "  USER@Example.com " }),
    "user@example.com",
  );
  assert.equal(
    profileUtils.readEmailFromClaims({ primary_email_address: " reader@ieltstok.online " }),
    "reader@ieltstok.online",
  );
  assert.equal(profileUtils.readEmailFromClaims({}), null);
});

test("profile-store helpers validate bounded integers and percentages", () => {
  assert.equal(profileUtils.parseOptionalBoundedInteger(15, { min: 0, max: 20 }), 15);
  assert.equal(profileUtils.parseOptionalBoundedInteger(-1, { min: 0, max: 20 }), null);
  assert.equal(profileUtils.parseOptionalBoundedInteger(25, { min: 0, max: 20 }), null);
  assert.equal(profileUtils.parseOptionalBoundedInteger(3.5, { min: 0, max: 20 }), null);

  assert.equal(profileUtils.toPercent(0, 0), 0);
  assert.equal(profileUtils.toPercent(15, 20), 75);
});

test("profile-store helpers normalize vocab terms and derive achievement levels", () => {
  assert.equal(profileUtils.normalizeVocabBankTerm("  Café   Society "), "cafe society");

  assert.deepEqual(profileUtils.getAchievementLevelByXp(0), {
    total_xp: 0,
    current_level: 1,
    current_level_xp_floor: 0,
    next_level_xp_floor: 120,
    xp_into_level: 0,
    xp_needed_for_next_level: 120,
    progress_percent: 0,
  });

  assert.deepEqual(profileUtils.getAchievementLevelByXp(120), {
    total_xp: 120,
    current_level: 2,
    current_level_xp_floor: 120,
    next_level_xp_floor: 280,
    xp_into_level: 0,
    xp_needed_for_next_level: 160,
    progress_percent: 0,
  });

  const maxLevel = profileUtils.getAchievementLevelByXp(5000);
  assert.equal(maxLevel.current_level, 12);
  assert.equal(maxLevel.next_level_xp_floor, null);
  assert.equal(maxLevel.progress_percent, 100);
});

test("practice streak helpers preserve streaks through the three-day grace window", () => {
  assert.equal(profileStore.PRACTICE_STREAK_GRACE_MISSED_DAYS, 3);

  assert.equal(
    profileStore.getVisiblePracticeStreakDays({
      currentPracticeStreakDays: 8,
      bestPracticeStreakDays: 8,
      lastPracticeDateLocal: "2026-05-20",
      localDate: "2026-05-24",
    }),
    8,
  );

  assert.equal(
    profileStore.getVisiblePracticeStreakDays({
      currentPracticeStreakDays: 8,
      bestPracticeStreakDays: 8,
      lastPracticeDateLocal: "2026-05-20",
      localDate: "2026-05-25",
    }),
    0,
  );

  assert.deepEqual(
    profileStore.advancePracticeStreakState({
      currentPracticeStreakDays: 8,
      bestPracticeStreakDays: 10,
      lastPracticeDateLocal: "2026-05-20",
      localDate: "2026-05-24",
    }),
    {
      currentPracticeStreakDays: 9,
      bestPracticeStreakDays: 10,
      lastPracticeDateLocal: "2026-05-24",
    },
  );

  assert.deepEqual(
    profileStore.advancePracticeStreakState({
      currentPracticeStreakDays: 8,
      bestPracticeStreakDays: 10,
      lastPracticeDateLocal: "2026-05-20",
      localDate: "2026-05-25",
    }),
    {
      currentPracticeStreakDays: 1,
      bestPracticeStreakDays: 10,
      lastPracticeDateLocal: "2026-05-25",
    },
  );
});
