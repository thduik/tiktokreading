import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RANK_TIERS,
  getRankPlateData,
  normalizeRankTiers,
  sanitizeRankedIdentitySnapshot,
} from "./rank-visual";

test("rank plate splits ordinary ranks into IV through I divisions", () => {
  assert.equal(getRankPlateData(0).displayLabel, "Bronze IV");
  assert.equal(getRankPlateData(50).displayLabel, "Bronze III");
  assert.equal(getRankPlateData(100).displayLabel, "Bronze II");
  assert.equal(getRankPlateData(150).displayLabel, "Bronze I");
  assert.equal(getRankPlateData(200).displayLabel, "Silver IV");
});

test("rank plate leaves Challenger uncapped as a single top plate", () => {
  const plate = getRankPlateData(4000);
  assert.equal(plate.displayLabel, "Challenger");
  assert.equal(plate.division, null);
  assert.equal(plate.progressPercent, 100);
  assert.equal(plate.nextLabel, null);
});

test("rank tier normalization sorts by min points and falls back to defaults", () => {
  const sorted = normalizeRankTiers([
    { key: "gold", label: "Gold", min_points: 500, sort_order: 2 },
    { key: "bronze", label: "Bronze", min_points: 0, sort_order: 0 },
  ]);

  assert.equal(sorted[0]?.label, "Bronze");
  assert.equal(normalizeRankTiers(null)[0]?.label, DEFAULT_RANK_TIERS[0]?.label);
});

test("ranked identity snapshot sanitizer clamps unsafe numbers", () => {
  const snapshot = sanitizeRankedIdentitySnapshot({
    rankedPoints: -50,
    lifetimeXp: 12.8,
    currentRank: "",
    rankTiers: [],
  });

  assert.equal(snapshot?.rankedPoints, 0);
  assert.equal(snapshot?.lifetimeXp, 12);
  assert.equal(snapshot?.currentRank, "Bronze");
});
