import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  applyAnswerAchievementProgress,
  applyRankedAchievementProgress,
  applyReportAchievementProgress,
  applySavedPassageAchievementProgress,
  sanitizeAchievementProgress,
  unlockAchievementsForTriggers,
  type AchievementDefinition,
  type AnswerAchievementContext,
  type RankedAchievementContext,
  type UserAchievementProgress,
} from "@/lib/achievements";
import { DAILY_QUESTION_GOAL } from "@/lib/daily-goal";
import type { RankTierThreshold, UserProgress } from "@/lib/profile-api";
import {
  buildRankedIdentitySnapshot,
  sanitizeRankedIdentitySnapshot,
  type RankedIdentitySnapshot,
} from "@/lib/rank-visual";
import {
  defaultFeedbackPreferences,
  sanitizeFeedbackPreferences,
  type FeedbackPreferences,
} from "@/lib/feedback-effects";

export interface UserStats {
  totalQuestionsCompleted: number;
  streak: number;
  lastPracticedDay: string | null;
  totalCorrect: number;
  totalIncorrect: number;
  dailyStats: Record<
    string,
    {
      attempted: number;
      correct: number;
    }
  >;
  achievementProgress: UserAchievementProgress;
}

export interface SessionSummarySnapshot {
  answered: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number;
  lpDeltaTotal: number;
  xpDeltaTotal: number;
}

interface SessionSummaryProgress {
  answered: number;
  correct: number;
  lpDeltaTotal: number;
  xpDeltaTotal: number;
}

interface AppStateValue {
  isLoaded: boolean;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
  savedCardIds: string[];
  isCardSaved: (cardId: string) => boolean;
  toggleSaveCard: (cardId: string) => void;
  stats: UserStats;
  rankedIdentity: RankedIdentitySnapshot | null;
  feedbackPreferences: FeedbackPreferences;
  pendingSessionSummary: SessionSummarySnapshot | null;
  recentAchievementUnlocks: AchievementDefinition[];
  dismissRecentAchievementUnlocks: () => void;
  dismissSessionSummary: () => void;
  recordQuestionAttempt: (
    isCorrect: boolean,
    context?: Omit<AnswerAchievementContext, "dailyGoalTarget">,
  ) => void;
  recordSessionAnswerResult: (result: {
    isCorrect: boolean;
    xpDelta: number;
    lpDelta: number;
  }) => void;
  recordRankedResult: (context: RankedAchievementContext) => void;
  recordPassageReport: () => void;
  syncRankedIdentity: (
    progress: UserProgress | null | undefined,
    rankTiers?: RankTierThreshold[] | null,
  ) => void;
  updateStats: (correctAnswers: number, totalQuestions: number) => void;
  updateFeedbackPreferences: (nextPreferences: Partial<FeedbackPreferences>) => void;
}

const STORAGE_KEYS = {
  onboarding: "readtok_onboarding",
  saved: "readtok_saved",
  stats: "readtok_stats",
  rankedIdentity: "readtok_ranked_identity",
  feedbackPreferences: "readtok_feedback_preferences",
} as const;

const defaultStats: UserStats = {
  totalQuestionsCompleted: 0,
  streak: 0,
  lastPracticedDay: null,
  totalCorrect: 0,
  totalIncorrect: 0,
  dailyStats: {},
  achievementProgress: sanitizeAchievementProgress(null),
};

const defaultSessionSummaryProgress: SessionSummaryProgress = {
  answered: 0,
  correct: 0,
  lpDeltaTotal: 0,
  xpDeltaTotal: 0,
};

const AppStateContext = createContext<AppStateValue | null>(null);

function formatDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseStoredDayKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return formatDayKey(parsedDate);
}

function getDayDifference(previousDayKey: string, currentDayKey: string) {
  const previousDate = new Date(`${previousDayKey}T00:00:00`);
  const currentDate = new Date(`${currentDayKey}T00:00:00`);
  const differenceMs = currentDate.getTime() - previousDate.getTime();
  return Math.round(differenceMs / 86_400_000);
}

function sanitizeStats(value: unknown): UserStats {
  if (!value || typeof value !== "object") {
    return {
      ...defaultStats,
      dailyStats: {},
      achievementProgress: sanitizeAchievementProgress(null),
    };
  }

  const stats = value as Partial<UserStats> & {
    totalPracticed?: number;
    accuracy?: number;
    lastPracticed?: string | null;
    correctAnswersTotal?: number;
    totalQuestionsAnswered?: number;
  };

  const totalQuestionsCompleted =
    typeof stats.totalQuestionsCompleted === "number"
      ? stats.totalQuestionsCompleted
      : typeof stats.totalQuestionsAnswered === "number"
        ? stats.totalQuestionsAnswered
        : 0;
  const totalCorrect =
    typeof stats.totalCorrect === "number"
      ? stats.totalCorrect
      : typeof stats.correctAnswersTotal === "number"
        ? stats.correctAnswersTotal
        : 0;
  const totalIncorrect =
    typeof stats.totalIncorrect === "number"
      ? stats.totalIncorrect
      : Math.max(0, totalQuestionsCompleted - totalCorrect);

  const parsedDailyStats: UserStats["dailyStats"] = {};
  if (stats.dailyStats && typeof stats.dailyStats === "object") {
    for (const [dayKey, rawValue] of Object.entries(stats.dailyStats)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
        continue;
      }
      if (!rawValue || typeof rawValue !== "object") {
        continue;
      }
      const attempted = Number((rawValue as { attempted?: unknown }).attempted);
      const correct = Number((rawValue as { correct?: unknown }).correct);
      if (!Number.isFinite(attempted) || !Number.isFinite(correct)) {
        continue;
      }
      parsedDailyStats[dayKey] = {
        attempted: Math.max(0, Math.trunc(attempted)),
        correct: Math.max(0, Math.trunc(correct)),
      };
    }
  }

  return {
    totalQuestionsCompleted: Math.max(0, Math.trunc(totalQuestionsCompleted)),
    streak: typeof stats.streak === "number" ? stats.streak : 0,
    lastPracticedDay: parseStoredDayKey(
      stats.lastPracticedDay ?? stats.lastPracticed,
    ),
    totalCorrect: Math.max(0, Math.trunc(totalCorrect)),
    totalIncorrect: Math.max(0, Math.trunc(totalIncorrect)),
    dailyStats: parsedDailyStats,
    achievementProgress: sanitizeAchievementProgress(stats.achievementProgress, {
      totalQuestionsAnswered: Math.max(0, Math.trunc(totalQuestionsCompleted)),
      totalCorrectAnswers: Math.max(0, Math.trunc(totalCorrect)),
      totalWrongAnswers: Math.max(0, Math.trunc(totalIncorrect)),
      currentPracticeStreakDays:
        typeof stats.streak === "number" ? Math.max(0, Math.trunc(stats.streak)) : 0,
      lastPracticeDateLocal: parseStoredDayKey(
        stats.lastPracticedDay ?? stats.lastPracticed,
      ),
    }),
  };
}

function readSavedCardIds() {
  const rawSaved = localStorage.getItem(STORAGE_KEYS.saved);
  if (!rawSaved) {
    return [];
  }

  const parsedSaved = JSON.parse(rawSaved);
  if (!Array.isArray(parsedSaved)) {
    return [];
  }

  return parsedSaved.filter((value): value is string => typeof value === "string");
}

function readHydratedState() {
  const hasCompletedOnboarding =
    localStorage.getItem(STORAGE_KEYS.onboarding) === "true";

  const savedCardIds = readSavedCardIds();
  const storedStats = sanitizeStats(
    JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) ?? "null"),
  );
  storedStats.achievementProgress.savedPassageCount = Math.max(
    storedStats.achievementProgress.savedPassageCount,
    savedCardIds.length,
  );
  const today = formatDayKey(new Date());

  if (
    storedStats.lastPracticedDay &&
    getDayDifference(storedStats.lastPracticedDay, today) > 1
  ) {
    storedStats.streak = 0;
  }

  return {
    hasCompletedOnboarding,
    savedCardIds,
    stats: storedStats,
    rankedIdentity: sanitizeRankedIdentitySnapshot(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.rankedIdentity) ?? "null"),
    ),
    feedbackPreferences: sanitizeFeedbackPreferences(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.feedbackPreferences) ?? "null"),
    ),
  };
}

interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [savedCardIds, setSavedCardIds] = useState<string[]>([]);
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [rankedIdentity, setRankedIdentity] = useState<RankedIdentitySnapshot | null>(
    null,
  );
  const [feedbackPreferences, setFeedbackPreferences] = useState<FeedbackPreferences>(
    defaultFeedbackPreferences,
  );
  const [sessionSummaryProgress, setSessionSummaryProgress] = useState<SessionSummaryProgress>(
    defaultSessionSummaryProgress,
  );
  const [pendingSessionSummary, setPendingSessionSummary] =
    useState<SessionSummarySnapshot | null>(null);
  const [recentAchievementUnlocks, setRecentAchievementUnlocks] = useState<
    AchievementDefinition[]
  >([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const hydratedState = readHydratedState();
      setHasCompletedOnboarding(hydratedState.hasCompletedOnboarding);
      setSavedCardIds(hydratedState.savedCardIds);
      setStats(hydratedState.stats);
      setRankedIdentity(hydratedState.rankedIdentity);
      setFeedbackPreferences(hydratedState.feedbackPreferences);
    } catch (error) {
      console.error("Failed to load state", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    localStorage.setItem(
      STORAGE_KEYS.onboarding,
      hasCompletedOnboarding ? "true" : "false",
    );
    localStorage.setItem(STORAGE_KEYS.saved, JSON.stringify(savedCardIds));
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
    localStorage.setItem(
      STORAGE_KEYS.rankedIdentity,
      JSON.stringify(rankedIdentity),
    );
    localStorage.setItem(
      STORAGE_KEYS.feedbackPreferences,
      JSON.stringify(feedbackPreferences),
    );
  }, [
    feedbackPreferences,
    hasCompletedOnboarding,
    isLoaded,
    rankedIdentity,
    savedCardIds,
    stats,
  ]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (
        !event.key ||
        (event.key !== STORAGE_KEYS.onboarding &&
          event.key !== STORAGE_KEYS.saved &&
          event.key !== STORAGE_KEYS.stats &&
          event.key !== STORAGE_KEYS.rankedIdentity &&
          event.key !== STORAGE_KEYS.feedbackPreferences)
      ) {
        return;
      }

      try {
        const hydratedState = readHydratedState();
        setHasCompletedOnboarding(hydratedState.hasCompletedOnboarding);
        setSavedCardIds(hydratedState.savedCardIds);
        setStats(hydratedState.stats);
        setRankedIdentity(hydratedState.rankedIdentity);
        setFeedbackPreferences(hydratedState.feedbackPreferences);
      } catch (error) {
        console.error("Failed to sync state", error);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboarding(true);
  }, []);

  const toggleSaveCard = useCallback((cardId: string) => {
    setSavedCardIds((currentIds) => {
      if (currentIds.includes(cardId)) {
        return currentIds.filter((id) => id !== cardId);
      }

      const nextIds = [...currentIds, cardId];
      setStats((previousStats) => {
        const applied = applySavedPassageAchievementProgress(
          previousStats.achievementProgress,
          nextIds.length,
        );
        const unlocked = unlockAchievementsForTriggers(applied.progress, applied.triggers);
        if (unlocked.newlyUnlocked.length > 0) {
          setRecentAchievementUnlocks(unlocked.newlyUnlocked);
        }
        return {
          ...previousStats,
          achievementProgress: unlocked.progress,
        };
      });
      return nextIds;
    });
  }, []);

  const recordQuestionAttempt = useCallback(
    (
      isCorrect: boolean,
      context?: Omit<AnswerAchievementContext, "dailyGoalTarget">,
    ) => {
    setStats((previousStats) => {
      const today = formatDayKey(new Date());
      const lastPracticedDay = parseStoredDayKey(previousStats.lastPracticedDay);
      const dayDifference = lastPracticedDay
        ? getDayDifference(lastPracticedDay, today)
        : null;

      let streak = previousStats.streak;
      if (lastPracticedDay !== today) {
        streak =
          dayDifference === null || dayDifference === 1
            ? previousStats.streak + 1
            : 1;
      }

      const nextDailyStats = { ...previousStats.dailyStats };
      const currentDayStats = nextDailyStats[today] ?? { attempted: 0, correct: 0 };
      nextDailyStats[today] = {
        attempted: currentDayStats.attempted + 1,
        correct: currentDayStats.correct + (isCorrect ? 1 : 0),
      };
      const applied = applyAnswerAchievementProgress(
        previousStats.achievementProgress,
        isCorrect,
        {
          ...(context ?? {}),
          dailyGoalTarget: DAILY_QUESTION_GOAL,
        },
      );
      const unlocked = unlockAchievementsForTriggers(applied.progress, applied.triggers);
      if (unlocked.newlyUnlocked.length > 0) {
        setRecentAchievementUnlocks(unlocked.newlyUnlocked);
      }

      return {
        totalQuestionsCompleted: previousStats.totalQuestionsCompleted + 1,
        streak,
        lastPracticedDay: today,
        totalCorrect: previousStats.totalCorrect + (isCorrect ? 1 : 0),
        totalIncorrect: previousStats.totalIncorrect + (isCorrect ? 0 : 1),
        dailyStats: nextDailyStats,
        achievementProgress: unlocked.progress,
      };
    });
    },
    [],
  );

  const recordSessionAnswerResult = useCallback(
    ({
      isCorrect,
      xpDelta,
      lpDelta,
    }: {
      isCorrect: boolean;
      xpDelta: number;
      lpDelta: number;
    }) => {
      setSessionSummaryProgress((previousProgress) => {
        const nextProgress: SessionSummaryProgress = {
          answered: previousProgress.answered + 1,
          correct: previousProgress.correct + (isCorrect ? 1 : 0),
          xpDeltaTotal: previousProgress.xpDeltaTotal + Math.trunc(xpDelta),
          lpDeltaTotal: previousProgress.lpDeltaTotal + Math.trunc(lpDelta),
        };

        if (nextProgress.answered < 10) {
          return nextProgress;
        }

        const incorrect = Math.max(0, nextProgress.answered - nextProgress.correct);
        const accuracyPercent =
          nextProgress.answered > 0
            ? Math.round((nextProgress.correct / nextProgress.answered) * 100)
            : 0;

        setPendingSessionSummary({
          answered: nextProgress.answered,
          correct: nextProgress.correct,
          incorrect,
          accuracyPercent,
          lpDeltaTotal: nextProgress.lpDeltaTotal,
          xpDeltaTotal: nextProgress.xpDeltaTotal,
        });

        return defaultSessionSummaryProgress;
      });
    },
    [],
  );

  const recordRankedResult = useCallback((context: RankedAchievementContext) => {
    setStats((previousStats) => {
      const applied = applyRankedAchievementProgress(
        previousStats.achievementProgress,
        context,
      );
      const unlocked = unlockAchievementsForTriggers(applied.progress, applied.triggers);
      if (unlocked.newlyUnlocked.length > 0) {
        setRecentAchievementUnlocks(unlocked.newlyUnlocked);
      }
      return {
        ...previousStats,
        achievementProgress: unlocked.progress,
      };
    });
    setRankedIdentity((previousIdentity) => {
      if (!previousIdentity) {
        return previousIdentity;
      }
      return {
        ...previousIdentity,
        rankedPoints:
          typeof context.rankedPointsAfter === "number"
            ? Math.max(0, Math.trunc(context.rankedPointsAfter))
            : previousIdentity.rankedPoints,
        currentRank:
          typeof context.rank === "string" && context.rank.length > 0
            ? context.rank
            : previousIdentity.currentRank,
      };
    });
  }, []);

  const recordPassageReport = useCallback(() => {
    setStats((previousStats) => {
      const applied = applyReportAchievementProgress(previousStats.achievementProgress);
      const unlocked = unlockAchievementsForTriggers(applied.progress, applied.triggers);
      if (unlocked.newlyUnlocked.length > 0) {
        setRecentAchievementUnlocks(unlocked.newlyUnlocked);
      }
      return {
        ...previousStats,
        achievementProgress: unlocked.progress,
      };
    });
  }, []);

  const dismissRecentAchievementUnlocks = useCallback(() => {
    setRecentAchievementUnlocks([]);
  }, []);

  const dismissSessionSummary = useCallback(() => {
    setPendingSessionSummary(null);
  }, []);

  const syncRankedIdentity = useCallback(
    (progress: UserProgress | null | undefined, rankTiers?: RankTierThreshold[] | null) => {
      if (!progress) {
        return;
      }
      setRankedIdentity(buildRankedIdentitySnapshot(progress, rankTiers));
    },
    [],
  );

  const updateStats = useCallback(
    (correctAnswers: number, totalQuestions: number) => {
      setStats((previousStats) => {
        const today = formatDayKey(new Date());
        const lastPracticedDay = parseStoredDayKey(previousStats.lastPracticedDay);
        const dayDifference = lastPracticedDay
          ? getDayDifference(lastPracticedDay, today)
          : null;

        let streak = previousStats.streak;
        if (lastPracticedDay !== today) {
          streak =
            dayDifference === null || dayDifference === 1
              ? previousStats.streak + 1
              : 1;
        }

        const nextDailyStats = { ...previousStats.dailyStats };
        const currentDayStats = nextDailyStats[today] ?? { attempted: 0, correct: 0 };
        nextDailyStats[today] = {
          attempted: currentDayStats.attempted + totalQuestions,
          correct: currentDayStats.correct + correctAnswers,
        };

        return {
          totalQuestionsCompleted: previousStats.totalQuestionsCompleted + totalQuestions,
          streak,
          lastPracticedDay: today,
          totalCorrect: previousStats.totalCorrect + correctAnswers,
          totalIncorrect:
            previousStats.totalIncorrect + Math.max(0, totalQuestions - correctAnswers),
          dailyStats: nextDailyStats,
          achievementProgress: previousStats.achievementProgress,
        };
      });
    },
    [],
  );

  const updateFeedbackPreferences = useCallback(
    (nextPreferences: Partial<FeedbackPreferences>) => {
      setFeedbackPreferences((currentPreferences) =>
        sanitizeFeedbackPreferences({
          ...currentPreferences,
          ...nextPreferences,
        }),
      );
    },
    [],
  );

  const isCardSaved = useCallback(
    (cardId: string) => savedCardIds.includes(cardId),
    [savedCardIds],
  );

  const value: AppStateValue = {
    isLoaded,
    hasCompletedOnboarding,
    completeOnboarding,
    savedCardIds,
    isCardSaved,
    toggleSaveCard,
    stats,
    rankedIdentity,
    feedbackPreferences,
    pendingSessionSummary,
    recentAchievementUnlocks,
    dismissRecentAchievementUnlocks,
    dismissSessionSummary,
    recordQuestionAttempt,
    recordSessionAnswerResult,
    recordRankedResult,
    recordPassageReport,
    syncRankedIdentity,
    updateStats,
    updateFeedbackPreferences,
  };

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }

  return context;
}
