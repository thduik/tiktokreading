const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export interface UserProfile {
  user_id: string;
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

export type LeaderboardScope = "global" | "rank";

export interface LeaderboardEntry {
  user_id: string;
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
  return requestJson<ProfileEnvelope>(`${API_BASE}/me`);
}

export async function bootstrapMyProfile({
  email,
  displayName,
}: {
  email?: string;
  displayName?: string | null;
}) {
  return requestJson<ProfileEnvelope>(`${API_BASE}/me/bootstrap`, {
    method: "POST",
    body: JSON.stringify({
      email,
      display_name: displayName,
    }),
  });
}

export async function updateMyProfile({
  displayName,
  onboardingCompleted,
}: {
  displayName?: string | null;
  onboardingCompleted?: boolean;
}) {
  return requestJson<ProfileEnvelope>(`${API_BASE}/me`, {
    method: "PATCH",
    body: JSON.stringify({
      display_name: displayName,
      onboarding_completed: onboardingCompleted,
    }),
  });
}

export interface SubmitRankedAnswerRequest {
  passageId: string;
  questionId: number;
  selectedAnswer: string;
  localDate?: string;
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
}

export async function submitRankedAnswer(request: SubmitRankedAnswerRequest) {
  return requestJson<SubmitRankedAnswerResponse>(`${API_BASE}/me/submit-answer`, {
    method: "POST",
    body: JSON.stringify({
      passage_id: request.passageId,
      question_id: request.questionId,
      selected_answer: request.selectedAnswer,
      local_date: request.localDate,
    }),
  });
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
  return requestJson<SaveVocabBankResponse>(`${API_BASE}/me/vocab-bank`, {
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
  return requestJson<VocabBankEnvelope>(`${API_BASE}/me/vocab-bank?limit=${safeLimit}`);
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
  return requestJson<AnswerStatsEnvelope>(`${API_BASE}/me/answer-stats${suffix}`);
}

export async function fetchMyDashboardStats(localDate?: string) {
  const searchParams = new URLSearchParams();
  if (localDate) {
    searchParams.set("local_date", localDate);
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return requestJson<DashboardStatsEnvelope>(
    `${API_BASE}/me/dashboard-stats${suffix}`,
  );
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

  return requestJson<LeaderboardEnvelope>(`${API_BASE}/leaderboard?${searchParams.toString()}`);
}
