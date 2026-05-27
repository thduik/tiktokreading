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
  calculateAchievementXpFromKeys,
  getAchievementLevelProgress,
  mergeAchievementUnlockKeys,
  sanitizeAchievementProgress,
  unlockAchievementsForTriggers,
  type AchievementDefinition,
  type AchievementLevelProgress,
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
import {
  advanceSessionSummaryProgress,
  defaultSessionSummaryProgress,
  MAX_STORED_MISTAKES,
  sanitizeMistakes,
  type MistakeEntry,
  type SessionSummaryProgress,
  type SessionSummarySnapshot,
} from "@/lib/practice-tracking";
import {
  API_CACHE_USER_SCOPE_CHANGE_EVENT,
  API_CACHE_USER_SCOPE_STORAGE_KEY,
  DEFAULT_API_CACHE_USER_SCOPE,
  readActiveApiCacheUserScope,
} from "@/lib/api-cache";
import { authEnabled } from "@/lib/runtime-config";

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
  achievementLevelProgress: AchievementLevelProgress;
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
  mistakes: MistakeEntry[];
  pendingSessionSummary: SessionSummarySnapshot | null;
  recentAchievementUnlocks: AchievementDefinition[];
  dismissRecentAchievementUnlocks: () => void;
  dismissSessionSummary: () => void;
  clearMistakes: () => void;
  recordQuestionAttempt: (
    isCorrect: boolean,
    context?: Omit<AnswerAchievementContext, "dailyGoalTarget">,
  ) => void;
  recordSessionAnswerResult: (result: {
      isCorrect: boolean;
      xpDelta: number;
      lpDelta: number;
      questionType?: string;
    }) => void;
  recordRankedResult: (context: RankedAchievementContext) => void;
  recordPassageReport: () => void;
  recordMistake: (entry: MistakeEntry) => void;
  mergeSyncedAchievements: (payload: {
    unlockedKeys: string[];
    levelProgress?: AchievementLevelProgress | null;
  }) => void;
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
  mistakes: "readtok_mistakes",
} as const;

function shouldPersistSyncedUserState() {
  return !authEnabled;
}

function readActiveLocalStateScope() {
  if (!authEnabled) {
    return DEFAULT_API_CACHE_USER_SCOPE;
  }

  return readActiveApiCacheUserScope();
}

function buildScopedStorageKey(key: string, scope: string) {
  if (!authEnabled) {
    return key;
  }

  return `${key}:${scope}`;
}

function safeLocalStorageSetItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeLocalStorageRemoveItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore cleanup failures.
  }
}

function writeMistakesStorage(key: string, entries: MistakeEntry[]) {
  const compacted = sanitizeMistakes(entries);
  const candidateLists = [
    compacted,
    compacted.slice(0, Math.min(50, MAX_STORED_MISTAKES)),
    compacted.slice(0, 20),
    [],
  ];

  for (const candidate of candidateLists) {
    try {
      window.localStorage.setItem(key, JSON.stringify(candidate));
      return candidate;
    } catch {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Keep trying smaller payloads.
      }
    }
  }

  return [] as MistakeEntry[];
}

function purgeSyncedUserStorage() {
  if (typeof window === "undefined") {
    return;
  }

  safeLocalStorageRemoveItem(STORAGE_KEYS.stats);
  safeLocalStorageRemoveItem(STORAGE_KEYS.rankedIdentity);
}

const defaultStats: UserStats = {
  totalQuestionsCompleted: 0,
  streak: 0,
  lastPracticedDay: null,
  totalCorrect: 0,
  totalIncorrect: 0,
  dailyStats: {},
  achievementProgress: sanitizeAchievementProgress(null),
  achievementLevelProgress: getAchievementLevelProgress(0),
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
      achievementLevelProgress: getAchievementLevelProgress(0),
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

  const achievementProgress = sanitizeAchievementProgress(stats.achievementProgress, {
    totalQuestionsAnswered: Math.max(0, Math.trunc(totalQuestionsCompleted)),
    totalCorrectAnswers: Math.max(0, Math.trunc(totalCorrect)),
    totalWrongAnswers: Math.max(0, Math.trunc(totalIncorrect)),
    currentPracticeStreakDays:
      typeof stats.streak === "number" ? Math.max(0, Math.trunc(stats.streak)) : 0,
    lastPracticeDateLocal: parseStoredDayKey(
      stats.lastPracticedDay ?? stats.lastPracticed,
    ),
  });
  const achievementLevelProgress = getAchievementLevelProgress(
    calculateAchievementXpFromKeys(achievementProgress.unlockedAchievementKeys),
  );

  return {
    totalQuestionsCompleted: Math.max(0, Math.trunc(totalQuestionsCompleted)),
    streak: typeof stats.streak === "number" ? stats.streak : 0,
    lastPracticedDay: parseStoredDayKey(
      stats.lastPracticedDay ?? stats.lastPracticed,
    ),
    totalCorrect: Math.max(0, Math.trunc(totalCorrect)),
    totalIncorrect: Math.max(0, Math.trunc(totalIncorrect)),
    dailyStats: parsedDailyStats,
    achievementProgress,
    achievementLevelProgress,
  };
}

function deriveAchievementLevelProgress(unlockedKeys: string[]) {
  return getAchievementLevelProgress(calculateAchievementXpFromKeys(unlockedKeys));
}

function readSavedCardIds(scope: string) {
  const rawSaved = localStorage.getItem(
    buildScopedStorageKey(STORAGE_KEYS.saved, scope),
  );
  if (!rawSaved) {
    return [];
  }

  const parsedSaved = JSON.parse(rawSaved);
  if (!Array.isArray(parsedSaved)) {
    return [];
  }

  return parsedSaved.filter((value): value is string => typeof value === "string");
}

function readHydratedState(scope: string) {
  const hasCompletedOnboarding =
    localStorage.getItem(STORAGE_KEYS.onboarding) === "true";

  const savedCardIds = readSavedCardIds(scope);
  const storedStats = shouldPersistSyncedUserState()
    ? sanitizeStats(JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) ?? "null"))
    : {
        ...defaultStats,
        dailyStats: {},
        achievementProgress: sanitizeAchievementProgress(null),
        achievementLevelProgress: getAchievementLevelProgress(0),
      };
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
    rankedIdentity: shouldPersistSyncedUserState()
      ? sanitizeRankedIdentitySnapshot(
          JSON.parse(localStorage.getItem(STORAGE_KEYS.rankedIdentity) ?? "null"),
        )
      : null,
    feedbackPreferences: sanitizeFeedbackPreferences(
      JSON.parse(
        localStorage.getItem(buildScopedStorageKey(STORAGE_KEYS.feedbackPreferences, scope)) ??
          "null",
      ),
    ),
    mistakes: sanitizeMistakes(
      JSON.parse(
        localStorage.getItem(buildScopedStorageKey(STORAGE_KEYS.mistakes, scope)) ?? "null",
      ),
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
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [sessionSummaryProgress, setSessionSummaryProgress] = useState<SessionSummaryProgress>(
    defaultSessionSummaryProgress,
  );
  const [pendingSessionSummary, setPendingSessionSummary] =
    useState<SessionSummarySnapshot | null>(null);
  const [recentAchievementUnlocks, setRecentAchievementUnlocks] = useState<
    AchievementDefinition[]
  >([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeStorageScope, setActiveStorageScope] = useState<string>(() =>
    readActiveLocalStateScope(),
  );
  const [hydratedStorageScope, setHydratedStorageScope] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !authEnabled) {
      return;
    }

    const syncScope = () => {
      const nextScope = readActiveLocalStateScope();
      setActiveStorageScope((currentScope) =>
        currentScope === nextScope ? currentScope : nextScope,
      );
    };

    const handleScopeChange = () => {
      syncScope();
    };

    const handleScopeStorage = (event: StorageEvent) => {
      if (event.key === API_CACHE_USER_SCOPE_STORAGE_KEY) {
        syncScope();
      }
    };

    window.addEventListener(API_CACHE_USER_SCOPE_CHANGE_EVENT, handleScopeChange);
    window.addEventListener("storage", handleScopeStorage);
    return () => {
      window.removeEventListener(API_CACHE_USER_SCOPE_CHANGE_EVENT, handleScopeChange);
      window.removeEventListener("storage", handleScopeStorage);
    };
  }, []);

  useEffect(() => {
    if (!shouldPersistSyncedUserState()) {
      purgeSyncedUserStorage();
    }

    try {
      const hydratedState = readHydratedState(activeStorageScope);
      setHasCompletedOnboarding(hydratedState.hasCompletedOnboarding);
      setSavedCardIds(hydratedState.savedCardIds);
      setStats(hydratedState.stats);
      setRankedIdentity(hydratedState.rankedIdentity);
      setFeedbackPreferences(hydratedState.feedbackPreferences);
      setMistakes(hydratedState.mistakes);
      setHydratedStorageScope(activeStorageScope);
    } catch (error) {
      console.error("Failed to load state", error);
    } finally {
      setIsLoaded(true);
    }
  }, [activeStorageScope]);

  useEffect(() => {
    if (!isLoaded || hydratedStorageScope !== activeStorageScope) {
      return;
    }

    safeLocalStorageSetItem(
      STORAGE_KEYS.onboarding,
      hasCompletedOnboarding ? "true" : "false",
    );
    safeLocalStorageSetItem(
      buildScopedStorageKey(STORAGE_KEYS.saved, activeStorageScope),
      JSON.stringify(savedCardIds),
    );
    if (shouldPersistSyncedUserState()) {
      safeLocalStorageSetItem(STORAGE_KEYS.stats, JSON.stringify(stats));
      safeLocalStorageSetItem(
        STORAGE_KEYS.rankedIdentity,
        JSON.stringify(rankedIdentity),
      );
    } else {
      purgeSyncedUserStorage();
    }
    safeLocalStorageSetItem(
      buildScopedStorageKey(STORAGE_KEYS.feedbackPreferences, activeStorageScope),
      JSON.stringify(feedbackPreferences),
    );
    const storedMistakes = writeMistakesStorage(
      buildScopedStorageKey(STORAGE_KEYS.mistakes, activeStorageScope),
      mistakes,
    );
    if (storedMistakes.length !== mistakes.length) {
      setMistakes(storedMistakes);
    }
  }, [
    activeStorageScope,
    feedbackPreferences,
    hasCompletedOnboarding,
    hydratedStorageScope,
    isLoaded,
    mistakes,
    rankedIdentity,
    savedCardIds,
    stats,
  ]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      const syncedStateKeyAllowed =
        shouldPersistSyncedUserState() &&
        (event.key === STORAGE_KEYS.stats || event.key === STORAGE_KEYS.rankedIdentity);
      const scopedSavedKey = buildScopedStorageKey(STORAGE_KEYS.saved, activeStorageScope);
      const scopedFeedbackKey = buildScopedStorageKey(
        STORAGE_KEYS.feedbackPreferences,
        activeStorageScope,
      );
      const scopedMistakesKey = buildScopedStorageKey(
        STORAGE_KEYS.mistakes,
        activeStorageScope,
      );

      if (
        !event.key ||
        (event.key !== STORAGE_KEYS.onboarding &&
          event.key !== scopedSavedKey &&
          !syncedStateKeyAllowed &&
          event.key !== scopedFeedbackKey &&
          event.key !== scopedMistakesKey &&
          event.key !== API_CACHE_USER_SCOPE_STORAGE_KEY)
      ) {
        return;
      }

      try {
        if (event.key === API_CACHE_USER_SCOPE_STORAGE_KEY) {
          setActiveStorageScope(readActiveLocalStateScope());
          return;
        }

        const hydratedState = readHydratedState(activeStorageScope);
        setHasCompletedOnboarding(hydratedState.hasCompletedOnboarding);
        setSavedCardIds(hydratedState.savedCardIds);
        setStats(hydratedState.stats);
        setRankedIdentity(hydratedState.rankedIdentity);
        setFeedbackPreferences(hydratedState.feedbackPreferences);
        setMistakes(hydratedState.mistakes);
      } catch (error) {
        console.error("Failed to sync state", error);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [activeStorageScope]);

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
          achievementLevelProgress: deriveAchievementLevelProgress(
            unlocked.progress.unlockedAchievementKeys,
          ),
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
        achievementLevelProgress: deriveAchievementLevelProgress(
          unlocked.progress.unlockedAchievementKeys,
        ),
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
      questionType,
    }: {
      isCorrect: boolean;
      xpDelta: number;
      lpDelta: number;
      questionType?: string;
    }) => {
      setSessionSummaryProgress((previousProgress) => {
        const { nextProgress, snapshot } = advanceSessionSummaryProgress(
          previousProgress,
          {
            isCorrect,
            xpDelta,
            lpDelta,
            questionType,
          },
        );

        if (snapshot) {
          setPendingSessionSummary(snapshot);
        }

        return nextProgress;
      });
    },
    [],
  );

  const recordMistake = useCallback((entry: MistakeEntry) => {
    setMistakes((previousMistakes) =>
      sanitizeMistakes([entry, ...previousMistakes]),
    );
  }, []);

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
        achievementLevelProgress: deriveAchievementLevelProgress(
          unlocked.progress.unlockedAchievementKeys,
        ),
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
        achievementLevelProgress: deriveAchievementLevelProgress(
          unlocked.progress.unlockedAchievementKeys,
        ),
      };
    });
  }, []);

  const dismissRecentAchievementUnlocks = useCallback(() => {
    setRecentAchievementUnlocks([]);
  }, []);

  const dismissSessionSummary = useCallback(() => {
    setPendingSessionSummary(null);
  }, []);

  const clearMistakes = useCallback(() => {
    setMistakes([]);
  }, []);

  const mergeSyncedAchievements = useCallback(
    ({
      unlockedKeys,
      levelProgress,
    }: {
      unlockedKeys: string[];
      levelProgress?: AchievementLevelProgress | null;
    }) => {
      setStats((previousStats) => {
        const mergedKeys = mergeAchievementUnlockKeys(
          previousStats.achievementProgress.unlockedAchievementKeys ?? [],
          unlockedKeys,
        );
        const previousKeys = previousStats.achievementProgress.unlockedAchievementKeys ?? [];
        const isSameLength = mergedKeys.length === previousKeys.length;
        const isSameKeys =
          isSameLength && mergedKeys.every((key) => previousKeys.includes(key));

        if (isSameKeys && !levelProgress) {
          return previousStats;
        }

        return {
          ...previousStats,
          achievementProgress: {
            ...previousStats.achievementProgress,
            unlockedAchievementKeys: mergedKeys,
          },
          achievementLevelProgress:
            levelProgress ?? deriveAchievementLevelProgress(mergedKeys),
        };
      });
    },
    [],
  );

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
          achievementLevelProgress: previousStats.achievementLevelProgress,
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
    mistakes,
    pendingSessionSummary,
    recentAchievementUnlocks,
    dismissRecentAchievementUnlocks,
    dismissSessionSummary,
    clearMistakes,
    recordQuestionAttempt,
    recordSessionAnswerResult,
    recordRankedResult,
    recordPassageReport,
    recordMistake,
    mergeSyncedAchievements,
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
