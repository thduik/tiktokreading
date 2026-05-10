import { useAppState } from "@/hooks/use-app-state";
import { useUser, useClerk } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  BarChart3,
  Target,
  TrendingUp,
  BookOpenCheck,
  LogOut,
  ShieldCheck,
  UserRound,
  Trophy,
  ArrowUpRight,
} from "lucide-react";
import { RankPlate } from "@/components/rank-plate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch as Toggle } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AppPageHeader } from "@/components/app-page-header";
import {
  DAILY_QUESTION_GOAL,
  formatLocalDayKey,
  getDailyGoalProgress,
} from "@/lib/daily-goal";
import { ACHIEVEMENTS } from "@/lib/achievements";
import {
  bootstrapMyProfile,
  fetchMyDashboardStats,
  fetchMyAnswerStats,
  fetchMyProfile,
  type AnswerStatBandGroup,
  type AnswerStatQuestionType,
  type AnswerStatsEnvelope,
  type AnswerStatsPeriod,
  type DashboardStatsEnvelope,
  type RankTierThreshold,
  type UserProgress,
  updateMyProfile,
  type UserProfile,
} from "@/lib/profile-api";
import {
  DEFAULT_RANK_TIERS,
  getRankPlateData,
  normalizeRankTiers,
} from "@/lib/rank-visual";
import { authEnabled } from "@/lib/runtime-config";

function formatDayKey(date: Date) {
  return formatLocalDayKey(date);
}

function addDays(date: Date, dayDelta: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + dayDelta);
  return next;
}

function percent(correct: number, attempted: number) {
  if (attempted <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((correct / attempted) * 100)));
}

function clampAccuracy(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

const answerStatsPeriodOptions = [
  { key: "todayData", label: "Today" },
  { key: "last7dayData", label: "7 Days" },
  { key: "last30dayData", label: "30 Days" },
  { key: "lifetimeData", label: "Lifetime" },
] as const;

type AnswerStatsPeriodKey = (typeof answerStatsPeriodOptions)[number]["key"];

const answerStatsBandLabels: Record<AnswerStatBandGroup, string> = {
  Band6: "Band 6.0",
  Band7: "Band 7.0",
  Band75: "Band 7.5",
  Band8Plus: "Band 8.0+",
};

const answerStatsQuestionTypeLabels: Record<AnswerStatQuestionType, string> = {
  MCQ: "MCQ",
  TFNG: "TFNG",
  SentenceCompletion: "Sentence Completion",
  ShortAnswer: "Short Answer",
  Matching: "Matching",
};

function buildWeakAreaBandSummaries(period: AnswerStatsPeriod) {
  const bands: Array<{
    bandGroup: AnswerStatBandGroup;
    total: number;
    correct: number;
    wrong: number;
    accuracy: number;
    byType: Array<{
      questionType: AnswerStatQuestionType;
      total: number;
      correct: number;
      wrong: number;
      accuracy: number;
    }>;
  }> = [];

  for (const [bandGroup, byType] of Object.entries(period.byBandAndType)) {
    if (!byType) {
      continue;
    }

    let total = 0;
    let correct = 0;
    let wrong = 0;
    const byTypeRows: Array<{
      questionType: AnswerStatQuestionType;
      total: number;
      correct: number;
      wrong: number;
      accuracy: number;
    }> = [];

    for (const [questionType, cell] of Object.entries(byType)) {
      if (!cell || cell.total <= 0) {
        continue;
      }

      total += cell.total;
      correct += cell.correct;
      wrong += cell.wrong;
      byTypeRows.push({
        questionType: questionType as AnswerStatQuestionType,
        total: cell.total,
        correct: cell.correct,
        wrong: cell.wrong,
        accuracy: cell.accuracy,
      });
    }

    if (total <= 0) {
      continue;
    }

    byTypeRows.sort((left, right) => {
      if (right.wrong !== left.wrong) {
        return right.wrong - left.wrong;
      }
      if (left.accuracy !== right.accuracy) {
        return left.accuracy - right.accuracy;
      }
      return right.total - left.total;
    });

    bands.push({
      bandGroup: bandGroup as AnswerStatBandGroup,
      total,
      correct,
      wrong,
      accuracy: percent(correct, total),
      byType: byTypeRows,
    });
  }

  return bands.sort((left, right) => {
    if (right.wrong !== left.wrong) {
      return right.wrong - left.wrong;
    }
    if (left.accuracy !== right.accuracy) {
      return left.accuracy - right.accuracy;
    }
    return right.total - left.total;
  });
}

function ProfileStats({ source = "local" }: { source?: "local" | "synced" }) {
  const { stats } = useAppState();
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsEnvelope | null>(
    null,
  );
  const [isDashboardLoading, setIsDashboardLoading] = useState(source === "synced");
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    if (source !== "synced") {
      setIsDashboardLoading(false);
      setDashboardError(null);
      setDashboardStats(null);
      return;
    }

    let cancelled = false;
    setIsDashboardLoading(true);
    setDashboardError(null);

    async function loadDashboardStats() {
      try {
        const result = await fetchMyDashboardStats(formatLocalDayKey());
        if (cancelled) {
          return;
        }
        setDashboardStats(result);
      } catch (error) {
        if (!cancelled) {
          setDashboardError(
            error instanceof Error ? error.message : "Could not load synced stats.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsDashboardLoading(false);
        }
      }
    }

    void loadDashboardStats();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadDashboardStats();
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [source]);

  if (source === "synced" && isDashboardLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={index}
            className={`relative overflow-hidden rounded-lg border-border bg-card ${
              index === 0 || index === 2 ? "col-span-2" : ""
            }`}
          >
            <CardContent className="p-4">
              <div className="h-20 animate-pulse rounded-lg bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (source === "synced" && dashboardError) {
    return (
      <Card className="relative overflow-hidden rounded-lg border-destructive/35 bg-card">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-destructive">
            Synced stats are unavailable
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{dashboardError}</p>
        </CardContent>
      </Card>
    );
  }

  const today = new Date();
  const todayKey = formatDayKey(today);
  const todayStats = stats.dailyStats[todayKey] ?? { attempted: 0, correct: 0 };

  let last7Attempted = 0;
  let last7Correct = 0;
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const dayKey = formatDayKey(addDays(today, -dayOffset));
    const dayStats = stats.dailyStats[dayKey];
    if (!dayStats) {
      continue;
    }
    last7Attempted += dayStats.attempted;
    last7Correct += dayStats.correct;
  }

  const lifetimeAccuracy =
    source === "synced" && dashboardStats
      ? clampAccuracy(dashboardStats.headline.lifetime_accuracy)
      : percent(stats.totalCorrect, stats.totalQuestionsCompleted);
  const last7Accuracy =
    source === "synced" && dashboardStats
      ? clampAccuracy(dashboardStats.headline.last7_accuracy)
      : percent(last7Correct, last7Attempted);
  const todayAccuracy =
    source === "synced" && dashboardStats
      ? clampAccuracy(dashboardStats.headline.today_accuracy)
      : percent(todayStats.correct, todayStats.attempted);
  const dailyGoal =
    source === "synced" && dashboardStats
      ? {
          attemptedToday: dashboardStats.daily_goal.attempted_today,
          goal: dashboardStats.daily_goal.goal,
          remaining: dashboardStats.daily_goal.remaining,
          progressPercent: dashboardStats.daily_goal.progress_percent,
          isComplete: dashboardStats.daily_goal.is_complete,
        }
      : getDailyGoalProgress(todayStats.attempted, DAILY_QUESTION_GOAL);
  const currentStreak =
    source === "synced" && dashboardStats
      ? dashboardStats.current_streak_days
      : stats.streak;
  const totalQuestionsCompleted =
    source === "synced" && dashboardStats
      ? dashboardStats.headline.total_questions_completed
      : stats.totalQuestionsCompleted;
  const totalCorrect =
    source === "synced" && dashboardStats
      ? dashboardStats.headline.total_correct
      : stats.totalCorrect;
  const todayCorrect =
    source === "synced" && dashboardStats
      ? dashboardStats.headline.today_correct
      : todayStats.correct;
  const todayAttempted =
    source === "synced" && dashboardStats
      ? dashboardStats.headline.today_attempted
      : todayStats.attempted;
  const last7CorrectDisplay =
    source === "synced" && dashboardStats
      ? dashboardStats.headline.last7_correct
      : last7Correct;
  const last7AttemptedDisplay =
    source === "synced" && dashboardStats
      ? dashboardStats.headline.last7_attempted
      : last7Attempted;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="relative col-span-2 overflow-hidden rounded-lg border-primary/35 bg-card" data-testid="stat-daily-goal">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Daily Goal</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {dailyGoal.attemptedToday}/{dailyGoal.goal}
                <span className="ml-1 text-sm font-medium text-muted-foreground">questions</span>
              </p>
            </div>
            <div className="rounded-lg border border-primary/45 bg-primary/15 px-3 py-2 text-right">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                {dailyGoal.isComplete ? "Done" : `${dailyGoal.remaining} left`}
              </p>
            </div>
          </div>
          <Progress value={dailyGoal.progressPercent} className="mt-3 h-2 bg-background" />
          <p className="mt-2 text-xs text-muted-foreground">
            {dailyGoal.isComplete
              ? "Goal complete for today."
              : "Answer 20 questions today to complete the goal."}
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden rounded-lg border-border bg-card" data-testid="stat-streak">
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <TrendingUp className="w-12 h-12" />
        </div>
        <CardContent className="p-4 pt-6">
          <p className="text-sm font-medium text-muted-foreground mb-1">Current Streak</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-foreground">{currentStreak}</span>
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          {currentStreak > 0 && (
            <p className="mt-2 text-xs font-medium text-secondary">Keep the line alive</p>
          )}
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden rounded-lg border-border bg-card" data-testid="stat-questions-completed">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <BookOpenCheck className="w-16 h-16" />
        </div>
        <CardContent className="p-4 pt-6">
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Questions Completed</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-primary">{totalQuestionsCompleted}</span>
            <span className="text-sm text-muted-foreground">questions</span>
          </div>
        </CardContent>
      </Card>

      <Card className="relative col-span-2 overflow-hidden rounded-lg border-border bg-card" data-testid="stat-accuracy">
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <Target className="w-12 h-12" />
        </div>
        <CardContent className="p-4 pt-6">
          <p className="text-sm font-medium text-muted-foreground mb-2">Accuracy</p>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Lifetime
              </p>
              <p className="text-sm font-semibold text-foreground">
                {lifetimeAccuracy}% ({totalCorrect}/{totalQuestionsCompleted})
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Past 7 Days
              </p>
              <p className="text-sm font-semibold text-foreground">
                {last7Accuracy}% ({last7CorrectDisplay}/{last7AttemptedDisplay})
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Today
              </p>
              <p className="text-sm font-semibold text-foreground">
                {todayAccuracy}% ({todayCorrect}/{todayAttempted})
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileFeedbackSettings() {
  const { feedbackPreferences, updateFeedbackPreferences } = useAppState();

  return (
    <Card
      className="relative mt-3 overflow-hidden rounded-lg border-border bg-card"
      data-testid="card-feedback-settings"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Feedback
            </p>
            <h2 className="mt-1 text-lg font-bold text-foreground">
              Sound and haptics
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep answer reactions subtle, optional, and mobile-friendly.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Sound</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Soft tick for correct answers, dull tap for misses.
              </p>
            </div>
            <Toggle
              checked={feedbackPreferences.soundEnabled}
              onCheckedChange={(checked) =>
                updateFeedbackPreferences({ soundEnabled: checked })
              }
              aria-label="Toggle answer sound"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Haptics</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Use a tiny vibration pulse on supported devices.
              </p>
            </div>
            <Toggle
              checked={feedbackPreferences.hapticsEnabled}
              onCheckedChange={(checked) =>
                updateFeedbackPreferences({ hapticsEnabled: checked })
              }
              aria-label="Toggle answer haptics"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileLeaderboardEntry() {
  return (
    <Card className="relative mt-3 overflow-hidden rounded-lg border-border bg-card" data-testid="card-leaderboard-entry">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Leaderboard
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">See who is climbing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse the global board or drill into Bronze, Silver, Gold, and beyond.
            </p>
          </div>
          <div className="rounded-lg border border-primary/35 bg-primary/10 p-2 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
        </div>
        <Button asChild className="mt-4 w-full" data-testid="button-open-leaderboard">
          <Link href="/leaderboard">
            Open leaderboard
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ProfileWeakAreas() {
  const { stats } = useAppState();
  const [answerStats, setAnswerStats] = useState<AnswerStatsEnvelope | null>(null);
  const [selectedPeriodKey, setSelectedPeriodKey] =
    useState<AnswerStatsPeriodKey>("last7dayData");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function loadAnswerStats() {
      try {
        const result = await fetchMyAnswerStats(formatLocalDayKey());
        if (cancelled) {
          return;
        }
        setAnswerStats(result);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load answer stats.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAnswerStats();

    return () => {
      cancelled = true;
    };
  }, [stats.totalQuestionsCompleted]);

  const selectedPeriod = answerStats?.[selectedPeriodKey] ?? null;
  const bandSummaries = selectedPeriod ? buildWeakAreaBandSummaries(selectedPeriod) : [];

  return (
    <Card
      className="relative mt-3 overflow-hidden rounded-lg border-border bg-card"
      data-testid="card-weak-areas"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <BarChart3 className="h-3.5 w-3.5" />
              Weak Areas
            </p>
            <h2 className="mt-1 text-lg font-bold text-foreground">
              Answer patterns
            </h2>
          </div>
          {selectedPeriod && (
            <div className="rounded-lg border border-primary/35 bg-primary/15 px-3 py-2 text-right">
              <p className="text-xs font-bold text-primary">
                {clampAccuracy(selectedPeriod.overall.accuracy)}%
              </p>
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Accuracy
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {answerStatsPeriodOptions.map((option) => {
            const selected = selectedPeriodKey === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedPeriodKey(option.key)}
                className={`h-9 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                  selected
                    ? "border-primary/45 bg-primary/15 text-primary"
                    : "border-border bg-muted text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-2">
            <div className="h-12 animate-pulse rounded-lg bg-muted" />
            <div className="h-12 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : error ? (
          <div className="mt-4 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-3">
            <p className="text-sm font-semibold text-destructive">
              Stats are not ready yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        ) : selectedPeriod && selectedPeriod.overall.total > 0 ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-muted px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Attempted
                </p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {selectedPeriod.overall.total}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Wrong
                </p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {selectedPeriod.overall.wrong}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Correct
                </p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {selectedPeriod.overall.correct}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Accuracy
                </p>
                <p className="mt-1 text-xl font-bold text-primary">
                  {clampAccuracy(selectedPeriod.overall.accuracy)}%
                </p>
              </div>
            </div>

            {bandSummaries.length > 0 ? (
              <Accordion
                type="single"
                collapsible
                className="rounded-lg border border-border bg-muted px-3"
              >
                {bandSummaries.map((band) => (
                  <AccordionItem
                    key={band.bandGroup}
                    value={band.bandGroup}
                    className="border-border last:border-b-0"
                  >
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-3">
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-semibold text-foreground">
                            {answerStatsBandLabels[band.bandGroup]}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {band.correct}/{band.total} correct • {band.wrong} wrong
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-primary">
                          {clampAccuracy(band.accuracy)}%
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1">
                      <div className="space-y-2">
                        {band.byType.map((typeRow) => (
                          <div
                            key={`${band.bandGroup}:${typeRow.questionType}`}
                            className="rounded-lg border border-border bg-card px-3 py-3"
                            data-testid="item-weak-area"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  {answerStatsQuestionTypeLabels[typeRow.questionType]}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {typeRow.correct}/{typeRow.total} correct • {typeRow.wrong} wrong
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-bold text-primary">
                                {clampAccuracy(typeRow.accuracy)}%
                              </p>
                            </div>
                            <Progress
                              value={clampAccuracy(typeRow.accuracy)}
                              className="mt-2 h-1.5 bg-background"
                            />
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="rounded-lg border border-border bg-muted px-3 py-3">
                <p className="text-sm font-semibold text-foreground">
                  No band detail yet
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Keep answering signed-in questions and your band breakdown will fill in here.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-muted px-3 py-3">
            <p className="text-sm font-semibold text-foreground">
              No backend answer data yet
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Answer a few signed-in questions and this will start showing your
              strongest and weakest categories.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileAchievements() {
  const { stats } = useAppState();
  const unlockedKeySet = new Set(
    stats.achievementProgress.unlockedAchievementKeys ?? [],
  );
  const activeAchievements = ACHIEVEMENTS.filter(
    (achievement) => achievement.phase === "v1",
  );
  const unlockedAchievements = activeAchievements.filter((achievement) =>
    unlockedKeySet.has(achievement.key),
  );
  const latestUnlocked = unlockedAchievements.slice(-4).reverse();
  const progressPercent =
    activeAchievements.length > 0
      ? Math.round((unlockedAchievements.length / activeAchievements.length) * 100)
      : 0;

  return (
    <Card
      className="relative mt-3 overflow-hidden rounded-lg border-border bg-card"
      data-testid="card-achievements"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <Trophy className="h-3.5 w-3.5" />
              Achievements
            </p>
            <h2 className="mt-1 text-lg font-bold text-foreground">
              {unlockedAchievements.length}/{activeAchievements.length} unlocked
            </h2>
          </div>
          <div className="rounded-lg border border-primary/35 bg-primary/15 px-3 py-2 text-right">
            <p className="text-xs font-bold text-primary">{progressPercent}%</p>
          </div>
        </div>
        <Progress value={progressPercent} className="mt-3 h-2 bg-background" />

        <div className="mt-4 space-y-2">
          {latestUnlocked.length > 0 ? (
            latestUnlocked.map((achievement) => (
              <div
                key={achievement.key}
                className="rounded-lg border border-border bg-muted px-3 py-2"
                data-testid="item-achievement-unlocked"
              >
                <p className="text-sm font-semibold text-foreground">
                  {achievement.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {achievement.description}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-border bg-muted px-3 py-3">
              <p className="text-sm font-semibold text-foreground">
                First Quest is waiting
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Answer one question to unlock your first achievement.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileAccountWithAuth() {
  const { syncRankedIdentity } = useAppState();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [rankTiers, setRankTiers] = useState<RankTierThreshold[]>([]);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState("");
  const email = user?.primaryEmailAddress?.emailAddress;
  const clerkFallbackName =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "ReadTok learner";
  const displayName = profile?.display_name || clerkFallbackName;
  const shouldPromptDisplayName = isSignedIn && !isProfileLoading && profile && !profile.display_name;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setProfile(null);
      setProgress(null);
      setRankTiers([]);
      setPendingName("");
      setNameError(null);
      setIsProfileLoading(false);
      return;
    }

    let cancelled = false;
    setIsProfileLoading(true);
    setNameError(null);

    const fallbackEmail = user?.primaryEmailAddress?.emailAddress;
    const fallbackName = user?.fullName ?? null;

    async function loadProfile() {
      try {
        let result = await fetchMyProfile();
        if (!result.profile) {
          result = await bootstrapMyProfile({
            email: fallbackEmail,
            displayName: fallbackName,
          });
        }

        if (cancelled) {
          return;
        }

        setProfile(result.profile);
        setProgress(result.progress);
        setRankTiers(result.rank_tiers ?? []);
        syncRankedIdentity(result.progress, result.rank_tiers);
        if (result.profile?.display_name) {
          setPendingName(result.profile.display_name);
        } else if (fallbackName) {
          setPendingName(fallbackName);
        } else {
          setPendingName("");
        }
      } catch (error) {
        if (!cancelled) {
          setNameError(error instanceof Error ? error.message : "Could not load profile");
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user?.id, user?.fullName, user?.primaryEmailAddress?.emailAddress]);

  const normalizedPendingName = useMemo(() => pendingName.trim(), [pendingName]);
  const sortedTiers = useMemo(() => {
    return normalizeRankTiers(rankTiers.length > 0 ? rankTiers : DEFAULT_RANK_TIERS);
  }, [rankTiers]);
  const tierProgress = useMemo(() => {
    if (!progress) {
      return null;
    }

    const points = Math.max(0, progress.ranked_points);
    let currentTier = sortedTiers[0];
    let nextTier: RankTierThreshold | null = null;

    for (let index = 0; index < sortedTiers.length; index += 1) {
      const tier = sortedTiers[index];
      if (points >= tier.min_points) {
        currentTier = tier;
        nextTier = sortedTiers[index + 1] ?? null;
        continue;
      }
      break;
    }

    if (!nextTier) {
      return {
        currentTier,
        nextTier: null,
        progressPercent: 100,
        pointsNeededForNextTier: 0,
      };
    }

    const span = Math.max(1, nextTier.min_points - currentTier.min_points);
    const pointsIntoCurrentTier = Math.max(0, points - currentTier.min_points);
    const pointsNeededForNextTier = Math.max(0, nextTier.min_points - points);
    const progressPercent = Math.max(
      0,
      Math.min(100, Math.round((pointsIntoCurrentTier / span) * 100)),
    );

    return {
      currentTier,
      nextTier,
      progressPercent,
      pointsNeededForNextTier,
    };
  }, [progress, sortedTiers]);
  const rankPlate = useMemo(() => {
    if (!progress) {
      return null;
    }
    return getRankPlateData(progress.ranked_points, sortedTiers, progress.current_rank);
  }, [progress, sortedTiers]);

  async function saveDisplayName() {
    if (!isSignedIn) {
      return;
    }
    if (normalizedPendingName.length < 2) {
      setNameError("Display name must be at least 2 characters.");
      return;
    }
    if (normalizedPendingName.length > 40) {
      setNameError("Display name must be at most 40 characters.");
      return;
    }

    setIsSavingName(true);
    setNameError(null);
    try {
      const result = await updateMyProfile({
        displayName: normalizedPendingName,
        onboardingCompleted: true,
      });
      setProfile(result.profile);
      setProgress(result.progress);
      setRankTiers(result.rank_tiers ?? []);
      syncRankedIdentity(result.progress, result.rank_tiers);
      setPendingName(result.profile?.display_name ?? normalizedPendingName);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : "Could not save display name");
    } finally {
      setIsSavingName(false);
    }
  }

  if (!isLoaded) {
    return (
      <Card className="relative mb-4 overflow-hidden rounded-lg border-border bg-card" data-testid="card-account">
        <CardContent className="p-4">
          <div className="h-24 animate-pulse rounded-lg bg-muted" data-testid="account-loading" />
        </CardContent>
      </Card>
    );
  }

  if (isSignedIn) {
    return (
      <Card className="relative mb-4 overflow-hidden rounded-lg border-border bg-card" data-testid="card-account">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={displayName}
                  className="h-14 w-14 rounded-lg border border-primary/40 object-cover"
                  data-testid="img-user-avatar"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-primary/40 bg-primary/15">
                  <UserRound className="h-7 w-7 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Signed in
                </p>
                <h2 className="text-xl font-bold text-foreground truncate" data-testid="text-user-name">
                  {displayName}
                </h2>
                {email && (
                  <p className="text-sm text-muted-foreground truncate" data-testid="text-user-email">
                    {email}
                  </p>
                )}
              </div>
            </div>
            {shouldPromptDisplayName && (
              <div className="space-y-2 rounded-lg border border-border bg-muted p-3">
                <p className="text-sm font-medium text-foreground">Choose a display name</p>
                <p className="text-xs text-muted-foreground">
                  This is optional, but it helps personalize your profile.
                </p>
                <div className="flex gap-2">
                  <input
                    value={pendingName}
                    onChange={(event) => setPendingName(event.target.value)}
                    placeholder="Your display name"
                    className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                    maxLength={40}
                    data-testid="input-profile-display-name"
                  />
                  <Button
                    className="shrink-0"
                    disabled={isSavingName}
                    onClick={saveDisplayName}
                    data-testid="button-save-display-name"
                  >
                    {isSavingName ? "Saving..." : "Save"}
                  </Button>
                </div>
                {nameError && (
                  <p className="text-xs text-destructive" data-testid="text-display-name-error">
                    {nameError}
                  </p>
                )}
              </div>
            )}
            {isProfileLoading && (
              <p className="text-xs text-muted-foreground" data-testid="text-profile-loading">
                Loading profile...
              </p>
            )}
            {!shouldPromptDisplayName && nameError && (
              <p className="text-xs text-destructive" data-testid="text-profile-error">
                {nameError}
              </p>
            )}
            <Button
              variant="outline"
              className="w-full border-border bg-muted hover:bg-muted/80"
              onClick={() => signOut({ redirectUrl: `${import.meta.env.BASE_URL}profile` })}
              data-testid="button-sign-out"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>

            {progress && (
              <div
                className="space-y-2 rounded-lg border border-border bg-muted p-3"
                data-testid="card-ranked-progress"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-primary font-bold flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5" />
                  Ranked
                </p>
                {rankPlate && <RankPlate plate={rankPlate} variant="full" />}
                <p className="text-xs text-muted-foreground" data-testid="text-lifetime-xp">
                  Lifetime XP: {progress.lifetime_xp}
                </p>
                {tierProgress && (
                  <div className="space-y-1.5">
                    <Progress
                      value={tierProgress.progressPercent}
                      className="h-2 bg-background"
                    />
                    <p className="text-xs text-muted-foreground" data-testid="text-next-rank-progress">
                      {tierProgress.nextTier
                        ? `${tierProgress.pointsNeededForNextTier} RP to ${tierProgress.nextTier.label}`
                        : "Top rank reached"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative mb-4 overflow-hidden rounded-lg border-border bg-card" data-testid="card-account">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold mb-2">Account</p>
            <h2 className="text-xl font-bold text-foreground">Save your learning identity</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in or create an account to attach your ReadTok profile to you.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button asChild className="bg-primary text-primary-foreground" data-testid="button-profile-sign-in">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="border-border bg-muted hover:bg-muted/80" data-testid="button-profile-sign-up">
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoggedOutProfileActions() {
  return (
    <Card className="relative mb-4 overflow-hidden rounded-lg border-border bg-card" data-testid="card-account">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold mb-2">Account</p>
            <h2 className="text-xl font-bold text-foreground">Save your learning identity</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in or create an account to attach your ReadTok profile to you.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button asChild className="bg-primary text-primary-foreground" data-testid="button-profile-sign-in">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="border-border bg-muted hover:bg-muted/80" data-testid="button-profile-sign-up">
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileAccountWithoutAuth() {
  return (
    <Card className="relative mb-4 overflow-hidden rounded-lg border-border bg-card" data-testid="card-account-local">
      <CardContent className="p-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Local Mode</p>
          <h2 className="text-xl font-bold text-foreground">Your reading progress is stored on this device</h2>
          <p className="text-sm text-muted-foreground">
            Add Clerk keys later if you want cross-device accounts. Feed progress, saves, and stats already work without auth.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileWithAuthGate() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="tablet-portrait-profile h-full w-full overflow-y-auto p-4 pt-10" data-testid="page-profile-loading">
        <AppPageHeader title="Your Stats" />
        <Card className="relative mb-3 overflow-hidden rounded-lg border-border bg-card" data-testid="card-account-loading">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold mb-2">Account</p>
            <div className="h-12 animate-pulse rounded-lg bg-muted" />
          </CardContent>
        </Card>
        <LoggedOutProfileActions />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="tablet-portrait-profile h-full w-full overflow-y-auto p-4 pt-10" data-testid="page-profile-logged-out">
        <AppPageHeader title="Your Stats" />
        <LoggedOutProfileActions />
      </div>
    );
  }

  return (
    <div className="tablet-portrait-profile h-full w-full overflow-y-auto p-4 pt-10" data-testid="page-profile">
      <AppPageHeader title="Your Stats" />

      <ProfileAccountWithAuth />
      <ProfileStats source="synced" />
      <ProfileLeaderboardEntry />
      <ProfileWeakAreas />
      <ProfileFeedbackSettings />
      <ProfileAchievements />

      <div className="mt-12 text-center">
        <p className="text-xs text-muted-foreground opacity-50">ReadTok v1.0.0</p>
      </div>
    </div>
  );
}

export default function Profile() {
  if (authEnabled) {
    return <ProfileWithAuthGate />;
  }

  return (
    <div className="tablet-portrait-profile h-full w-full overflow-y-auto p-4 pt-10" data-testid="page-profile">
      <AppPageHeader title="Your Stats" />

      <ProfileAccountWithoutAuth />

      <ProfileStats />
      <ProfileLeaderboardEntry />
      <ProfileFeedbackSettings />
      <ProfileAchievements />
      
      <div className="mt-12 text-center">
        <p className="text-xs text-muted-foreground opacity-50">ReadTok v1.0.0</p>
      </div>
    </div>
  );
}
