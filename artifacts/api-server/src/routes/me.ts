import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, asc, eq } from "drizzle-orm";
import {
  answerKeys,
  db,
  passages,
  questions,
  rankTiers,
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

  const updatedRows = await db
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

  const latestProgress = updatedRows[0];
  res.json({
    progress: toResponseProgress(latestProgress),
    next_rank_progress: getNextRankProgress(latestProgress.rankedPoints),
    answer_result: answerResult,
  });
});

export default router;
