export const ACHIEVEMENT_LEVEL_THRESHOLDS = [
  0, 120, 280, 480, 740, 1060, 1440, 1880, 2380, 2940, 3560, 4240,
] as const;

export function generatePublicUserId() {
  return `reader_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

export function parseOptionalBoundedInteger(
  value: unknown,
  { min, max }: { min: number; max: number },
) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
}

export function readEmailFromClaims(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") {
    return null;
  }

  const email = (claims as { email?: unknown }).email;
  if (typeof email === "string" && email.trim().length > 0) {
    return email.trim().toLowerCase();
  }

  const primaryEmail = (
    claims as { primary_email_address?: unknown }
  ).primary_email_address;
  if (typeof primaryEmail === "string" && primaryEmail.trim().length > 0) {
    return primaryEmail.trim().toLowerCase();
  }

  return null;
}

export function toResponseProfile(row: {
  userId: string;
  publicUserId: string;
  email: string;
  displayName: string | null;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    user_id: row.userId,
    public_user_id: row.publicUserId,
    email: row.email,
    display_name: row.displayName,
    onboarding_completed: row.onboardingCompleted,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function toResponseProgress(row: {
  userId: string;
  lifetimeXp: number;
  rankedPoints: number;
  currentRank: string;
  totalQuestionsAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    user_id: row.userId,
    lifetime_xp: row.lifetimeXp,
    ranked_points: row.rankedPoints,
    current_rank: row.currentRank,
    total_questions_answered: row.totalQuestionsAnswered,
    total_correct: row.totalCorrect,
    total_incorrect: row.totalIncorrect,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function toPercent(correct: number, attempted: number) {
  if (attempted <= 0) {
    return 0;
  }
  return Math.round((correct / attempted) * 100);
}

export function normalizeVocabBankTerm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function getAchievementLevelByXp(totalXp: number) {
  const safeXp = Number.isFinite(totalXp) ? Math.max(0, Math.trunc(totalXp)) : 0;
  let levelIndex = 0;
  for (let index = 0; index < ACHIEVEMENT_LEVEL_THRESHOLDS.length; index += 1) {
    if (safeXp >= ACHIEVEMENT_LEVEL_THRESHOLDS[index]) {
      levelIndex = index;
    } else {
      break;
    }
  }
  const currentLevel = levelIndex + 1;
  const currentThreshold = ACHIEVEMENT_LEVEL_THRESHOLDS[levelIndex] ?? 0;
  const nextThreshold = ACHIEVEMENT_LEVEL_THRESHOLDS[levelIndex + 1] ?? null;
  const xpIntoLevel = safeXp - currentThreshold;
  const xpNeededForNextLevel = nextThreshold === null ? 0 : nextThreshold - safeXp;
  const xpRange = nextThreshold === null ? 1 : Math.max(1, nextThreshold - currentThreshold);
  const progressPercent =
    nextThreshold === null
      ? 100
      : Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpRange) * 100)));

  return {
    total_xp: safeXp,
    current_level: currentLevel,
    current_level_xp_floor: currentThreshold,
    next_level_xp_floor: nextThreshold,
    xp_into_level: Math.max(0, xpIntoLevel),
    xp_needed_for_next_level: Math.max(0, xpNeededForNextLevel),
    progress_percent: progressPercent,
  };
}
