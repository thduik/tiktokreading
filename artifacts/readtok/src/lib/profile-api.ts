import {
  DEFAULT_API_CACHE_TTL_MS,
  getOrFetchCachedApiValue,
  invalidateCachedApiPrefix,
  mutateCachedApiValue,
  writeCachedApiValue,
} from "@/lib/api-cache";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
const PROFILE_CACHE_TTL_MS = DEFAULT_API_CACHE_TTL_MS;
const LEADERBOARD_CACHE_TTL_MS = DEFAULT_API_CACHE_TTL_MS;
const PUBLIC_STATS_CACHE_TTL_MS = DEFAULT_API_CACHE_TTL_MS;
const PROFILE_CACHE_SCOPE = "user" as const;
const PUBLIC_CACHE_SCOPE = "public" as const;
const DEFAULT_ANSWER_STAT_BAND_GROUPS = [
  "Band6",
  "Band7",
  "Band75",
  "Band8Plus",
] as const;
const DEFAULT_ANSWER_STAT_QUESTION_TYPES = [
  "MCQ",
  "TFNG",
  "SentenceCompletion",
  "ShortAnswer",
  "Matching",
] as const;

export interface UserProfile {
  user_id: string;
  public_user_id: string;
  email: string;
  display_name: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProgress {
  user_id: string;
  lifetime_xp: number;
  ranked_points: number;
  current_rank: string;
  total_questions_answered: number;
  total_correct: number;
  total_incorrect: number;
  created_at: string;
  updated_at: string;
}

export interface RankTierThreshold {
  key: string;
  label: string;
  min_points: number;
  sort_order: number;
}

export interface UserAchievementItem {
  achievement_key: string;
  achievement_title: string;
  achievement_category: string;
  achievement_tier: string;
  achievement_xp: number;
  unlocked_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserAchievementSummary {
  total_xp: number;
  current_level: number;
  current_level_xp_floor: number;
  next_level_xp_floor: number | null;
  xp_into_level: number;
  xp_needed_for_next_level: number;
  progress_percent: number;
}

export interface UserAchievementsEnvelope {
  items: UserAchievementItem[];
  unlocked_keys: string[];
  summary: UserAchievementSummary;
}

export interface SyncAchievementsRequest {
  unlocks: Array<{
    key: string;
    title: string;
    category: string;
    tier: string;
    xp: number;
  }>;
}

export interface SyncAchievementsResponse extends UserAchievementsEnvelope {
  inserted: string[];
}

export type LeaderboardScope = "global" | "rank";

export interface LeaderboardEntry {
  public_user_id: string;
  display_name: string;
  current_rank: string;
  ranked_points: number;
  lifetime_xp: number;
  total_questions_answered: number;
  total_correct: number;
  total_incorrect: number;
  accuracy_percent: number;
  position: number;
  is_viewer: boolean;
}

export interface LeaderboardEnvelope {
  scope: LeaderboardScope;
  rank: string | null;
  rank_tiers: RankTierThreshold[];
  items: LeaderboardEntry[];
  viewer: LeaderboardEntry | null;
}

export interface PublicLeaderboardUserStatsEnvelope {
  local_date: string;
  localDate: string;
  user: {
    public_user_id: string;
    display_name: string;
  };
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
    today: AnswerStatsPeriod;
    last7: AnswerStatsPeriod;
    last30: AnswerStatsPeriod;
    lifetime: AnswerStatsPeriod;
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
}

interface ProfileEnvelope {
  profile: UserProfile | null;
  progress: UserProgress | null;
  rank_tiers: RankTierThreshold[];
  next_rank_progress: {
    currentRank: string;
    nextRank: string | null;
    pointsIntoCurrentRank: number;
    pointsNeededForNextRank: number;
    progressPercent: number;
  } | null;
}

function buildProfileCacheKey() {
  return "me:profile";
}

function buildAchievementsCacheKey() {
  return "me:achievements";
}

function buildDashboardStatsCacheKey(localDate?: string) {
  return `me:dashboard-stats:${localDate ?? "default"}`;
}

function buildAnswerStatsCacheKey(localDate?: string) {
  return `me:answer-stats:${localDate ?? "default"}`;
}

function buildQuestionTimingSummaryCacheKey(localDate?: string) {
  return `me:question-timing-summary:${localDate ?? "default"}`;
}

function buildVocabBankCacheKey(limit: number) {
  return `me:vocab-bank:${limit}`;
}

function buildLeaderboardCacheKey({
  scope,
  rank,
  limit,
}: {
  scope: LeaderboardScope;
  rank?: string;
  limit: number;
}) {
  return `leaderboard:${scope}:${rank ?? "all"}:${limit}`;
}

function buildLeaderboardUserStatsCacheKey(publicUserId: string, localDate?: string) {
  return `leaderboard:user:${publicUserId}:${localDate ?? "default"}`;
}

function toAccuracy(correct: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((correct / total) * 1000) / 10;
}

function normalizeAnswerStatQuestionType(
  value: string | null | undefined,
): AnswerStatQuestionType | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (
    normalized === "mcq" ||
    normalized === "multiple_choice" ||
    normalized === "multiplechoice"
  ) {
    return "MCQ";
  }
  if (
    normalized === "tfng" ||
    normalized === "true_false_not_given" ||
    normalized === "truefalsenotgiven"
  ) {
    return "TFNG";
  }
  if (
    normalized === "sentence_completion" ||
    normalized === "sentencecompletion"
  ) {
    return "SentenceCompletion";
  }
  if (normalized === "short_answer" || normalized === "shortanswer") {
    return "ShortAnswer";
  }
  if (
    normalized === "matching" ||
    normalized === "matching_heading" ||
    normalized === "matching_information" ||
    normalized === "matchingheading" ||
    normalized === "matchinginformation"
  ) {
    return "Matching";
  }
  return null;
}

function normalizeAnswerStatBandGroup(
  value: string | number | null | undefined,
): AnswerStatBandGroup | null {
  if (typeof value === "number") {
    if (value === 60 || value === 6) return "Band6";
    if (value === 70 || value === 7) return "Band7";
    if (value === 75 || value === 7.5) return "Band75";
    if (value >= 80 || value === 8) return "Band8Plus";
  }

  if (!value) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (normalized === "60" || normalized === "6" || normalized === "band60") {
    return "Band6";
  }
  if (normalized === "70" || normalized === "7" || normalized === "band70") {
    return "Band7";
  }
  if (normalized === "75" || normalized === "75+" || normalized === "band75") {
    return "Band75";
  }
  if (
    normalized === "80" ||
    normalized === "8" ||
    normalized === "80plus" ||
    normalized === "band80" ||
    normalized === "band80plus"
  ) {
    return "Band8Plus";
  }
  return null;
}

function createEmptyAnswerStatCell(): AnswerStatCell {
  return {
    total: 0,
    correct: 0,
    wrong: 0,
    accuracy: 0,
  };
}

function cloneAnswerStatsPeriod(period: AnswerStatsPeriod): AnswerStatsPeriod {
  const byBandAndType: AnswerStatsPeriod["byBandAndType"] = {};
  for (const bandGroup of DEFAULT_ANSWER_STAT_BAND_GROUPS) {
    const bandRow = period.byBandAndType[bandGroup];
    if (!bandRow) {
      continue;
    }
    byBandAndType[bandGroup] = {};
    for (const questionType of DEFAULT_ANSWER_STAT_QUESTION_TYPES) {
      const cell = bandRow[questionType];
      if (cell) {
        byBandAndType[bandGroup]![questionType] = { ...cell };
      }
    }
  }

  return {
    overall: { ...period.overall },
    byBandAndType,
  };
}

function applyAnswerStatsPeriodPatch(
  period: AnswerStatsPeriod,
  {
    isCorrect,
    bandGroup,
    questionType,
  }: {
    isCorrect: boolean;
    bandGroup: AnswerStatBandGroup | null;
    questionType: AnswerStatQuestionType | null;
  },
) {
  const nextPeriod = cloneAnswerStatsPeriod(period);
  nextPeriod.overall.total += 1;
  if (isCorrect) {
    nextPeriod.overall.correct += 1;
  } else {
    nextPeriod.overall.wrong += 1;
  }
  nextPeriod.overall.accuracy = toAccuracy(
    nextPeriod.overall.correct,
    nextPeriod.overall.total,
  );

  if (!bandGroup || !questionType) {
    return nextPeriod;
  }

  const nextBandRow = {
    ...(nextPeriod.byBandAndType[bandGroup] ?? {}),
  };
  const nextCell = {
    ...(nextBandRow[questionType] ?? createEmptyAnswerStatCell()),
  };
  nextCell.total += 1;
  if (isCorrect) {
    nextCell.correct += 1;
  } else {
    nextCell.wrong += 1;
  }
  nextCell.accuracy = toAccuracy(nextCell.correct, nextCell.total);
  nextBandRow[questionType] = nextCell;
  nextPeriod.byBandAndType[bandGroup] = nextBandRow;
  return nextPeriod;
}

function applyAnswerStatsEnvelopePatch(
  envelope: AnswerStatsEnvelope,
  {
    localDate,
    isCorrect,
    bandGroup,
    questionType,
  }: {
    localDate: string;
    isCorrect: boolean;
    bandGroup: AnswerStatBandGroup | null;
    questionType: AnswerStatQuestionType | null;
  },
) {
  if (envelope.localDate !== localDate) {
    return envelope;
  }

  return {
    ...envelope,
    todayData: applyAnswerStatsPeriodPatch(envelope.todayData, {
      isCorrect,
      bandGroup,
      questionType,
    }),
    last7dayData: applyAnswerStatsPeriodPatch(envelope.last7dayData, {
      isCorrect,
      bandGroup,
      questionType,
    }),
    last30dayData: applyAnswerStatsPeriodPatch(envelope.last30dayData, {
      isCorrect,
      bandGroup,
      questionType,
    }),
    lifetimeData: applyAnswerStatsPeriodPatch(envelope.lifetimeData, {
      isCorrect,
      bandGroup,
      questionType,
    }),
  };
}

function applyDashboardStatsPatch(
  envelope: DashboardStatsEnvelope,
  {
    localDate,
    isCorrect,
    bandGroup,
    questionType,
    progress,
  }: {
    localDate: string;
    isCorrect: boolean;
    bandGroup: AnswerStatBandGroup | null;
    questionType: AnswerStatQuestionType | null;
    progress: UserProgress;
  },
) {
  const patchedPeriods = applyAnswerStatsEnvelopePatch(envelope, {
    localDate,
    isCorrect,
    bandGroup,
    questionType,
  });

  const nextTodayAttempted = envelope.daily_goal.attempted_today + 1;
  const nextTodayCorrect = envelope.headline.today_correct + (isCorrect ? 1 : 0);
  const nextLast7Attempted = envelope.headline.last7_attempted + 1;
  const nextLast7Correct = envelope.headline.last7_correct + (isCorrect ? 1 : 0);

  return {
    ...patchedPeriods,
    local_date: envelope.local_date,
    progress,
    current_streak_days: Math.max(1, envelope.current_streak_days),
    daily_goal: {
      ...envelope.daily_goal,
      attempted_today: nextTodayAttempted,
      remaining: Math.max(0, envelope.daily_goal.goal - nextTodayAttempted),
      progress_percent: Math.max(
        0,
        Math.min(100, Math.round((nextTodayAttempted / envelope.daily_goal.goal) * 100)),
      ),
      is_complete: nextTodayAttempted >= envelope.daily_goal.goal,
    },
    headline: {
      total_questions_completed: progress.total_questions_answered,
      total_correct: progress.total_correct,
      total_incorrect: progress.total_incorrect,
      lifetime_accuracy: toAccuracy(
        progress.total_correct,
        progress.total_questions_answered,
      ),
      last7_accuracy: toAccuracy(nextLast7Correct, nextLast7Attempted),
      today_accuracy: toAccuracy(nextTodayCorrect, nextTodayAttempted),
      last7_correct: nextLast7Correct,
      last7_attempted: nextLast7Attempted,
      today_correct: nextTodayCorrect,
      today_attempted: nextTodayAttempted,
    },
  };
}

export type SubmitAnswerCachePatchContext = {
  localDate: string;
  isCorrect: boolean;
  band?: string | number | null;
  questionType?: string | null;
  response: SubmitRankedAnswerResponse;
};

async function parseError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // no-op
  }
  return `Request failed (${response.status})`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

export async function fetchMyProfile() {
  return getOrFetchCachedApiValue({
    key: buildProfileCacheKey(),
    scope: PROFILE_CACHE_SCOPE,
    ttlMs: PROFILE_CACHE_TTL_MS,
    fetcher: () => requestJson<ProfileEnvelope>(`${API_BASE}/me`),
  });
}

export async function bootstrapMyProfile({
  email,
  displayName,
}: {
  email?: string;
  displayName?: string | null;
}) {
  const response = await requestJson<ProfileEnvelope>(`${API_BASE}/me/bootstrap`, {
    method: "POST",
    body: JSON.stringify({
      email,
      display_name: displayName,
    }),
  });
  writeCachedApiValue(
    buildProfileCacheKey(),
    response,
    PROFILE_CACHE_TTL_MS,
    PROFILE_CACHE_SCOPE,
  );
  return response;
}

export async function updateMyProfile({
  displayName,
  onboardingCompleted,
}: {
  displayName?: string | null;
  onboardingCompleted?: boolean;
}) {
  const response = await requestJson<ProfileEnvelope>(`${API_BASE}/me`, {
    method: "PATCH",
    body: JSON.stringify({
      display_name: displayName,
      onboarding_completed: onboardingCompleted,
    }),
  });
  writeCachedApiValue(
    buildProfileCacheKey(),
    response,
    PROFILE_CACHE_TTL_MS,
    PROFILE_CACHE_SCOPE,
  );
  return response;
}

export interface SubmitRankedAnswerRequest {
  passageId: string;
  questionId: number;
  selectedAnswer: string;
  localDate?: string;
  elapsedSeconds?: number;
  displayPosition?: number;
}

export interface SubmitRankedAnswerResponse {
  progress: UserProgress;
  next_rank_progress: {
    currentRank: string;
    nextRank: string | null;
    pointsIntoCurrentRank: number;
    pointsNeededForNextRank: number;
    progressPercent: number;
  };
  answer_result: {
    isCorrect: boolean;
    selectedAnswer: string;
    correctAnswer: string;
    rankedPointsBefore: number;
    rankedPointsAfter: number;
    rankedPointDelta: number;
    lifetimeXpBefore: number;
    lifetimeXpAfter: number;
    xpDelta: number;
    rankBefore: string;
    rankAfter: string;
    rankedUp: boolean;
    rankedDown: boolean;
  };
  question_timing: {
    elapsed_seconds: number;
    display_position: number;
    source_question_id: number;
    order_index: number;
  } | null;
}

export async function submitRankedAnswer(request: SubmitRankedAnswerRequest) {
  return requestJson<SubmitRankedAnswerResponse>(`${API_BASE}/me/submit-answer`, {
    method: "POST",
    body: JSON.stringify({
      passage_id: request.passageId,
      question_id: request.questionId,
      selected_answer: request.selectedAnswer,
      local_date: request.localDate,
      elapsed_seconds: request.elapsedSeconds,
      display_position: request.displayPosition,
    }),
  });
}

export function applySubmitAnswerCachePatch({
  localDate,
  isCorrect,
  band,
  questionType,
  response,
}: SubmitAnswerCachePatchContext) {
  const normalizedBandGroup = normalizeAnswerStatBandGroup(band);
  const normalizedQuestionType = normalizeAnswerStatQuestionType(questionType);

  mutateCachedApiValue<ProfileEnvelope>(
    buildProfileCacheKey(),
    (current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        progress: response.progress,
      };
    },
    { scope: PROFILE_CACHE_SCOPE, ttlMs: PROFILE_CACHE_TTL_MS },
  );

  mutateCachedApiValue<DashboardStatsEnvelope>(
    buildDashboardStatsCacheKey(localDate),
    (current) => {
      if (!current) {
        return current;
      }
      return applyDashboardStatsPatch(current, {
        localDate,
        isCorrect,
        bandGroup: normalizedBandGroup,
        questionType: normalizedQuestionType,
        progress: response.progress,
      });
    },
    { scope: PROFILE_CACHE_SCOPE, ttlMs: PROFILE_CACHE_TTL_MS },
  );

  mutateCachedApiValue<AnswerStatsEnvelope>(
    buildAnswerStatsCacheKey(localDate),
    (current) => {
      if (!current) {
        return current;
      }
      return applyAnswerStatsEnvelopePatch(current, {
        localDate,
        isCorrect,
        bandGroup: normalizedBandGroup,
        questionType: normalizedQuestionType,
      });
    },
    { scope: PROFILE_CACHE_SCOPE, ttlMs: PROFILE_CACHE_TTL_MS },
  );

  invalidateCachedApiPrefix("me:question-timing-summary:", PROFILE_CACHE_SCOPE);
}

export interface SaveVocabBankRequest {
  term: string;
  meaningEn?: string | null;
  meaningVi?: string | null;
  exampleSentenceEn?: string | null;
  sentenceIndex?: number | null;
  sourcePassageId?: string | null;
  sourcePassageTitle?: string | null;
  sourceBandLabel?: string | null;
}

export interface QuestionTimingSummaryBucket {
  first_four: Array<{
    display_position: number;
    attempts: number;
    correct: number;
    wrong: number;
    average_elapsed_seconds: number;
    fastest_elapsed_seconds: number;
    slowest_elapsed_seconds: number;
  }>;
  positions: Record<
    string,
    {
      attempts: number;
      correct: number;
      wrong: number;
      average_elapsed_seconds: number;
      fastest_elapsed_seconds: number;
      slowest_elapsed_seconds: number;
    }
  >;
}

export interface QuestionTimingSummaryResponse {
  localDate: string;
  today: QuestionTimingSummaryBucket;
  last7day: QuestionTimingSummaryBucket;
  last30day: QuestionTimingSummaryBucket;
  lifetime: QuestionTimingSummaryBucket;
}

export async function fetchQuestionTimingSummary(localDate?: string) {
  const searchParams = new URLSearchParams();
  if (localDate) {
    searchParams.set("local_date", localDate);
  }
  const query = searchParams.toString();
  return getOrFetchCachedApiValue({
    key: buildQuestionTimingSummaryCacheKey(localDate),
    scope: PROFILE_CACHE_SCOPE,
    ttlMs: PROFILE_CACHE_TTL_MS,
    fetcher: () =>
      requestJson<QuestionTimingSummaryResponse>(
        `${API_BASE}/me/question-timing-summary${query ? `?${query}` : ""}`,
      ),
  });
}

export interface SaveVocabBankResponse {
  ok: boolean;
  already_exists: boolean;
  item: {
    term: string;
    normalized_term: string;
    meaning_en: string | null;
    meaning_vi: string | null;
    example_sentence_en: string | null;
    sentence_index: number | null;
    source_passage_id: string | null;
    source_passage_title: string | null;
    source_band_label: string | null;
    created_at: string;
    updated_at: string;
  };
}

export async function saveVocabToBank(request: SaveVocabBankRequest) {
  const response = await requestJson<SaveVocabBankResponse>(`${API_BASE}/me/vocab-bank`, {
    method: "POST",
    body: JSON.stringify({
      term: request.term,
      meaning_en: request.meaningEn,
      meaning_vi: request.meaningVi,
      example_sentence_en: request.exampleSentenceEn,
      sentence_index: request.sentenceIndex,
      source_passage_id: request.sourcePassageId,
      source_passage_title: request.sourcePassageTitle,
      source_band_label: request.sourceBandLabel,
    }),
  });
  invalidateCachedApiPrefix("me:vocab-bank:", PROFILE_CACHE_SCOPE);
  return response;
}

export interface VocabBankItem {
  term: string;
  normalized_term: string;
  meaning_en: string | null;
  meaning_vi: string | null;
  example_sentence_en: string | null;
  sentence_index: number | null;
  source_passage_id: string | null;
  source_passage_title: string | null;
  source_band_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface VocabBankEnvelope {
  items: VocabBankItem[];
}

export async function fetchMyVocabBank(limit = 200) {
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  return getOrFetchCachedApiValue({
    key: buildVocabBankCacheKey(safeLimit),
    scope: PROFILE_CACHE_SCOPE,
    ttlMs: PROFILE_CACHE_TTL_MS,
    fetcher: () =>
      requestJson<VocabBankEnvelope>(`${API_BASE}/me/vocab-bank?limit=${safeLimit}`),
  });
}

export type AnswerStatBandGroup = "Band6" | "Band7" | "Band75" | "Band8Plus";
export type AnswerStatQuestionType =
  | "MCQ"
  | "TFNG"
  | "SentenceCompletion"
  | "ShortAnswer"
  | "Matching";

export interface AnswerStatCell {
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
}

export interface AnswerStatsPeriod {
  overall: AnswerStatCell;
  byBandAndType: Partial<
    Record<AnswerStatBandGroup, Partial<Record<AnswerStatQuestionType, AnswerStatCell>>>
  >;
}

export interface AnswerStatsEnvelope {
  localDate: string;
  categories: {
    bandGroups: AnswerStatBandGroup[];
    questionTypes: AnswerStatQuestionType[];
  };
  todayData: AnswerStatsPeriod;
  last7dayData: AnswerStatsPeriod;
  last30dayData: AnswerStatsPeriod;
  lifetimeData: AnswerStatsPeriod;
}

export interface DashboardStatsEnvelope extends AnswerStatsEnvelope {
  local_date: string;
  progress: UserProgress;
  current_streak_days: number;
  daily_goal: {
    goal: number;
    attempted_today: number;
    remaining: number;
    progress_percent: number;
    is_complete: boolean;
  };
  headline: {
    total_questions_completed: number;
    total_correct: number;
    total_incorrect: number;
    lifetime_accuracy: number;
    last7_accuracy: number;
    today_accuracy: number;
    last7_correct: number;
    last7_attempted: number;
    today_correct: number;
    today_attempted: number;
  };
}

export async function fetchMyAnswerStats(localDate?: string) {
  const searchParams = new URLSearchParams();
  if (localDate) {
    searchParams.set("local_date", localDate);
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return getOrFetchCachedApiValue({
    key: buildAnswerStatsCacheKey(localDate),
    scope: PROFILE_CACHE_SCOPE,
    ttlMs: PROFILE_CACHE_TTL_MS,
    fetcher: () => requestJson<AnswerStatsEnvelope>(`${API_BASE}/me/answer-stats${suffix}`),
  });
}

export async function fetchMyDashboardStats(localDate?: string) {
  const searchParams = new URLSearchParams();
  if (localDate) {
    searchParams.set("local_date", localDate);
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return getOrFetchCachedApiValue({
    key: buildDashboardStatsCacheKey(localDate),
    scope: PROFILE_CACHE_SCOPE,
    ttlMs: PROFILE_CACHE_TTL_MS,
    fetcher: () =>
      requestJson<DashboardStatsEnvelope>(
        `${API_BASE}/me/dashboard-stats${suffix}`,
      ),
  });
}

export async function fetchLeaderboard({
  scope = "global",
  rank,
  limit = 50,
}: {
  scope?: LeaderboardScope;
  rank?: string;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("scope", scope);
  searchParams.set("limit", String(limit));
  if (rank) {
    searchParams.set("rank", rank);
  }

  return getOrFetchCachedApiValue({
    key: buildLeaderboardCacheKey({ scope, rank, limit }),
    scope: PUBLIC_CACHE_SCOPE,
    ttlMs: LEADERBOARD_CACHE_TTL_MS,
    fetcher: () =>
      requestJson<LeaderboardEnvelope>(
        `${API_BASE}/leaderboard?${searchParams.toString()}`,
      ),
  });
}

export async function fetchLeaderboardUserStats(publicUserId: string, localDate?: string) {
  const searchParams = new URLSearchParams();
  if (localDate) {
    searchParams.set("local_date", localDate);
  }
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";

  return getOrFetchCachedApiValue({
    key: buildLeaderboardUserStatsCacheKey(publicUserId, localDate),
    scope: PUBLIC_CACHE_SCOPE,
    ttlMs: PUBLIC_STATS_CACHE_TTL_MS,
    fetcher: () =>
      requestJson<PublicLeaderboardUserStatsEnvelope>(
        `${API_BASE}/leaderboard/users/${encodeURIComponent(publicUserId)}/stats${suffix}`,
      ),
  });
}

export async function fetchMyAchievements() {
  return getOrFetchCachedApiValue({
    key: buildAchievementsCacheKey(),
    scope: PROFILE_CACHE_SCOPE,
    ttlMs: PROFILE_CACHE_TTL_MS,
    fetcher: () => requestJson<UserAchievementsEnvelope>(`${API_BASE}/me/achievements`),
  });
}

export async function syncMyAchievements(request: SyncAchievementsRequest) {
  const response = await requestJson<SyncAchievementsResponse>(`${API_BASE}/me/achievements/unlock-batch`, {
    method: "POST",
    body: JSON.stringify({
      unlocks: request.unlocks,
    }),
  });
  writeCachedApiValue(
    buildAchievementsCacheKey(),
    response,
    PROFILE_CACHE_TTL_MS,
    PROFILE_CACHE_SCOPE,
  );
  return response;
}
