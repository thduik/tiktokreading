import test from "node:test";
import assert from "node:assert/strict";
import {
  formatElapsedTimer,
  selectRandomIdsFromPool,
  uniqueIds,
} from "@/lib/passage-feed-runtime";

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
