UPDATE rank_tiers
SET
  min_points = 3500,
  sort_order = 7
WHERE key = 'challenger';

INSERT INTO rank_tiers (key, label, min_points, sort_order)
VALUES
  ('bronze', 'Bronze', 0, 0),
  ('silver', 'Silver', 200, 1),
  ('gold', 'Gold', 500, 2),
  ('platinum', 'Platinum', 900, 3),
  ('diamond', 'Diamond', 1400, 4),
  ('master', 'Master', 2000, 5),
  ('grandmaster', 'Grandmaster', 2700, 6),
  ('challenger', 'Challenger', 3500, 7)
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  min_points = EXCLUDED.min_points,
  sort_order = EXCLUDED.sort_order;

DELETE FROM rank_tiers
WHERE key NOT IN (
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'master',
  'grandmaster',
  'challenger'
);
