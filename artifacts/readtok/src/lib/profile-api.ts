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

export async function fetchMyAnswerStats(localDate?: string) {
  const searchParams = new URLSearchParams();
  if (localDate) {
    searchParams.set("local_date", localDate);
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return requestJson<AnswerStatsEnvelope>(`${API_BASE}/me/answer-stats${suffix}`);
}
