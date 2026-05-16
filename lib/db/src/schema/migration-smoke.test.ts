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

test("leaderboard migration adds ranked lookup indexes", async () => {
  const sql = await readFile(
    path.join(migrationDir, "0011_leaderboard_indexes.sql"),
    "utf8",
  );

  assert.match(sql, /CREATE INDEX IF NOT EXISTS user_progress_ranked_points_idx/i);
  assert.match(sql, /ranked_points DESC, total_correct DESC/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS user_progress_rank_leaderboard_idx/i);
  assert.match(sql, /current_rank, ranked_points DESC, total_correct DESC/i);
});

test("rank tiers correction migration restores Grandmaster and Challenger thresholds", async () => {
  const sql = await readFile(
    path.join(migrationDir, "0012_fix_rank_tiers.sql"),
    "utf8",
  );

  assert.match(sql, /'grandmaster', 'Grandmaster', 2700, 6/i);
  assert.match(sql, /'challenger', 'Challenger', 3500, 7/i);
  assert.match(sql, /DELETE FROM rank_tiers/i);
});

test("vocab bank migration creates a user-scoped dictionary table", async () => {
  const sql = await readFile(
    path.join(migrationDir, "0013_user_vocab_bank.sql"),
    "utf8",
  );

  assert.match(sql, /CREATE TABLE IF NOT EXISTS user_vocab_bank/i);
  assert.match(sql, /PRIMARY KEY \(user_id, normalized_term\)/i);
  assert.match(sql, /REFERENCES user_profiles\(user_id\) ON DELETE CASCADE/i);
  assert.match(sql, /source_passage_id TEXT NULL REFERENCES passages\(id\) ON DELETE SET NULL/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS user_vocab_bank_user_created_idx/i);
});

test("public user id migration backfills and enforces a unique public identifier", async () => {
  const sql = await readFile(
    path.join(migrationDir, "0015_user_profiles_public_user_id.sql"),
    "utf8",
  );

  assert.match(sql, /ADD COLUMN IF NOT EXISTS public_user_id TEXT/i);
  assert.match(sql, /UPDATE user_profiles/i);
  assert.match(sql, /CONCAT\('reader_', SUBSTRING\(md5\(user_id\) FROM 1 FOR 12\)\)/i);
  assert.match(sql, /ALTER COLUMN public_user_id SET NOT NULL/i);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_public_user_id_uidx/i);
});

test("question timing migration creates an append-only timing events table", async () => {
  const sql = await readFile(
    path.join(migrationDir, "0016_user_question_timing_events.sql"),
    "utf8",
  );

  assert.match(sql, /CREATE TABLE IF NOT EXISTS user_question_timing_events/i);
  assert.match(sql, /elapsed_seconds INTEGER NOT NULL/i);
  assert.match(sql, /display_position INTEGER NOT NULL/i);
  assert.match(sql, /CHECK \(elapsed_seconds >= 0 AND elapsed_seconds <= 14400\)/i);
  assert.match(sql, /CHECK \(display_position >= 1\)/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS user_question_timing_events_user_date_idx/i);
});
