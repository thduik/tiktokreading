import { desc, eq, sql } from "drizzle-orm";
import {
  db,
  userAchievements,
  userDailyAnswerStats,
  userProfiles,
  userProgress,
} from "@workspace/db";
import { addDaysToDateKey } from "./answer-stats";
export {
  generatePublicUserId,
  normalizeDisplayName,
  parseOptionalBoundedInteger,
  readEmailFromClaims,
  toResponseProfile,
  toResponseProgress,
  toPercent,
  normalizeVocabBankTerm,
  getAchievementLevelByXp,
} from "./profile-utils";
import {
  generatePublicUserId,
  getAchievementLevelByXp,
  readEmailFromClaims,
} from "./profile-utils";

type AuthWithUserId = {
  userId: string;
  sessionClaims?: unknown;
};

type PracticeStreakState = {
  currentPracticeStreakDays: number;
  bestPracticeStreakDays: number;
  lastPracticeDateLocal: string | null;
};

export const PRACTICE_STREAK_GRACE_MISSED_DAYS = 3;

function getDateKeyDistance(fromDate: string, toDate: string) {
  const fromMs = Date.parse(`${fromDate}T00:00:00Z`);
  const toMs = Date.parse(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return 0;
  }
  return Math.round((toMs - fromMs) / 86400000);
}

function buildPracticeStreakStateFromActiveDates(activeDatesDesc: string[]): PracticeStreakState {
  if (activeDatesDesc.length === 0) {
    return {
      currentPracticeStreakDays: 0,
      bestPracticeStreakDays: 0,
      lastPracticeDateLocal: null,
    };
  }

  const uniqueActiveDatesAsc = [...new Set(activeDatesDesc)].sort((left, right) =>
    left.localeCompare(right),
  );
  const lastPracticeDateLocal = uniqueActiveDatesAsc[uniqueActiveDatesAsc.length - 1] ?? null;

  let currentRun = 0;
  let bestRun = 0;
  let previousDate: string | null = null;
  for (const activeDate of uniqueActiveDatesAsc) {
    if (previousDate && getDateKeyDistance(previousDate, activeDate) === 1) {
      currentRun += 1;
    } else {
      currentRun = 1;
    }
    bestRun = Math.max(bestRun, currentRun);
    previousDate = activeDate;
  }

  let endingRun = 0;
  if (lastPracticeDateLocal) {
    let cursor = lastPracticeDateLocal;
    const activeSet = new Set(uniqueActiveDatesAsc);
    while (activeSet.has(cursor)) {
      endingRun += 1;
      cursor = addDaysToDateKey(cursor, -1);
    }
  }

  return {
    currentPracticeStreakDays: endingRun,
    bestPracticeStreakDays: bestRun,
    lastPracticeDateLocal,
  };
}

async function hydratePracticeStreakState(row: typeof userProgress.$inferSelect) {
  const shouldHydrate =
    row.currentPracticeStreakDays === 0 && row.bestPracticeStreakDays === 0;
  if (!shouldHydrate) {
    return row;
  }

  const rows = await db
    .select({
      localDate: userDailyAnswerStats.localDate,
      attempted: sql<number>`coalesce(sum(${userDailyAnswerStats.attemptCount}), 0)::int`,
    })
    .from(userDailyAnswerStats)
    .where(eq(userDailyAnswerStats.userId, row.userId))
    .groupBy(userDailyAnswerStats.localDate)
    .orderBy(desc(userDailyAnswerStats.localDate))
    .limit(4000);

  const activeDates = rows
    .filter((item) => Number(item.attempted) > 0)
    .map((item) => String(item.localDate));

  const hydratedState = buildPracticeStreakStateFromActiveDates(activeDates);
  if (
    hydratedState.currentPracticeStreakDays === row.currentPracticeStreakDays &&
    hydratedState.bestPracticeStreakDays === row.bestPracticeStreakDays &&
    hydratedState.lastPracticeDateLocal === row.lastPracticeDateLocal
  ) {
    return row;
  }

  const updatedRows = await db
    .update(userProgress)
    .set({
      currentPracticeStreakDays: hydratedState.currentPracticeStreakDays,
      bestPracticeStreakDays: hydratedState.bestPracticeStreakDays,
      lastPracticeDateLocal: hydratedState.lastPracticeDateLocal,
      updatedAt: new Date(),
    })
    .where(eq(userProgress.userId, row.userId))
    .returning();

  return updatedRows[0] ?? row;
}

export function getVisiblePracticeStreakDays({
  currentPracticeStreakDays,
  lastPracticeDateLocal,
  localDate,
}: PracticeStreakState & { localDate: string }) {
  if (!lastPracticeDateLocal || currentPracticeStreakDays <= 0) {
    return 0;
  }

  const dayDistance = getDateKeyDistance(lastPracticeDateLocal, localDate);
  if (dayDistance <= 0) {
    return currentPracticeStreakDays;
  }

  const missedDays = Math.max(0, dayDistance - 1);
  if (missedDays <= PRACTICE_STREAK_GRACE_MISSED_DAYS) {
    return currentPracticeStreakDays;
  }

  return 0;
}

export function advancePracticeStreakState({
  currentPracticeStreakDays,
  bestPracticeStreakDays,
  lastPracticeDateLocal,
  localDate,
}: PracticeStreakState & { localDate: string }): PracticeStreakState {
  if (!lastPracticeDateLocal) {
    return {
      currentPracticeStreakDays: 1,
      bestPracticeStreakDays: Math.max(bestPracticeStreakDays, 1),
      lastPracticeDateLocal: localDate,
    };
  }

  const dayDistance = getDateKeyDistance(lastPracticeDateLocal, localDate);
  if (dayDistance <= 0) {
    return {
      currentPracticeStreakDays,
      bestPracticeStreakDays: Math.max(
        bestPracticeStreakDays,
        currentPracticeStreakDays,
      ),
      lastPracticeDateLocal,
    };
  }

  // If the user returns after missing up to three full local days, we preserve
  // their current streak and continue it on the next practiced day.
  const missedDays = Math.max(0, dayDistance - 1);
  const nextCurrentPracticeStreakDays =
    missedDays <= PRACTICE_STREAK_GRACE_MISSED_DAYS
      ? currentPracticeStreakDays + 1
      : 1;

  return {
    currentPracticeStreakDays: nextCurrentPracticeStreakDays,
    bestPracticeStreakDays: Math.max(
      bestPracticeStreakDays,
      nextCurrentPracticeStreakDays,
    ),
    lastPracticeDateLocal: localDate,
  };
}

export async function fetchUserAchievementsWithSummary(userId: string) {
  const items = await db
    .select({
      achievementKey: userAchievements.achievementKey,
      achievementTitle: userAchievements.achievementTitle,
      achievementCategory: userAchievements.achievementCategory,
      achievementTier: userAchievements.achievementTier,
      achievementXp: userAchievements.achievementXp,
      unlockedAt: userAchievements.unlockedAt,
      createdAt: userAchievements.createdAt,
      updatedAt: userAchievements.updatedAt,
    })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.unlockedAt), desc(userAchievements.createdAt));

  const totalXp =
    items.reduce((sum, item) => sum + Math.max(0, Number(item.achievementXp) || 0), 0) ?? 0;

  return {
    items: items.map((item) => ({
      achievement_key: item.achievementKey,
      achievement_title: item.achievementTitle,
      achievement_category: item.achievementCategory,
      achievement_tier: item.achievementTier,
      achievement_xp: item.achievementXp,
      unlocked_at: item.unlockedAt.toISOString(),
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    })),
    unlocked_keys: items.map((item) => item.achievementKey),
    summary: getAchievementLevelByXp(totalXp),
  };
}

export async function ensureUserProgress(userId: string) {
  const existingRows = await db
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, userId))
    .limit(1);
  if (existingRows.length > 0) {
    return hydratePracticeStreakState(existingRows[0]);
  }

  const insertedRows = await db
    .insert(userProgress)
    .values({
      userId,
      lifetimeXp: 0,
      rankedPoints: 0,
      currentRank: "Bronze",
      totalQuestionsAnswered: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      currentPracticeStreakDays: 0,
      bestPracticeStreakDays: 0,
      lastPracticeDateLocal: null,
    })
    .returning();

  return hydratePracticeStreakState(insertedRows[0]);
}

export async function createUserProfile({
  userId,
  email,
  displayName,
  onboardingCompleted,
}: {
  userId: string;
  email: string;
  displayName: string | null;
  onboardingCompleted: boolean;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const insertedRows = await db
        .insert(userProfiles)
        .values({
          userId,
          publicUserId: generatePublicUserId(),
          email,
          displayName,
          onboardingCompleted,
        })
        .onConflictDoNothing({
          target: userProfiles.userId,
        })
        .returning();

      if (insertedRows[0]) {
        return insertedRows[0];
      }

      const existingRows = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      if (existingRows[0]) {
        return existingRows[0];
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("user_profiles_public_user_id_uidx")) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not allocate a unique public user id");
}

export async function ensureUserProfileForAuth({
  auth,
  email,
  displayName,
}: {
  auth: AuthWithUserId;
  email?: string | null;
  displayName?: string | null;
}) {
  const existingRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, auth.userId))
    .limit(1);

  if (existingRows.length > 0) {
    return existingRows[0];
  }

  const normalizedEmail =
    email ??
    readEmailFromClaims(auth.sessionClaims) ??
    `${auth.userId}@readtok.local`;

  return createUserProfile({
    userId: auth.userId,
    email: normalizedEmail,
    displayName: displayName ?? null,
    onboardingCompleted: Boolean(displayName),
  });
}
