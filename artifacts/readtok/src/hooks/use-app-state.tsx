import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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
}

interface AppStateValue {
  isLoaded: boolean;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
  savedCardIds: string[];
  isCardSaved: (cardId: string) => boolean;
  toggleSaveCard: (cardId: string) => void;
  stats: UserStats;
  recordQuestionAttempt: (isCorrect: boolean) => void;
  updateStats: (correctAnswers: number, totalQuestions: number) => void;
}

const STORAGE_KEYS = {
  onboarding: "readtok_onboarding",
  saved: "readtok_saved",
  stats: "readtok_stats",
} as const;

const defaultStats: UserStats = {
  totalQuestionsCompleted: 0,
  streak: 0,
  lastPracticedDay: null,
  totalCorrect: 0,
  totalIncorrect: 0,
  dailyStats: {},
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
    return defaultStats;
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
  };
}

interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [savedCardIds, setSavedCardIds] = useState<string[]>([]);
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const hydratedState = readHydratedState();
      setHasCompletedOnboarding(hydratedState.hasCompletedOnboarding);
      setSavedCardIds(hydratedState.savedCardIds);
      setStats(hydratedState.stats);
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
  }, [hasCompletedOnboarding, isLoaded, savedCardIds, stats]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (
        !event.key ||
        (event.key !== STORAGE_KEYS.onboarding &&
          event.key !== STORAGE_KEYS.saved &&
          event.key !== STORAGE_KEYS.stats)
      ) {
        return;
      }

      try {
        const hydratedState = readHydratedState();
        setHasCompletedOnboarding(hydratedState.hasCompletedOnboarding);
        setSavedCardIds(hydratedState.savedCardIds);
        setStats(hydratedState.stats);
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
    setSavedCardIds((currentIds) =>
      currentIds.includes(cardId)
        ? currentIds.filter((id) => id !== cardId)
        : [...currentIds, cardId],
    );
  }, []);

  const recordQuestionAttempt = useCallback((isCorrect: boolean) => {
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

      return {
        totalQuestionsCompleted: previousStats.totalQuestionsCompleted + 1,
        streak,
        lastPracticedDay: today,
        totalCorrect: previousStats.totalCorrect + (isCorrect ? 1 : 0),
        totalIncorrect: previousStats.totalIncorrect + (isCorrect ? 0 : 1),
        dailyStats: nextDailyStats,
      };
    });
  }, []);

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
        };
      });
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
    recordQuestionAttempt,
    updateStats,
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
