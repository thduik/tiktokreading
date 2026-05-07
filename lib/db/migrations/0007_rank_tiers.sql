CREATE TABLE IF NOT EXISTS rank_tiers (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  min_points INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  CONSTRAINT rank_tiers_min_points_nonnegative_chk CHECK (min_points >= 0),
  CONSTRAINT rank_tiers_sort_order_nonnegative_chk CHECK (sort_order >= 0),
  CONSTRAINT rank_tiers_sort_order_uidx UNIQUE (sort_order)
);

INSERT INTO rank_tiers (key, label, min_points, sort_order)
VALUES
  ('bronze', 'Bronze', 0, 0),
  ('silver', 'Silver', 200, 1),
  ('gold', 'Gold', 500, 2),
  ('platinum', 'Platinum', 900, 3),
  ('diamond', 'Diamond', 1400, 4),
  ('master', 'Master', 2000, 5),
  ('challenger', 'Challenger', 2800, 6)
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  min_points = EXCLUDED.min_points,
  sort_order = EXCLUDED.sort_order;
