import { desc, eq, lte, sql, and } from "drizzle-orm";
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
    return existingRows[0];
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
    })
    .returning();

  return insertedRows[0];
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
        .returning();

      return insertedRows[0];
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

export async function fetchCurrentPracticeStreakDays({
  userId,
  localDate,
}: {
  userId: string;
  localDate: string;
}) {
  const rows = await db
    .select({
      localDate: userDailyAnswerStats.localDate,
      attempted: sql<number>`coalesce(sum(${userDailyAnswerStats.attemptCount}), 0)::int`,
    })
    .from(userDailyAnswerStats)
    .where(
      and(
        eq(userDailyAnswerStats.userId, userId),
        lte(userDailyAnswerStats.localDate, localDate),
      ),
    )
    .groupBy(userDailyAnswerStats.localDate)
    .orderBy(desc(userDailyAnswerStats.localDate))
    .limit(400);

  const activeDateSet = new Set(
    rows
      .filter((row) => Number(row.attempted) > 0)
      .map((row) => String(row.localDate)),
  );

  let cursor = localDate;
  if (!activeDateSet.has(cursor)) {
    cursor = addDaysToDateKey(localDate, -1);
  }
  if (!activeDateSet.has(cursor)) {
    return 0;
  }

  let streak = 0;
  while (activeDateSet.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  return streak;
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

  const insertedRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, auth.userId))
    .limit(1);

  if (insertedRows.length > 0) {
    return insertedRows[0];
  }

  return createUserProfile({
    userId: auth.userId,
    email: normalizedEmail,
    displayName: displayName ?? null,
    onboardingCompleted: Boolean(displayName),
  });
}
