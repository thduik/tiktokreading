import { useAppState } from "@/hooks/use-app-state";
import { useUser, useClerk } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Target,
  TrendingUp,
  BookOpenCheck,
  Zap,
  LogOut,
  ShieldCheck,
  UserRound,
  Trophy,
} from "lucide-react";
import { RankPlate } from "@/components/rank-plate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch as Toggle } from "@/components/ui/switch";
import {
  DAILY_QUESTION_GOAL,
  formatLocalDayKey,
  getDailyGoalProgress,
} from "@/lib/daily-goal";
import { ACHIEVEMENTS } from "@/lib/achievements";
import {
  bootstrapMyProfile,
  fetchMyProfile,
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
  return Math.round((correct / attempted) * 100);
}

function ProfileStats() {
  const { stats } = useAppState();
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

  const lifetimeAccuracy = percent(stats.totalCorrect, stats.totalQuestionsCompleted);
  const last7Accuracy = percent(last7Correct, last7Attempted);
  const todayAccuracy = percent(todayStats.correct, todayStats.attempted);
  const dailyGoal = getDailyGoalProgress(todayStats.attempted, DAILY_QUESTION_GOAL);

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
            <span className="text-4xl font-bold text-foreground">{stats.streak}</span>
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          {stats.streak > 0 && (
            <p className="mt-2 text-xs font-medium text-secondary">Keep the line alive</p>
          )}
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
                {lifetimeAccuracy}% ({stats.totalCorrect}/{stats.totalQuestionsCompleted})
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Past 7 Days
              </p>
              <p className="text-sm font-semibold text-foreground">
                {last7Accuracy}% ({last7Correct}/{last7Attempted})
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Today
              </p>
              <p className="text-sm font-semibold text-foreground">
                {todayAccuracy}% ({todayStats.correct}/{todayStats.attempted})
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden rounded-lg border-border bg-card" data-testid="stat-questions-completed">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <BookOpenCheck className="w-16 h-16" />
        </div>
        <CardContent className="p-4 pt-6">
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Questions Completed</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-primary">{stats.totalQuestionsCompleted}</span>
            <span className="text-sm text-muted-foreground">questions</span>
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
        <LoggedOutProfileActions />
      </div>
    );
  }

  return (
    <div className="tablet-portrait-profile h-full w-full overflow-y-auto p-4 pt-10" data-testid="page-profile">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/40 bg-primary/15">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-profile-title">Your Stats</h1>
          <p className="text-sm text-muted-foreground">Keep up the momentum!</p>
        </div>
      </div>

      <ProfileAccountWithAuth />
      <ProfileStats />
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
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/40 bg-primary/15">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-profile-title">Your Stats</h1>
          <p className="text-sm text-muted-foreground">Keep up the momentum!</p>
        </div>
      </div>

      <ProfileAccountWithoutAuth />

      <ProfileStats />
      <ProfileFeedbackSettings />
      <ProfileAchievements />
      
      <div className="mt-12 text-center">
        <p className="text-xs text-muted-foreground opacity-50">ReadTok v1.0.0</p>
      </div>
    </div>
  );
}
