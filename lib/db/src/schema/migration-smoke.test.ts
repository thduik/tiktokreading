import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const migrationDir = path.resolve(process.cwd(), "migrations");

test("daily answer stats migration defines the expected bucket table", async () => {
  const sql = await readFile(
    path.join(migrationDir, "0010_user_daily_answer_stats.sql"),
    "utf8",
  );

  assert.match(sql, /CREATE TABLE IF NOT EXISTS user_daily_answer_stats/i);
  assert.match(sql, /PRIMARY KEY \(user_id, local_date, band_group, question_type\)/i);
  assert.match(sql, /attempt_count = correct_count \+ wrong_count/i);
  assert.match(sql, /Band8Plus/);
  assert.match(sql, /Matching/);
});

test("user progress migration still protects nonnegative scoring counters", async () => {
  const sql = await readFile(path.join(migrationDir, "0006_user_progress.sql"), "utf8");

  assert.match(sql, /ranked_points INTEGER NOT NULL DEFAULT 0/i);
  assert.match(sql, /lifetime_xp INTEGER NOT NULL DEFAULT 0/i);
  assert.match(sql, /CHECK \(ranked_points >= 0\)/i);
});
