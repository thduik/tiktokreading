import type { RankTierThreshold, UserProgress } from "@/lib/profile-api";

export interface RankedIdentitySnapshot {
  rankedPoints: number;
  currentRank: string;
  lifetimeXp: number;
  rankTiers: RankTierThreshold[];
}

export interface RankPlateData {
  baseRank: string;
  division: "IV" | "III" | "II" | "I" | null;
  displayLabel: string;
  rankedPoints: number;
  progressPercent: number;
  nextLabel: string | null;
  pointsNeededForNextLabel: number;
}

export const DEFAULT_RANK_TIERS: RankTierThreshold[] = [
  { key: "bronze", label: "Bronze", min_points: 0, sort_order: 0 },
  { key: "silver", label: "Silver", min_points: 200, sort_order: 1 },
  { key: "gold", label: "Gold", min_points: 500, sort_order: 2 },
  { key: "platinum", label: "Platinum", min_points: 900, sort_order: 3 },
  { key: "diamond", label: "Diamond", min_points: 1400, sort_order: 4 },
  { key: "master", label: "Master", min_points: 2000, sort_order: 5 },
  { key: "grandmaster", label: "Grandmaster", min_points: 2700, sort_order: 6 },
  { key: "challenger", label: "Challenger", min_points: 3500, sort_order: 7 },
] satisfies RankTierThreshold[];

const DIVISIONS = ["IV", "III", "II", "I"] as const;

function hasCompleteRankTierSet(rankTiers: RankTierThreshold[]) {
  if (rankTiers.length !== DEFAULT_RANK_TIERS.length) {
    return false;
  }

  return DEFAULT_RANK_TIERS.every((defaultTier) =>
    rankTiers.some(
      (candidate) =>
        candidate.key === defaultTier.key &&
        candidate.label === defaultTier.label &&
        candidate.min_points === defaultTier.min_points,
    ),
  );
}

export function normalizeRankTiers(rankTiers?: RankTierThreshold[] | null) {
  const source =
    Array.isArray(rankTiers) && rankTiers.length > 0 && hasCompleteRankTierSet(rankTiers)
      ? rankTiers
      : DEFAULT_RANK_TIERS;
  return [...source].sort((left, right) => left.min_points - right.min_points);
}

export function buildRankedIdentitySnapshot(
  progress: UserProgress,
  rankTiers?: RankTierThreshold[] | null,
): RankedIdentitySnapshot {
  return {
    rankedPoints: Math.max(0, progress.ranked_points),
    currentRank: progress.current_rank,
    lifetimeXp: Math.max(0, progress.lifetime_xp),
    rankTiers: normalizeRankTiers(rankTiers),
  };
}

export function sanitizeRankedIdentitySnapshot(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Partial<RankedIdentitySnapshot>;
  const rankedPoints = Number(source.rankedPoints);
  const lifetimeXp = Number(source.lifetimeXp);

  return {
    rankedPoints: Number.isFinite(rankedPoints) ? Math.max(0, Math.trunc(rankedPoints)) : 0,
    currentRank:
      typeof source.currentRank === "string" && source.currentRank.length > 0
        ? source.currentRank
        : "Bronze",
    lifetimeXp: Number.isFinite(lifetimeXp) ? Math.max(0, Math.trunc(lifetimeXp)) : 0,
    rankTiers: normalizeRankTiers(source.rankTiers),
  } satisfies RankedIdentitySnapshot;
}

export function getRankPlateData(
  rankedPoints: number,
  rankTiers?: RankTierThreshold[] | null,
  fallbackRank?: string | null,
): RankPlateData {
  const safePoints = Number.isFinite(rankedPoints) ? Math.max(0, Math.floor(rankedPoints)) : 0;
  const tiers = normalizeRankTiers(rankTiers);
  let currentTier = tiers[0];
  let nextTier: RankTierThreshold | null = null;

  for (let index = 0; index < tiers.length; index += 1) {
    const tier = tiers[index];
    if (safePoints >= tier.min_points) {
      currentTier = tier;
      nextTier = tiers[index + 1] ?? null;
      continue;
    }
    break;
  }

  const baseRank = currentTier?.label ?? fallbackRank ?? "Bronze";
  if (!nextTier) {
    return {
      baseRank,
      division: null,
      displayLabel: baseRank,
      rankedPoints: safePoints,
      progressPercent: 100,
      nextLabel: null,
      pointsNeededForNextLabel: 0,
    };
  }

  const span = Math.max(1, nextTier.min_points - currentTier.min_points);
  const pointsIntoCurrentTier = Math.max(0, safePoints - currentTier.min_points);
  const normalizedProgress = Math.min(pointsIntoCurrentTier / span, 0.999999);
  const divisionIndex = Math.min(3, Math.max(0, Math.floor(normalizedProgress * 4)));
  const division = DIVISIONS[divisionIndex];
  const progressPercent = Math.max(0, Math.min(100, Math.round(normalizedProgress * 100)));

  if (divisionIndex === 3) {
    return {
      baseRank,
      division,
      displayLabel: `${baseRank} ${division}`,
      rankedPoints: safePoints,
      progressPercent,
      nextLabel: nextTier.label,
      pointsNeededForNextLabel: Math.max(0, nextTier.min_points - safePoints),
    };
  }

  const nextDivisionBoundary = currentTier.min_points + Math.ceil(span * ((divisionIndex + 1) / 4));
  return {
    baseRank,
    division,
    displayLabel: `${baseRank} ${division}`,
    rankedPoints: safePoints,
    progressPercent,
    nextLabel: `${baseRank} ${DIVISIONS[divisionIndex + 1]}`,
    pointsNeededForNextLabel: Math.max(0, nextDivisionBoundary - safePoints),
  };
}
