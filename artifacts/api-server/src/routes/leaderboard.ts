import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  userAchievements,
  userDailyAnswerStats,
  userProfiles,
  userProgress,
} from "@workspace/db";
import { type RankName } from "@workspace/db/ranking";
import {
  addDaysToDateKey,
  buildAnswerStatsPeriod,
  readLocalDateKey,
  type AnswerStatsRow,
} from "../lib/answer-stats";
import {
  leaderboardRowsCacheKey,
  leaderboardUserStatsCacheKey,
} from "../lib/cache/cache-keys";
import {
  passageCacheTtls,
  readJsonCacheResult,
  type JsonCacheStatus,
  writeJsonCache,
} from "../lib/cache/json-cache";
import { fetchRankTiers } from "../lib/rank-tiers";

const router: IRouter = Router();

const RANK_VALUES = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
] as const satisfies RankName[];

type LeaderboardScope = "global" | "rank";

type LeaderboardEntryRow = {
  user_id: string;
  public_user_id: string;
  display_name: string | null;
  current_rank: string;
  ranked_points: number;
  lifetime_xp: number;
  total_questions_answered: number;
  total_correct: number;
  total_incorrect: number;
  accuracy_percent: number;
  position: number;
};

function firstValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function parseLimit(raw: string | undefined) {
  if (!raw) {
    return 50;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, 100);
}

function parseScope(raw: string | undefined): LeaderboardScope | null {
  if (!raw || raw === "global") {
    return "global";
  }
  if (raw === "rank") {
    return "rank";
  }
  return null;
}

function parseRank(raw: string | undefined): RankName | null {
  if (!raw) {
    return null;
  }

  const match = RANK_VALUES.find((rank) => rank.toLowerCase() === raw.toLowerCase());
  return match ?? null;
}

function getSafeAuth(req: Request) {
  try {
    return getAuth(req);
  } catch {
    return null;
  }
}

function buildFallbackDisplayName(userId: string) {
  const suffix = userId.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase();
  return `Reader ${suffix || "0000"}`;
}

function toLeaderboardEntry(
  row: LeaderboardEntryRow,
  viewerUserId: string | null,
) {
  const normalizedDisplayName = row.display_name?.trim();
  const displayName =
    normalizedDisplayName && normalizedDisplayName.length > 0
      ? normalizedDisplayName
      : buildFallbackDisplayName(row.user_id);

  return {
    public_user_id: row.public_user_id,
    display_name: displayName,
    current_rank: row.current_rank,
    ranked_points: row.ranked_points,
    lifetime_xp: row.lifetime_xp,
    total_questions_answered: row.total_questions_answered,
    total_correct: row.total_correct,
    total_incorrect: row.total_incorrect,
    accuracy_percent: row.accuracy_percent,
    position: row.position,
    is_viewer: viewerUserId === row.user_id,
  };
}

function coerceLeaderboardRow(row: Record<string, unknown>): LeaderboardEntryRow {
  return {
    user_id: String(row.user_id ?? ""),
    public_user_id: String(row.public_user_id ?? ""),
    display_name: typeof row.display_name === "string" ? row.display_name : null,
    current_rank: String(row.current_rank ?? "Bronze"),
    ranked_points: Number(row.ranked_points ?? 0),
    lifetime_xp: Number(row.lifetime_xp ?? 0),
    total_questions_answered: Number(row.total_questions_answered ?? 0),
    total_correct: Number(row.total_correct ?? 0),
    total_incorrect: Number(row.total_incorrect ?? 0),
    accuracy_percent: Number(row.accuracy_percent ?? 0),
    position: Number(row.position ?? 0),
  };
}

async function fetchLeaderboardRows({
  scope,
  rank,
  limit,
}: {
  scope: LeaderboardScope;
  rank: RankName | null;
  limit: number;
}): Promise<{ rows: LeaderboardEntryRow[]; cacheStatus: JsonCacheStatus }> {
  const cacheKey = leaderboardRowsCacheKey({
    scope,
    rank,
    limit,
  });
  const cached = await readJsonCacheResult<LeaderboardEntryRow[]>(cacheKey);
  if (cached.value) {
    return { rows: cached.value, cacheStatus: "HIT" };
  }

  const rankFilter = scope === "rank" && rank ? sql`AND up.current_rank = ${rank}` : sql``;

  const result = await db.execute(sql<LeaderboardEntryRow>`
    SELECT
      ranked.user_id,
      ranked.public_user_id,
      ranked.display_name,
      ranked.current_rank,
      ranked.ranked_points,
      ranked.lifetime_xp,
      ranked.total_questions_answered,
      ranked.total_correct,
      ranked.total_incorrect,
      ranked.accuracy_percent,
      ranked.position
    FROM (
      SELECT
        up.user_id,
        profile.public_user_id,
        profile.display_name,
        up.current_rank,
        up.ranked_points,
        up.lifetime_xp,
        up.total_questions_answered,
        up.total_correct,
        up.total_incorrect,
        CASE
          WHEN up.total_questions_answered > 0
            THEN ROUND((up.total_correct::numeric * 100.0) / up.total_questions_answered)::int
          ELSE 0
        END AS accuracy_percent,
        RANK() OVER (
          ORDER BY
            up.ranked_points DESC,
            up.total_correct DESC,
            up.total_questions_answered DESC,
            up.updated_at ASC,
            up.user_id ASC
        ) AS position
      FROM ${userProgress} up
      INNER JOIN ${userProfiles} profile
        ON profile.user_id = up.user_id
      WHERE up.total_questions_answered > 0
      ${rankFilter}
    ) ranked
    ORDER BY ranked.position ASC
    LIMIT ${limit};
  `);

  const rows = result.rows.map((row) =>
    coerceLeaderboardRow(row as Record<string, unknown>),
  );

  await writeJsonCache({
    key: cacheKey,
    value: rows,
    ttlSeconds: passageCacheTtls.leaderboardSeconds,
  });

  return { rows, cacheStatus: cached.status === "BYPASS" ? "BYPASS" : "MISS" };
}

async function fetchViewerRow({
  userId,
  scope,
  rank,
}: {
  userId: string;
  scope: LeaderboardScope;
  rank: RankName | null;
}) {
  const rankFilter = scope === "rank" && rank ? sql`AND up.current_rank = ${rank}` : sql``;

  const result = await db.execute(sql<LeaderboardEntryRow>`
    SELECT
      ranked.user_id,
      ranked.public_user_id,
      ranked.display_name,
      ranked.current_rank,
      ranked.ranked_points,
      ranked.lifetime_xp,
      ranked.total_questions_answered,
      ranked.total_correct,
      ranked.total_incorrect,
      ranked.accuracy_percent,
      ranked.position
    FROM (
      SELECT
        up.user_id,
        profile.public_user_id,
        profile.display_name,
        up.current_rank,
        up.ranked_points,
        up.lifetime_xp,
        up.total_questions_answered,
        up.total_correct,
        up.total_incorrect,
        CASE
          WHEN up.total_questions_answered > 0
            THEN ROUND((up.total_correct::numeric * 100.0) / up.total_questions_answered)::int
          ELSE 0
        END AS accuracy_percent,
        RANK() OVER (
          ORDER BY
            up.ranked_points DESC,
            up.total_correct DESC,
            up.total_questions_answered DESC,
            up.updated_at ASC,
            up.user_id ASC
        ) AS position
      FROM ${userProgress} up
      INNER JOIN ${userProfiles} profile
        ON profile.user_id = up.user_id
      WHERE up.total_questions_answered > 0
      ${rankFilter}
    ) ranked
    WHERE ranked.user_id = ${userId}
    LIMIT 1;
  `);

  const firstRow = result.rows[0];
  return firstRow ? coerceLeaderboardRow(firstRow as Record<string, unknown>) : null;
}

async function fetchAnswerStatsRows({
  userId,
  fromDate,
  toDate,
}: {
  userId: string;
  fromDate?: string;
  toDate?: string;
}) {
  const conditions = [eq(userDailyAnswerStats.userId, userId)];
  if (fromDate) {
    conditions.push(gte(userDailyAnswerStats.localDate, fromDate));
  }
  if (toDate) {
    conditions.push(lte(userDailyAnswerStats.localDate, toDate));
  }

  return db
    .select({
      bandGroup: userDailyAnswerStats.bandGroup,
      questionType: userDailyAnswerStats.questionType,
      attemptCount: sql<number>`coalesce(sum(${userDailyAnswerStats.attemptCount}), 0)::int`,
      correctCount: sql<number>`coalesce(sum(${userDailyAnswerStats.correctCount}), 0)::int`,
      wrongCount: sql<number>`coalesce(sum(${userDailyAnswerStats.wrongCount}), 0)::int`,
    })
    .from(userDailyAnswerStats)
    .where(and(...conditions))
    .groupBy(userDailyAnswerStats.bandGroup, userDailyAnswerStats.questionType);
}

async function fetchPublicUserStats({
  publicUserId,
  localDate,
}: {
  publicUserId: string;
  localDate: string;
}) {
  const cacheKey = leaderboardUserStatsCacheKey({
    publicUserId,
    localDate,
  });
  const cached = await readJsonCacheResult<{
    user: { public_user_id: string; display_name: string };
    progress: {
      current_rank: string;
      ranked_points: number;
      lifetime_xp: number;
      total_questions_answered: number;
      total_correct: number;
      total_incorrect: number;
      accuracy_percent: number;
    };
    positions: {
      global: number | null;
      rank: number | null;
    };
    periods: {
      today: ReturnType<typeof buildAnswerStatsPeriod>;
      last7: ReturnType<typeof buildAnswerStatsPeriod>;
      last30: ReturnType<typeof buildAnswerStatsPeriod>;
      lifetime: ReturnType<typeof buildAnswerStatsPeriod>;
    };
    achievements: {
      total_unlocked: number;
      top: Array<{
        achievement_key: string;
        achievement_title: string;
        achievement_category: string;
        achievement_tier: string;
        achievement_xp: number;
        unlocked_at: string;
      }>;
      items: Array<{
        achievement_key: string;
        achievement_title: string;
        achievement_category: string;
        achievement_tier: string;
        achievement_xp: number;
        unlocked_at: string;
      }>;
    };
  }>(cacheKey);
  if (cached.value) {
    return { payload: cached.value, cacheStatus: cached.status };
  }

  const profileRows = await db
    .select({
      userId: userProfiles.userId,
      publicUserId: userProfiles.publicUserId,
      displayName: userProfiles.displayName,
    })
    .from(userProfiles)
    .where(eq(userProfiles.publicUserId, publicUserId))
    .limit(1);

  const profile = profileRows[0];
  if (!profile) {
    return { payload: null, cacheStatus: cached.status === "BYPASS" ? "BYPASS" : "MISS" };
  }

  const [progressRows, achievementRows, todayRows, last7Rows, last30Rows, lifetimeRows, globalRow, rankRow] =
    await Promise.all([
      db.select().from(userProgress).where(eq(userProgress.userId, profile.userId)).limit(1),
      db
        .select({
          achievementKey: userAchievements.achievementKey,
          achievementTitle: userAchievements.achievementTitle,
          achievementCategory: userAchievements.achievementCategory,
          achievementTier: userAchievements.achievementTier,
          achievementXp: userAchievements.achievementXp,
          unlockedAt: userAchievements.unlockedAt,
        })
        .from(userAchievements)
        .where(eq(userAchievements.userId, profile.userId))
        .orderBy(
          sql`${userAchievements.achievementXp} DESC`,
          sql`${userAchievements.unlockedAt} DESC`,
          sql`${userAchievements.achievementKey} ASC`,
        ),
      fetchAnswerStatsRows({
        userId: profile.userId,
        fromDate: localDate,
        toDate: localDate,
      }),
      fetchAnswerStatsRows({
        userId: profile.userId,
        fromDate: addDaysToDateKey(localDate, -6),
        toDate: localDate,
      }),
      fetchAnswerStatsRows({
        userId: profile.userId,
        fromDate: addDaysToDateKey(localDate, -29),
        toDate: localDate,
      }),
      fetchAnswerStatsRows({ userId: profile.userId }),
      fetchViewerRow({ userId: profile.userId, scope: "global", rank: null }),
      db.execute(sql<LeaderboardEntryRow>`
        SELECT
          ranked.user_id,
          ranked.public_user_id,
          ranked.display_name,
          ranked.current_rank,
          ranked.ranked_points,
          ranked.lifetime_xp,
          ranked.total_questions_answered,
          ranked.total_correct,
          ranked.total_incorrect,
          ranked.accuracy_percent,
          ranked.position
        FROM (
          SELECT
            up.user_id,
            profile.public_user_id,
            profile.display_name,
            up.current_rank,
            up.ranked_points,
            up.lifetime_xp,
            up.total_questions_answered,
            up.total_correct,
            up.total_incorrect,
            CASE
              WHEN up.total_questions_answered > 0
                THEN ROUND((up.total_correct::numeric * 100.0) / up.total_questions_answered)::int
              ELSE 0
            END AS accuracy_percent,
            RANK() OVER (
              PARTITION BY up.current_rank
              ORDER BY
                up.ranked_points DESC,
                up.total_correct DESC,
                up.total_questions_answered DESC,
                up.updated_at ASC,
                up.user_id ASC
            ) AS position
          FROM ${userProgress} up
          INNER JOIN ${userProfiles} profile
            ON profile.user_id = up.user_id
          WHERE up.total_questions_answered > 0
        ) ranked
        WHERE ranked.user_id = ${profile.userId}
        LIMIT 1;
      `),
    ]);

  const progress = progressRows[0];
  if (!progress) {
    return { payload: null, cacheStatus: cached.status === "BYPASS" ? "BYPASS" : "MISS" };
  }

  const displayName =
    profile.displayName?.trim() && profile.displayName.trim().length > 0
      ? profile.displayName.trim()
      : buildFallbackDisplayName(profile.userId);
  const rankPositionRow = rankRow.rows[0]
    ? coerceLeaderboardRow(rankRow.rows[0] as Record<string, unknown>)
    : null;
  const publicAchievements = achievementRows.map((item) => ({
    achievement_key: item.achievementKey,
    achievement_title: item.achievementTitle,
    achievement_category: item.achievementCategory,
    achievement_tier: item.achievementTier,
    achievement_xp: item.achievementXp,
    unlocked_at: item.unlockedAt.toISOString(),
  }));

  const payload = {
    user: {
      public_user_id: profile.publicUserId,
      display_name: displayName,
    },
    progress: {
      current_rank: progress.currentRank,
      ranked_points: progress.rankedPoints,
      lifetime_xp: progress.lifetimeXp,
      total_questions_answered: progress.totalQuestionsAnswered,
      total_correct: progress.totalCorrect,
      total_incorrect: progress.totalIncorrect,
      accuracy_percent:
        progress.totalQuestionsAnswered > 0
          ? Math.round((progress.totalCorrect / progress.totalQuestionsAnswered) * 100)
          : 0,
    },
    positions: {
      global: globalRow?.position ?? null,
      rank: rankPositionRow?.position ?? null,
    },
    periods: {
      today: buildAnswerStatsPeriod(todayRows as AnswerStatsRow[]),
      last7: buildAnswerStatsPeriod(last7Rows as AnswerStatsRow[]),
      last30: buildAnswerStatsPeriod(last30Rows as AnswerStatsRow[]),
      lifetime: buildAnswerStatsPeriod(lifetimeRows as AnswerStatsRow[]),
    },
    achievements: {
      total_unlocked: publicAchievements.length,
      top: publicAchievements.slice(0, 3),
      items: publicAchievements,
    },
  };

  await writeJsonCache({
    key: cacheKey,
    value: payload,
    ttlSeconds: passageCacheTtls.leaderboardSeconds,
  });

  return { payload, cacheStatus: cached.status === "BYPASS" ? "BYPASS" : "MISS" };
}

router.get("/leaderboard", async (req, res) => {
  const scope = parseScope(firstValue(req.query.scope));
  if (!scope) {
    res.status(400).json({ error: "Invalid leaderboard scope" });
    return;
  }

  const limit = parseLimit(firstValue(req.query.limit));
  if (limit === null) {
    res.status(400).json({ error: "Invalid leaderboard limit" });
    return;
  }

  const rank = parseRank(firstValue(req.query.rank));
  if (scope === "rank" && !rank) {
    res.status(400).json({ error: "Rank leaderboard requires a valid rank" });
    return;
  }

  const auth = getSafeAuth(req);
  const viewerUserId = auth?.userId ?? null;

  const [leaderboardResult, viewerRow, rankTiersResult] = await Promise.all([
    fetchLeaderboardRows({ scope, rank, limit }),
    viewerUserId ? fetchViewerRow({ userId: viewerUserId, scope, rank }) : Promise.resolve(null),
    fetchRankTiers(),
  ]);

  res.setHeader("x-cache-leaderboard", leaderboardResult.cacheStatus);
  res.setHeader("x-cache-rank-tiers", rankTiersResult.cacheStatus);
  res.json({
    scope,
    rank: scope === "rank" ? rank : null,
    rank_tiers: rankTiersResult.tiers,
    items: leaderboardResult.rows.map((row) => toLeaderboardEntry(row, viewerUserId)),
    viewer: viewerRow ? toLeaderboardEntry(viewerRow, viewerUserId) : null,
  });
});

router.get("/leaderboard/users/:publicUserId/stats", async (req, res) => {
  const publicUserId =
    typeof req.params.publicUserId === "string" ? req.params.publicUserId.trim() : "";
  if (!/^reader_[a-z0-9]{12}$/i.test(publicUserId)) {
    res.status(400).json({ error: "Invalid public user id" });
    return;
  }

  const localDate = readLocalDateKey(req.query.local_date);
  const result = await fetchPublicUserStats({ publicUserId, localDate });
  res.setHeader("x-cache-leaderboard-user-stats", result.cacheStatus);

  if (!result.payload) {
    res.status(404).json({ error: "Public leaderboard user not found" });
    return;
  }

  res.json({
    local_date: localDate,
    localDate,
    ...result.payload,
  });
});

export default router;
