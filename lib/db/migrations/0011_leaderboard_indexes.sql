CREATE INDEX IF NOT EXISTS user_progress_ranked_points_idx
ON user_progress (ranked_points DESC, total_correct DESC);

CREATE INDEX IF NOT EXISTS user_progress_rank_leaderboard_idx
ON user_progress (current_rank, ranked_points DESC, total_correct DESC);
