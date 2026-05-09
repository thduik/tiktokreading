import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import {
  ANSWER_STAT_BAND_GROUP_VALUES,
  ANSWER_STAT_QUESTION_TYPE_VALUES,
  type AnswerStatBandGroup,
  type AnswerStatQuestionType,
  answerKeys,
  db,
  passages,
  questions,
  rankTiers,
  userDailyAnswerStats,
  userProfiles,
  userProgress,
} from "@workspace/db";
import {
  getNextRankProgress,
  normalizeBandLevel,
  submitAnswer,
  type RankName,
} from "@workspace/db/ranking";

const router: IRouter = Router();

type AnswerStatsRow = {
  bandGroup: AnswerStatBandGroup;
  questionType: AnswerStatQuestionType;
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
};

type AnswerStatCell = {
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
};

type AnswerStatsPeriod = {
  overall: AnswerStatCell;
  byBandAndType: Partial<
    Record<AnswerStatBandGroup, Partial<Record<AnswerStatQuestionType, AnswerStatCell>>>
  >;
};

function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function formatDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey: string, dayDelta: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dayDelta);
  return formatDateKey(date);
}

function normalizeLocalDateKey(raw: unknown) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return raw;
}

function readLocalDateKey(raw: unknown) {
  return normalizeLocalDateKey(raw) ?? formatDateKey(new Date());
}

function normalizeAnswerStatBandGroup(
  bandLabel: string | number,
): AnswerStatBandGroup {
  const normalized = String(bandLabel).trim().toLowerCase();

  if (normalized === "6" || normalized === "6.0" || normalized === "band 6.0") {
    return "Band6";
  }
  if (normalized === "7" || normalized === "7.0" || normalized === "band 7.0") {
    return "Band7";
  }
  if (
    normalized === "7.5" ||
    normalized === "band 7.5" ||
    normalized === "75"
  ) {
    return "Band75";
  }

  return "Band8Plus";
}

function normalizeAnswerStatQuestionType({
  questionTypeIndex,
  questionTypeLabel,
}: {
  questionTypeIndex: string;
  questionTypeLabel: string;
}): AnswerStatQuestionType {
  const label = questionTypeLabel.trim().toLowerCase();
  if (label.includes("matching")) {
    return "Matching";
  }

  if (questionTypeIndex === "tfng") {
    return "TFNG";
  }
  if (questionTypeIndex === "sentence_completion") {
    return "SentenceCompletion";
  }
  if (questionTypeIndex === "short_answer") {
    return "ShortAnswer";
  }

  return "MCQ";
}

function toAccuracy(correct: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((correct / total) * 1000) / 10;
}

function toAnswerStatCell(row: {
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
}): AnswerStatCell {
  return {
    total: row.attemptCount,
    correct: row.correctCount,
    wrong: row.wrongCount,
    accuracy: toAccuracy(row.correctCount, row.attemptCount),
  };
}

function buildAnswerStatsPeriod(rows: AnswerStatsRow[]): AnswerStatsPeriod {
  const byBandAndType: AnswerStatsPeriod["byBandAndType"] = {};
  const overall = {
    attemptCount: 0,
    correctCount: 0,
    wrongCount: 0,
  };

  for (const row of rows) {
    overall.attemptCount += row.attemptCount;
    overall.correctCount += row.correctCount;
    overall.wrongCount += row.wrongCount;

    const bandStats = byBandAndType[row.bandGroup] ?? {};
    bandStats[row.questionType] = toAnswerStatCell(row);
    byBandAndType[row.bandGroup] = bandStats;
  }

  return {
    overall: toAnswerStatCell(overall),
    byBandAndType,
  };
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

  const rows = await db
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

  return rows;
}

function readEmailFromClaims(claims: unknown): string | null {
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

function toResponseProfile(row: {
  userId: string;
  email: string;
  displayName: string | null;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    user_id: row.userId,
    email: row.email,
    display_name: row.displayName,
    onboarding_completed: row.onboardingCompleted,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function toResponseProgress(row: {
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

function toResponseTiers(
  rows: Array<{ key: string; label: string; minPoints: number; sortOrder: number }>,
) {
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    min_points: row.minPoints,
    sort_order: row.sortOrder,
  }));
}

async function fetchRankTiers() {
  const rows = await db.select().from(rankTiers).orderBy(asc(rankTiers.sortOrder));
  return toResponseTiers(rows);
}

async function ensureUserProgress(userId: string) {
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

function getUserIdOrRespondUnauthorized(req: Request, res: Response) {
  let auth: ReturnType<typeof getAuth> | null = null;
  try {
    auth = getAuth(req);
  } catch {
    auth = null;
  }
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return auth.userId;
}

function getSafeAuth(req: Request) {
  try {
    return getAuth(req);
  } catch {
    return null;
  }
}

router.get("/me", async (req, res) => {
  const userId = getUserIdOrRespondUnauthorized(req, res);
  if (!userId) {
    return;
  }

  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    res.json({ profile: null, progress: null, next_rank_progress: null, rank_tiers: [] });
    return;
  }

  const progress = await ensureUserProgress(userId);
  const tiers = await fetchRankTiers();
  res.json({
    profile: toResponseProfile(rows[0]),
    progress: toResponseProgress(progress),
    next_rank_progress: getNextRankProgress(progress.rankedPoints),
    rank_tiers: tiers,
  });
});

router.post("/me/bootstrap", async (req, res) => {
  const auth = getSafeAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = auth.userId;
  const body = req.body as Record<string, unknown> | undefined;
  const bodyEmail =
    typeof body?.email === "string" && body.email.trim().length > 0
      ? body.email.trim().toLowerCase()
      : null;
  const email = bodyEmail ?? readEmailFromClaims(auth.sessionClaims) ?? null;
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const displayName = normalizeDisplayName(body?.display_name);
  if (displayName !== undefined && displayName !== null && displayName.length > 40) {
    res.status(400).json({ error: "display_name must be at most 40 characters" });
    return;
  }

  const existingRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  const existing = existingRows[0];

  if (!existing) {
    const insertRows = await db
      .insert(userProfiles)
      .values({
        userId,
        email,
        displayName: displayName ?? null,
        onboardingCompleted: displayName !== null,
      })
      .returning();
    const progress = await ensureUserProgress(userId);
    const tiers = await fetchRankTiers();
    res.json({
      profile: toResponseProfile(insertRows[0]),
      progress: toResponseProgress(progress),
      next_rank_progress: getNextRankProgress(progress.rankedPoints),
      rank_tiers: tiers,
    });
    return;
  }

  const nextDisplayName =
    displayName !== undefined && displayName !== null
      ? displayName
      : existing.displayName;
  const nextOnboardingCompleted =
    existing.onboardingCompleted || (displayName !== undefined && displayName !== null);

  const updateRows = await db
    .update(userProfiles)
    .set({
      email,
      displayName: nextDisplayName,
      onboardingCompleted: nextOnboardingCompleted,
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId))
    .returning();
  const progress = await ensureUserProgress(userId);
  const tiers = await fetchRankTiers();
  res.json({
    profile: toResponseProfile(updateRows[0]),
    progress: toResponseProgress(progress),
    next_rank_progress: getNextRankProgress(progress.rankedPoints),
    rank_tiers: tiers,
  });
});

router.patch("/me", async (req, res) => {
  const userId = getUserIdOrRespondUnauthorized(req, res);
  if (!userId) {
    return;
  }

  const body = req.body as Record<string, unknown> | undefined;
  const displayName = normalizeDisplayName(body?.display_name);
  const onboardingCompletedRaw = body?.onboarding_completed;

  if (displayName !== undefined && displayName !== null) {
    if (displayName.length < 2) {
      res.status(400).json({ error: "display_name must be at least 2 characters" });
      return;
    }
    if (displayName.length > 40) {
      res.status(400).json({ error: "display_name must be at most 40 characters" });
      return;
    }
  }

  let onboardingCompleted: boolean | undefined;
  if (onboardingCompletedRaw !== undefined) {
    if (typeof onboardingCompletedRaw !== "boolean") {
      res
        .status(400)
        .json({ error: "onboarding_completed must be a boolean if provided" });
      return;
    }
    onboardingCompleted = onboardingCompletedRaw;
  }

  const existingRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  if (existingRows.length === 0) {
    res.status(404).json({ error: "Profile not found. Call /api/me/bootstrap first." });
    return;
  }

  const existing = existingRows[0];
  const nextDisplayName =
    displayName !== undefined ? displayName : existing.displayName;
  const nextOnboardingCompleted =
    onboardingCompleted !== undefined
      ? onboardingCompleted
      : existing.onboardingCompleted;

  const updatedRows = await db
    .update(userProfiles)
    .set({
      displayName: nextDisplayName,
      onboardingCompleted: nextOnboardingCompleted,
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId))
    .returning();
  const progress = await ensureUserProgress(userId);
  const tiers = await fetchRankTiers();
  res.json({
    profile: toResponseProfile(updatedRows[0]),
    progress: toResponseProgress(progress),
    next_rank_progress: getNextRankProgress(progress.rankedPoints),
    rank_tiers: tiers,
  });
});

router.get("/me/answer-stats", async (req, res) => {
  const userId = getUserIdOrRespondUnauthorized(req, res);
  if (!userId) {
    return;
  }

  const localDate = readLocalDateKey(req.query.local_date);
  const last7StartDate = addDaysToDateKey(localDate, -6);
  const last30StartDate = addDaysToDateKey(localDate, -29);

  const profileRows = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (profileRows.length === 0) {
    const emptyPeriod = buildAnswerStatsPeriod([]);
    res.json({
      localDate,
      categories: {
        bandGroups: ANSWER_STAT_BAND_GROUP_VALUES,
        questionTypes: ANSWER_STAT_QUESTION_TYPE_VALUES,
      },
      todayData: emptyPeriod,
      last7dayData: emptyPeriod,
      last30dayData: emptyPeriod,
      lifetimeData: emptyPeriod,
    });
    return;
  }

  const [todayRows, last7Rows, last30Rows, lifetimeRows] = await Promise.all([
    fetchAnswerStatsRows({
      userId,
      fromDate: localDate,
      toDate: localDate,
    }),
    fetchAnswerStatsRows({
      userId,
      fromDate: last7StartDate,
      toDate: localDate,
    }),
    fetchAnswerStatsRows({
      userId,
      fromDate: last30StartDate,
      toDate: localDate,
    }),
    fetchAnswerStatsRows({ userId }),
  ]);

  res.json({
    localDate,
    categories: {
      bandGroups: ANSWER_STAT_BAND_GROUP_VALUES,
      questionTypes: ANSWER_STAT_QUESTION_TYPE_VALUES,
    },
    todayData: buildAnswerStatsPeriod(todayRows),
    last7dayData: buildAnswerStatsPeriod(last7Rows),
    last30dayData: buildAnswerStatsPeriod(last30Rows),
    lifetimeData: buildAnswerStatsPeriod(lifetimeRows),
  });
});

router.post("/me/submit-answer", async (req, res) => {
  const userId = getUserIdOrRespondUnauthorized(req, res);
  if (!userId) {
    return;
  }

  const body = req.body as Record<string, unknown> | undefined;
  const passageId =
    typeof body?.passage_id === "string" && body.passage_id.trim().length > 0
      ? body.passage_id.trim()
      : null;
  const sourceQuestionId =
    typeof body?.question_id === "number" && Number.isInteger(body.question_id)
      ? body.question_id
      : null;
  const selectedAnswer =
    typeof body?.selected_answer === "string" ? body.selected_answer : "";
  const localDate = readLocalDateKey(body?.local_date);

  if (!passageId || sourceQuestionId === null) {
    res.status(400).json({
      error: "passage_id and question_id are required.",
    });
    return;
  }

  const profileRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  if (profileRows.length === 0) {
    res.status(404).json({ error: "Profile not found. Call /api/me/bootstrap first." });
    return;
  }

  const questionRows = await db
    .select({
      questionId: questions.id,
      questionTypeIndex: questions.questionTypeIndex,
      questionTypeLabel: questions.questionTypeLabel,
      correctAnswer: answerKeys.answerValue,
      bandLabel: passages.bandLabel,
    })
    .from(questions)
    .innerJoin(passages, eq(questions.passageId, passages.id))
    .innerJoin(answerKeys, eq(answerKeys.questionId, questions.id))
    .where(
      and(
        eq(questions.passageId, passageId),
        eq(questions.sourceQuestionId, sourceQuestionId),
      ),
    )
    .limit(1);

  if (questionRows.length === 0) {
    res.status(404).json({ error: "Question not found." });
    return;
  }

  const progressRow = await ensureUserProgress(userId);
  const row = questionRows[0];
  const bandGroup = normalizeAnswerStatBandGroup(row.bandLabel);
  const questionType = normalizeAnswerStatQuestionType({
    questionTypeIndex: row.questionTypeIndex,
    questionTypeLabel: row.questionTypeLabel,
  });

  const { updatedUserProgress, answerResult } = submitAnswer(
    {
      userId: progressRow.userId,
      lifetimeXp: progressRow.lifetimeXp,
      rankedPoints: progressRow.rankedPoints,
      currentRank: progressRow.currentRank as RankName,
      totalQuestionsAnswered: progressRow.totalQuestionsAnswered,
      totalCorrect: progressRow.totalCorrect,
      totalIncorrect: progressRow.totalIncorrect,
    },
    {
      id: row.questionId,
      band: normalizeBandLevel(row.bandLabel),
      correctAnswer: row.correctAnswer,
    },
    selectedAnswer,
  );

  const correctIncrement = answerResult.isCorrect ? 1 : 0;
  const wrongIncrement = answerResult.isCorrect ? 0 : 1;
  const updatedRows = await db.transaction(async (tx) => {
    const progressRows = await tx
      .update(userProgress)
      .set({
        lifetimeXp: updatedUserProgress.lifetimeXp,
        rankedPoints: updatedUserProgress.rankedPoints,
        currentRank: updatedUserProgress.currentRank,
        totalQuestionsAnswered: updatedUserProgress.totalQuestionsAnswered,
        totalCorrect: updatedUserProgress.totalCorrect,
        totalIncorrect: updatedUserProgress.totalIncorrect,
        updatedAt: new Date(),
      })
      .where(eq(userProgress.userId, userId))
      .returning();

    await tx
      .insert(userDailyAnswerStats)
      .values({
        userId,
        localDate,
        bandGroup,
        questionType,
        attemptCount: 1,
        correctCount: correctIncrement,
        wrongCount: wrongIncrement,
      })
      .onConflictDoUpdate({
        target: [
          userDailyAnswerStats.userId,
          userDailyAnswerStats.localDate,
          userDailyAnswerStats.bandGroup,
          userDailyAnswerStats.questionType,
        ],
        set: {
          attemptCount: sql`${userDailyAnswerStats.attemptCount} + 1`,
          correctCount: sql`${userDailyAnswerStats.correctCount} + ${correctIncrement}`,
          wrongCount: sql`${userDailyAnswerStats.wrongCount} + ${wrongIncrement}`,
          updatedAt: sql`now()`,
        },
      });

    return progressRows;
  });

  const latestProgress = updatedRows[0];
  res.json({
    progress: toResponseProgress(latestProgress),
    next_rank_progress: getNextRankProgress(latestProgress.rankedPoints),
    answer_result: answerResult,
  });
});

export default router;
