import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  answerKeys,
  db,
  passages,
  questions,
  userDailyAnswerStats,
  userVocabBank,
  userProfiles,
  userProgress,
} from "@workspace/db";
import {
  getNextRankProgress,
  normalizeBandLevel,
  submitAnswer,
  type RankName,
} from "@workspace/db/ranking";
import {
  ANSWER_STAT_BAND_GROUP_VALUES,
  ANSWER_STAT_QUESTION_TYPE_VALUES,
  addDaysToDateKey,
  buildAnswerStatsPeriod,
  normalizeAnswerStatBandGroup,
  normalizeAnswerStatQuestionType,
  readLocalDateKey,
  type AnswerStatsRow,
} from "../lib/answer-stats";
import { fetchRankTiers } from "../lib/rank-tiers";

const router: IRouter = Router();
const PROFILE_DAILY_QUESTION_GOAL = 20;
type AuthWithUserId = NonNullable<ReturnType<typeof getAuth>> & { userId: string };

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

function toPercent(correct: number, attempted: number) {
  if (attempted <= 0) {
    return 0;
  }
  return Math.round((correct / attempted) * 100);
}

function normalizeVocabBankTerm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
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

async function fetchCurrentPracticeStreakDays({
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

function getAuthOrRespondUnauthorized(req: Request, res: Response): AuthWithUserId | null {
  const auth = getSafeAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return auth as AuthWithUserId;
}

function getSafeAuth(req: Request) {
  try {
    return getAuth(req);
  } catch {
    return null;
  }
}

async function ensureUserProfileForAuth({
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
    .insert(userProfiles)
    .values({
      userId: auth.userId,
      email: normalizedEmail,
      displayName: displayName ?? null,
      onboardingCompleted: Boolean(displayName),
    })
    .returning();

  return insertedRows[0];
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
  const { tiers } = await fetchRankTiers();
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
    const { tiers } = await fetchRankTiers();
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
  const { tiers } = await fetchRankTiers();
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
  const { tiers } = await fetchRankTiers();
  res.json({
    profile: toResponseProfile(updatedRows[0]),
    progress: toResponseProgress(progress),
    next_rank_progress: getNextRankProgress(progress.rankedPoints),
    rank_tiers: tiers,
  });
});

router.get("/me/dashboard-stats", async (req, res) => {
  const auth = getAuthOrRespondUnauthorized(req, res);
  if (!auth) {
    return;
  }

  const userId = auth.userId;
  const localDate = readLocalDateKey(req.query.local_date);
  const last7StartDate = addDaysToDateKey(localDate, -6);
  const last30StartDate = addDaysToDateKey(localDate, -29);

  await ensureUserProfileForAuth({ auth });

  const [progress, todayRows, last7Rows, last30Rows, lifetimeRows, currentStreakDays] =
    await Promise.all([
      ensureUserProgress(userId),
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
      fetchCurrentPracticeStreakDays({ userId, localDate }),
    ]);

  const todayData = buildAnswerStatsPeriod(todayRows);
  const last7dayData = buildAnswerStatsPeriod(last7Rows);
  const last30dayData = buildAnswerStatsPeriod(last30Rows);
  const lifetimeData = buildAnswerStatsPeriod(lifetimeRows);
  const dailyGoal = {
    goal: PROFILE_DAILY_QUESTION_GOAL,
    attempted_today: todayData.overall.total,
    remaining: Math.max(0, PROFILE_DAILY_QUESTION_GOAL - todayData.overall.total),
    progress_percent: Math.min(
      100,
      Math.round((todayData.overall.total / PROFILE_DAILY_QUESTION_GOAL) * 100),
    ),
    is_complete: todayData.overall.total >= PROFILE_DAILY_QUESTION_GOAL,
  };

  res.json({
    local_date: localDate,
    localDate,
    progress: toResponseProgress(progress),
    current_streak_days: currentStreakDays,
    daily_goal: dailyGoal,
    headline: {
      total_questions_completed: progress.totalQuestionsAnswered,
      total_correct: progress.totalCorrect,
      total_incorrect: progress.totalIncorrect,
      lifetime_accuracy: toPercent(
        progress.totalCorrect,
        progress.totalQuestionsAnswered,
      ),
      last7_accuracy: last7dayData.overall.accuracy,
      today_accuracy: todayData.overall.accuracy,
      last7_correct: last7dayData.overall.correct,
      last7_attempted: last7dayData.overall.total,
      today_correct: todayData.overall.correct,
      today_attempted: todayData.overall.total,
    },
    categories: {
      bandGroups: ANSWER_STAT_BAND_GROUP_VALUES,
      questionTypes: ANSWER_STAT_QUESTION_TYPE_VALUES,
    },
    todayData,
    last7dayData,
    last30dayData,
    lifetimeData,
  });
});

router.get("/me/answer-stats", async (req, res) => {
  const auth = getAuthOrRespondUnauthorized(req, res);
  if (!auth) {
    return;
  }

  const userId = auth.userId;
  const localDate = readLocalDateKey(req.query.local_date);
  const last7StartDate = addDaysToDateKey(localDate, -6);
  const last30StartDate = addDaysToDateKey(localDate, -29);

  await ensureUserProfileForAuth({ auth });

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
  const auth = getAuthOrRespondUnauthorized(req, res);
  if (!auth) {
    return;
  }

  const userId = auth.userId;
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

  await ensureUserProfileForAuth({ auth });

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

router.post("/me/vocab-bank", async (req, res) => {
  const auth = getAuthOrRespondUnauthorized(req, res);
  if (!auth) {
    return;
  }

  const body = req.body as Record<string, unknown> | undefined;
  const term =
    typeof body?.term === "string" && body.term.trim().length > 0
      ? body.term.trim()
      : null;
  const meaningEn =
    typeof body?.meaning_en === "string" && body.meaning_en.trim().length > 0
      ? body.meaning_en.trim()
      : null;
  const meaningVi =
    typeof body?.meaning_vi === "string" && body.meaning_vi.trim().length > 0
      ? body.meaning_vi.trim()
      : null;
  const exampleSentenceEn =
    typeof body?.example_sentence_en === "string" &&
    body.example_sentence_en.trim().length > 0
      ? body.example_sentence_en.trim()
      : null;
  const sentenceIndex =
    typeof body?.sentence_index === "number" &&
    Number.isInteger(body.sentence_index) &&
    body.sentence_index >= 1
      ? body.sentence_index
      : null;
  const sourcePassageId =
    typeof body?.source_passage_id === "string" &&
    body.source_passage_id.trim().length > 0
      ? body.source_passage_id.trim()
      : null;
  const sourcePassageTitle =
    typeof body?.source_passage_title === "string" &&
    body.source_passage_title.trim().length > 0
      ? body.source_passage_title.trim()
      : null;
  const sourceBandLabel =
    typeof body?.source_band_label === "string" &&
    body.source_band_label.trim().length > 0
      ? body.source_band_label.trim()
      : null;

  if (!term) {
    res.status(400).json({ error: "term is required." });
    return;
  }
  if (term.length > 160) {
    res.status(400).json({ error: "term must be at most 160 characters." });
    return;
  }
  if (meaningEn && meaningEn.length > 600) {
    res.status(400).json({ error: "meaning_en must be at most 600 characters." });
    return;
  }
  if (meaningVi && meaningVi.length > 600) {
    res.status(400).json({ error: "meaning_vi must be at most 600 characters." });
    return;
  }
  if (exampleSentenceEn && exampleSentenceEn.length > 1000) {
    res
      .status(400)
      .json({ error: "example_sentence_en must be at most 1000 characters." });
    return;
  }

  const normalizedTerm = normalizeVocabBankTerm(term);
  if (normalizedTerm.length === 0) {
    res.status(400).json({ error: "term is invalid." });
    return;
  }

  await ensureUserProfileForAuth({ auth });

  const now = new Date();
  const existingRows = await db
    .select()
    .from(userVocabBank)
    .where(
      and(
        eq(userVocabBank.userId, auth.userId),
        eq(userVocabBank.normalizedTerm, normalizedTerm),
      ),
    )
    .limit(1);

  const wasExisting = existingRows.length > 0;
  const baseValues = {
    userId: auth.userId,
    normalizedTerm,
    term,
    meaningEn,
    meaningVi,
    exampleSentenceEn,
    sentenceIndex,
    sourcePassageId,
    sourcePassageTitle,
    sourceBandLabel,
  };

  const savedRows = wasExisting
    ? await db
        .update(userVocabBank)
        .set({
          ...baseValues,
          updatedAt: now,
        })
        .where(
          and(
            eq(userVocabBank.userId, auth.userId),
            eq(userVocabBank.normalizedTerm, normalizedTerm),
          ),
        )
        .returning()
    : await db
        .insert(userVocabBank)
        .values({
          ...baseValues,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

  const saved = savedRows[0];
  res.json({
    ok: true,
    already_exists: wasExisting,
    item: {
      term: saved.term,
      normalized_term: saved.normalizedTerm,
      meaning_en: saved.meaningEn,
      meaning_vi: saved.meaningVi,
      example_sentence_en: saved.exampleSentenceEn,
      sentence_index: saved.sentenceIndex,
      source_passage_id: saved.sourcePassageId,
      source_passage_title: saved.sourcePassageTitle,
      source_band_label: saved.sourceBandLabel,
      created_at: saved.createdAt.toISOString(),
      updated_at: saved.updatedAt.toISOString(),
    },
  });
});

export default router;
