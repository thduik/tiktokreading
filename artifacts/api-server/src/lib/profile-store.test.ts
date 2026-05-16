import test from "node:test";
import assert from "node:assert/strict";
import {
  getAchievementLevelByXp,
  normalizeDisplayName,
  normalizeVocabBankTerm,
  parseOptionalBoundedInteger,
  readEmailFromClaims,
  toPercent,
} from "./profile-utils";

test("profile-store helpers normalize optional display names and emails", () => {
  assert.equal(normalizeDisplayName("  Linh  "), "Linh");
  assert.equal(normalizeDisplayName("   "), null);
  assert.equal(normalizeDisplayName(123), undefined);

  assert.equal(
    readEmailFromClaims({ email: "  USER@Example.com " }),
    "user@example.com",
  );
  assert.equal(
    readEmailFromClaims({ primary_email_address: " reader@ieltstok.online " }),
    "reader@ieltstok.online",
  );
  assert.equal(readEmailFromClaims({}), null);
});

test("profile-store helpers validate bounded integers and percentages", () => {
  assert.equal(parseOptionalBoundedInteger(15, { min: 0, max: 20 }), 15);
  assert.equal(parseOptionalBoundedInteger(-1, { min: 0, max: 20 }), null);
  assert.equal(parseOptionalBoundedInteger(25, { min: 0, max: 20 }), null);
  assert.equal(parseOptionalBoundedInteger(3.5, { min: 0, max: 20 }), null);

  assert.equal(toPercent(0, 0), 0);
  assert.equal(toPercent(15, 20), 75);
});

test("profile-store helpers normalize vocab terms and derive achievement levels", () => {
  assert.equal(
    normalizeVocabBankTerm("  Café   Society "),
    "cafe society",
  );

  assert.deepEqual(getAchievementLevelByXp(0), {
    total_xp: 0,
    current_level: 1,
    current_level_xp_floor: 0,
    next_level_xp_floor: 120,
    xp_into_level: 0,
    xp_needed_for_next_level: 120,
    progress_percent: 0,
  });

  assert.deepEqual(getAchievementLevelByXp(120), {
    total_xp: 120,
    current_level: 2,
    current_level_xp_floor: 120,
    next_level_xp_floor: 280,
    xp_into_level: 0,
    xp_needed_for_next_level: 160,
    progress_percent: 0,
  });

  const maxLevel = getAchievementLevelByXp(5000);
  assert.equal(maxLevel.current_level, 12);
  assert.equal(maxLevel.next_level_xp_floor, null);
  assert.equal(maxLevel.progress_percent, 100);
});
