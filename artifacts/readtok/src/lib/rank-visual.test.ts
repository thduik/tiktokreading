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

  assert.equal(sorted[0]?.label, DEFAULT_RANK_TIERS[0]?.label);
  assert.equal(normalizeRankTiers(null)[0]?.label, DEFAULT_RANK_TIERS[0]?.label);
});

test("rank tier normalization rejects incomplete backend tier sets", () => {
  const normalized = normalizeRankTiers([
    { key: "bronze", label: "Bronze", min_points: 0, sort_order: 0 },
    { key: "silver", label: "Silver", min_points: 200, sort_order: 1 },
    { key: "gold", label: "Gold", min_points: 500, sort_order: 2 },
    { key: "platinum", label: "Platinum", min_points: 900, sort_order: 3 },
    { key: "diamond", label: "Diamond", min_points: 1400, sort_order: 4 },
    { key: "master", label: "Master", min_points: 2000, sort_order: 5 },
    { key: "challenger", label: "Challenger", min_points: 2800, sort_order: 6 },
  ]);

  assert.equal(normalized.at(-2)?.label, "Grandmaster");
  assert.equal(normalized.at(-1)?.label, "Challenger");
  assert.equal(normalized.at(-1)?.min_points, 3500);
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
