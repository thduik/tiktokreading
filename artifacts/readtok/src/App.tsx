import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { SignIn, SignUp, ClerkProvider, useUser } from "@clerk/react";
import { Switch, Route, Router as WouterRouter, useLocation, useRoute } from "wouter";
import { Award, Swords, Target, TrendingUp, Zap } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import PassageDetailPage from "@/pages/passage-detail";
import BottomNav from "@/components/bottom-nav";
import {
  GenericPageSkeleton,
  LeaderboardPageSkeleton,
  PassageListPageSkeleton,
  ProfilePageSkeleton,
  SavedPageSkeleton,
} from "@/components/page-skeletons";
import { AppStateProvider, useAppState } from "@/hooks/use-app-state";
import {
  bootstrapMyProfile,
  fetchMyProfile,
  fetchMyAchievements,
  syncMyAchievements,
} from "@/lib/profile-api";
import { setActiveApiCacheUserScope } from "@/lib/api-cache";
import { buildAchievementUnlockSyncPayload } from "@/lib/achievements";
import {
  QUESTION_TYPE_DISPLAY_LABELS,
  SESSION_STREAK_BONUS_STREAK,
  SESSION_STREAK_BONUS_LP,
  SESSION_SUMMARY_INTERVAL,
} from "@/lib/practice-tracking";
import {
  authConfigMissingOnHostedApp,
  authEnabled,
  clerkProxyUrl,
  clerkPublishableKey,
  runtimeHostname,
} from "@/lib/runtime-config";

const Home = lazy(() => import("@/pages/home"));
const Saved = lazy(() => import("@/pages/saved"));
const Profile = lazy(() => import("@/pages/profile"));
const AchievementsPage = lazy(() => import("@/pages/achievements"));
const AdminPage = lazy(() => import("@/pages/admin"));
const LeaderboardPage = lazy(() => import("@/pages/leaderboard"));
const NotFound = lazy(() => import("@/pages/not-found"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const pendingDisplayNameStorageKey = "readtok_pending_display_name";
const sessionStreakDismissedStorageKey = "readtok_session_streak_dismissed_v1";
const forcedReloadVersionStorageKey = "readtok_forced_reload_version_v1";
const serviceWorkerCleanupReloadStorageKey = "readtok_service_worker_cleanup_reloaded_v1";
const authAppearance = {
  theme: "simple",
  variables: {
    colorPrimary: "#bac3ff",
    colorBackground: "#131313",
    colorText: "#e5e2e1",
    colorTextSecondary: "#c5c5d5",
    colorInputBackground: "#201f1f",
    colorInputText: "#e5e2e1",
    borderRadius: "0.5rem",
  },
  options: {
    socialButtonsVariant: "blockButton" as const,
  },
  layout: {
    socialButtonsVariant: "blockButton" as const,
  },
  elements: {
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    cardBox: {
      boxShadow: "none",
    },
    card: {
      backgroundColor: "#1c1b1b",
      border: "1px solid #454653",
      boxShadow: "none",
      color: "#e5e2e1",
    },
    footer: {
      backgroundColor: "#1c1b1b",
      borderColor: "#454653",
    },
    footerActionText: "text-muted-foreground",
    footerActionLink: "text-primary hover:text-primary/90",
    formFieldLabel: {
      color: "#e5e2e1",
    },
    formFieldInput: {
      backgroundColor: "#201f1f",
      color: "#e5e2e1",
      borderColor: "#454653",
    },
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground",
    socialButtonsBlockButton: {
      backgroundColor: "#e5e2e1",
      color: "#131313",
      border: "1px solid #8f8f9f",
      boxShadow: "none",
    },
    socialButtonsIconButton: {
      backgroundColor: "#e5e2e1",
      color: "#131313",
      border: "1px solid #8f8f9f",
      boxShadow: "none",
    },
    socialButtonsBlockButtonText: {
      color: "#131313",
      fontWeight: "600",
    },
    socialButtonsProviderIcon: {
      opacity: "1",
    },
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90",
  },
};

const buildUpdateCheckIntervalMs = 60 * 1000;

type AppVersionManifest = {
  version: string;
  buildTime?: string;
  gitSha?: string;
  bundle?: string | null;
};

function normalizeAppVersion(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function forceReloadToAppVersion(version: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedVersion = normalizeAppVersion(version);
  if (!normalizedVersion) {
    window.location.reload();
    return;
  }

  try {
    const previousAttempt =
      window.sessionStorage.getItem(forcedReloadVersionStorageKey) ?? "";
    if (previousAttempt === normalizedVersion) {
      return;
    }

    window.sessionStorage.setItem(forcedReloadVersionStorageKey, normalizedVersion);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("appVersion", normalizedVersion);
    window.location.replace(nextUrl.toString());
  } catch {
    window.location.reload();
  }
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function persistPendingDisplayName(value: string) {
  const normalized = value.trim();
  if (normalized.length > 0) {
    window.sessionStorage.setItem(pendingDisplayNameStorageKey, normalized);
    return;
  }
  window.sessionStorage.removeItem(pendingDisplayNameStorageKey);
}

function readPendingDisplayName() {
  const value = window.sessionStorage.getItem(pendingDisplayNameStorageKey);
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function clearPendingDisplayName() {
  window.sessionStorage.removeItem(pendingDisplayNameStorageKey);
}

function SignInPage() {
  if (!authEnabled) {
    return (
      <div className="min-h-[100dvh] w-full bg-background px-4 py-10 flex items-start justify-center">
        <div className="w-full max-w-[400px] rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">Authentication is optional in local mode</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Add `VITE_CLERK_PUBLISHABLE_KEY` if you want sign-in enabled outside Replit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background px-4 py-10 flex items-start justify-center" data-testid="page-sign-in">
      <div className="w-full max-w-[400px] space-y-5">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-primary font-bold mb-2">ReadTok Account</p>
          <h1 className="text-3xl font-bold text-foreground">Sign in to ReadTok</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Keep your IELTS practice identity connected to your profile.
          </p>
        </div>
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={`${basePath}/profile`}
          appearance={authAppearance}
        />
      </div>
    </div>
  );
}

function SignUpPage() {
  const [pendingDisplayName, setPendingDisplayName] = useState("");

  if (!authEnabled) {
    return (
      <div className="min-h-[100dvh] w-full bg-background px-4 py-10 flex items-start justify-center">
        <div className="w-full max-w-[400px] rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">Authentication is optional in local mode</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Add `VITE_CLERK_PUBLISHABLE_KEY` if you want account creation enabled outside Replit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background px-4 py-10 flex items-start justify-center" data-testid="page-sign-up">
      <div className="w-full max-w-[400px] space-y-5">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-primary font-bold mb-2">ReadTok Account</p>
          <h1 className="text-3xl font-bold text-foreground">Create your profile</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Start a personal IELTS practice profile in seconds.
          </p>
        </div>
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="display-name-optional"
          >
            Display name (optional)
          </label>
          <input
            id="display-name-optional"
            type="text"
            value={pendingDisplayName}
            onChange={(event) => {
              const nextValue = event.target.value;
              setPendingDisplayName(nextValue);
              persistPendingDisplayName(nextValue);
            }}
            placeholder="What should we call you?"
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground"
            data-testid="input-signup-display-name"
          />
          <p className="text-xs text-muted-foreground">
            We will save this after your account is created.
          </p>
        </div>
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          fallbackRedirectUrl={`${basePath}/profile`}
          appearance={authAppearance}
        />
      </div>
    </div>
  );
}

function AuthProfileBootstrapper() {
  const { isLoaded, isSignedIn, user } = useUser();
  const bootstrappedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    setActiveApiCacheUserScope(isSignedIn && user ? user.id : null);
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      return;
    }

    const currentUser = user;

    if (bootstrappedUserIdRef.current === currentUser.id) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        const pendingDisplayName = readPendingDisplayName();
        const existingProfile = await fetchMyProfile();
        if (!existingProfile.profile) {
          await bootstrapMyProfile({
            email: currentUser.primaryEmailAddress?.emailAddress,
            displayName: pendingDisplayName,
          });
        }
        if (pendingDisplayName) {
          clearPendingDisplayName();
        }
        if (!cancelled) {
          bootstrappedUserIdRef.current = currentUser.id;
        }
      } catch (error) {
        console.error("Profile bootstrap failed", error);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user]);

  return null;
}

function LegacyPassageRouteRedirect() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/passages/:id");
  const legacyPassageId = params?.id ?? "";

  useEffect(() => {
    if (!legacyPassageId) {
      setLocation("/", { replace: true });
      return;
    }
    const nextPath = `/?start=${encodeURIComponent(legacyPassageId)}`;
    setLocation(nextPath, { replace: true });
  }, [legacyPassageId, setLocation]);

  return null;
}

function AchievementSyncBridge() {
  const { isLoaded, isSignedIn } = useUser();
  const { stats, mergeSyncedAchievements } = useAppState();
  const hasHydratedRef = useRef(false);
  const syncSignatureRef = useRef("");
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      hasHydratedRef.current = false;
      syncSignatureRef.current = "";
      syncInFlightRef.current = false;
      return;
    }

    let cancelled = false;
    async function hydrateFromServer() {
      try {
        const payload = await fetchMyAchievements();
        if (cancelled) {
          return;
        }
        mergeSyncedAchievements({
          unlockedKeys: payload.unlocked_keys ?? [],
          levelProgress: payload.summary
            ? {
                totalXp: payload.summary.total_xp,
                currentLevel: payload.summary.current_level,
                currentLevelXpFloor: payload.summary.current_level_xp_floor,
                nextLevelXpFloor: payload.summary.next_level_xp_floor,
                xpIntoLevel: payload.summary.xp_into_level,
                xpNeededForNextLevel: payload.summary.xp_needed_for_next_level,
                progressPercent: payload.summary.progress_percent,
              }
            : null,
        });
        hasHydratedRef.current = true;
      } catch (error) {
        console.error("Achievement hydration failed", error);
      }
    }

    void hydrateFromServer();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, mergeSyncedAchievements]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !hasHydratedRef.current || syncInFlightRef.current) {
      return;
    }
    const unlockedKeys = stats.achievementProgress.unlockedAchievementKeys ?? [];
    if (unlockedKeys.length === 0) {
      return;
    }

    const unlocks = buildAchievementUnlockSyncPayload(unlockedKeys);
    const signature = unlocks
      .map((item) => `${item.key}:${item.xp}`)
      .sort()
      .join("|");

    if (!signature || signature === syncSignatureRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    let cancelled = false;

    async function syncToServer() {
      try {
        const response = await syncMyAchievements({ unlocks });
        if (cancelled) {
          return;
        }
        mergeSyncedAchievements({
          unlockedKeys: response.unlocked_keys ?? [],
          levelProgress: response.summary
            ? {
                totalXp: response.summary.total_xp,
                currentLevel: response.summary.current_level,
                currentLevelXpFloor: response.summary.current_level_xp_floor,
                nextLevelXpFloor: response.summary.next_level_xp_floor,
                xpIntoLevel: response.summary.xp_into_level,
                xpNeededForNextLevel: response.summary.xp_needed_for_next_level,
                progressPercent: response.summary.progress_percent,
              }
            : null,
        });
        syncSignatureRef.current = signature;
      } catch (error) {
        console.error("Achievement sync failed", error);
      } finally {
        syncInFlightRef.current = false;
      }
    }

    void syncToServer();
    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    isSignedIn,
    mergeSyncedAchievements,
    stats.achievementProgress.unlockedAchievementKeys,
  ]);

  return null;
}

function Router() {
  const [location] = useLocation();
  const isFeed = location === "/";
  const isList = location === "/list";
  const isPassage = location.startsWith("/passages/");
  const isFeedExperience = isFeed || isPassage;
  const isAuthPage = location.startsWith("/sign-in") || location.startsWith("/sign-up");
  const isAdminPage = location.startsWith("/admin");

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      {authEnabled && <AuthProfileBootstrapper />}
      {authEnabled && <AchievementSyncBridge />}
      <main
        className={`min-h-0 flex-1 w-full ${
          isFeedExperience ? "overflow-hidden" : "overflow-y-auto"
        } ${isFeedExperience || isList || isAuthPage || isAdminPage ? "" : "pb-[60px]"}`}
      >
        <Suspense fallback={<RouteLoadingFallback location={location} />}>
          <Switch>
            <Route path="/" component={PassageDetailPage} />
            <Route path="/list" component={Home} />
            <Route path="/passages/:id" component={LegacyPassageRouteRedirect} />
            <Route path="/saved" component={Saved} />
            <Route path="/profile" component={Profile} />
            <Route path="/achievements" component={AchievementsPage} />
            <Route path="/leaderboard" component={LeaderboardPage} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
      {!isAuthPage && !isAdminPage && <BottomNav />}
    </div>
  );
}

function RouteLoadingFallback({ location }: { location: string }) {
  if (location === "/list") {
    return <PassageListPageSkeleton />;
  }

  if (location === "/saved") {
    return <SavedPageSkeleton />;
  }

  if (location === "/profile") {
    return <ProfilePageSkeleton />;
  }

  if (location === "/leaderboard") {
    return <LeaderboardPageSkeleton />;
  }

  return <GenericPageSkeleton />;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      proxyUrl={clerkProxyUrl || undefined}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </ClerkProvider>
  );
}

function AppRoutes() {
  return (
    <TooltipProvider>
      <Router />
      <Toaster />
    </TooltipProvider>
  );
}

function SessionSummaryDialog() {
  const { pendingSessionSummary, dismissSessionSummary } = useAppState();
  const [dismissedStreakMilestones, setDismissedStreakMilestones] = useState<number[]>(
    () => {
      if (typeof window === "undefined") {
        return [];
      }
      try {
        const parsed = JSON.parse(
          window.sessionStorage.getItem(sessionStreakDismissedStorageKey) ?? "[]",
        ) as unknown;
        if (!Array.isArray(parsed)) {
          return [];
        }
        return parsed
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0);
      } catch {
        return [];
      }
    },
  );

  if (!pendingSessionSummary) {
    return null;
  }

  const streakMilestone =
    pendingSessionSummary.bestStreak >= 20
      ? 20
      : pendingSessionSummary.bestStreak >= 10
        ? 10
        : null;
  const isDismissedMilestone =
    streakMilestone !== null && dismissedStreakMilestones.includes(streakMilestone);
  useEffect(() => {
    if (isDismissedMilestone) {
      dismissSessionSummary();
    }
  }, [dismissSessionSummary, isDismissedMilestone]);

  if (isDismissedMilestone) {
    return null;
  }

  const lpLabel = `${pendingSessionSummary.lpDeltaTotal >= 0 ? "+" : ""}${pendingSessionSummary.lpDeltaTotal}`;
  const xpLabel = `+${Math.max(0, pendingSessionSummary.xpDeltaTotal)}`;
  const bestTypeLabel = pendingSessionSummary.bestType
    ? QUESTION_TYPE_DISPLAY_LABELS[pendingSessionSummary.bestType]
    : "None yet";
  const weakTypeLabel = pendingSessionSummary.weakType
    ? QUESTION_TYPE_DISPLAY_LABELS[pendingSessionSummary.weakType]
    : "None yet";
  const streakBonusLabel =
    pendingSessionSummary.lpBonusTotal > 0
      ? `+${pendingSessionSummary.lpBonusTotal}`
      : "+0";

  function dismissNotification() {
    if (streakMilestone !== null) {
      const next = Array.from(new Set([...dismissedStreakMilestones, streakMilestone]));
      setDismissedStreakMilestones(next);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          sessionStreakDismissedStorageKey,
          JSON.stringify(next),
        );
      }
    }
    dismissSessionSummary();
  }

  return (
    <div className="pointer-events-none fixed bottom-[74px] left-1/2 z-50 w-[min(94vw,440px)] -translate-x-1/2">
      <div className="pointer-events-auto rounded-lg border border-border bg-card/95 p-4 text-foreground shadow-xl backdrop-blur">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {SESSION_SUMMARY_INTERVAL}-Question Checkpoint
              </p>
              <p className="mt-1 text-lg font-semibold leading-tight text-foreground">
                Nice session.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pendingSessionSummary.correct} correct / {pendingSessionSummary.answered} answered.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={dismissNotification}>
              Close
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                Accuracy
              </p>
              <p className="mt-1.5 text-lg font-semibold text-foreground">
                {pendingSessionSummary.accuracyPercent}%
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Ranked LP
              </p>
              <p
                className={`mt-1.5 text-lg font-semibold ${
                  pendingSessionSummary.lpDeltaTotal >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {lpLabel}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                XP
              </p>
              <p className="mt-1.5 text-lg font-semibold text-secondary">{xpLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <Award className="h-3.5 w-3.5" />
                Best Type
              </p>
              <p className="mt-1.5 text-sm font-semibold text-foreground">{bestTypeLabel}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <Swords className="h-3.5 w-3.5" />
                Weak Type
              </p>
              <p className="mt-1.5 text-sm font-semibold text-foreground">{weakTypeLabel}</p>
            </div>
          </div>

          {pendingSessionSummary.lpBonusTotal > 0 ? (
            <div className="rounded-lg border border-secondary/35 bg-secondary/12 px-3 py-2.5 text-sm">
              <p className="font-semibold text-foreground">
                {pendingSessionSummary.bestStreak}-answer streak
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Bonus LP earned:{" "}
                <span className="font-semibold text-secondary">{streakBonusLabel}</span>
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm">
              <p className="font-semibold text-foreground">
                Best streak: {pendingSessionSummary.bestStreak}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Hit {SESSION_STREAK_BONUS_LP} bonus LP by reaching a {SESSION_STREAK_BONUS_STREAK}-answer streak.
              </p>
            </div>
          )}

          {streakMilestone ? (
            <div className="rounded-lg border border-primary/35 bg-primary/12 px-3 py-2 text-xs font-semibold text-primary">
              {streakMilestone}-streak milestone card is session-only after you close it.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HostedAuthConfigError() {
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[440px] rounded-lg border border-destructive/40 bg-card p-5 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-destructive">
          Production auth config missing
        </p>
        <h1 className="mt-3 text-2xl font-bold text-foreground">
          ReadTok cannot start in local profile mode.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The live site did not receive its Clerk runtime config for{" "}
          <span className="font-semibold text-foreground">{runtimeHostname}</span>. This
          protects cross-device profile data from silently falling back to this device.
        </p>
        <Button className="mt-5 w-full" onClick={() => window.location.reload()}>
          Reload app
        </Button>
      </div>
    </div>
  );
}

function AppContent() {
  const { isLoaded } = useAppState();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const unregisterServiceWorkers = async () => {
      try {
        const hadController = Boolean(navigator.serviceWorker.controller);
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        let cacheNames: string[] = [];
        if ("caches" in window) {
          cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }

        const hadServiceWorkerState =
          hadController || registrations.length > 0 || cacheNames.length > 0;
        if (!hadServiceWorkerState) {
          return;
        }

        const alreadyReloaded =
          window.sessionStorage.getItem(serviceWorkerCleanupReloadStorageKey) === "1";
        if (alreadyReloaded) {
          return;
        }

        window.sessionStorage.setItem(serviceWorkerCleanupReloadStorageKey, "1");
        window.location.reload();
      } catch (err) {
        console.error("ServiceWorker cleanup failed: ", err);
      }
    };

    void unregisterServiceWorkers();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    let cancelled = false;
    let inFlight = false;
    const currentAppVersion = normalizeAppVersion(__READTOK_APP_VERSION__);

    const checkForNewAppVersion = async () => {
      if (cancelled || inFlight || document.visibilityState === "hidden") {
        return;
      }

      inFlight = true;
      try {
        const versionUrl = `${basePath || ""}/version.json?t=${Date.now()}`;
        const response = await fetch(versionUrl, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          return;
        }

        const manifest = (await response.json()) as Partial<AppVersionManifest>;
        const latestAppVersion = normalizeAppVersion(manifest.version);
        if (!latestAppVersion || latestAppVersion === currentAppVersion) {
          try {
            window.sessionStorage.removeItem(forcedReloadVersionStorageKey);
          } catch {
            // Ignore sessionStorage cleanup failures.
          }
          return;
        }

        forceReloadToAppVersion(latestAppVersion);
      } catch (error) {
        console.warn("App version update check failed", error);
      } finally {
        inFlight = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void checkForNewAppVersion();
    }, buildUpdateCheckIntervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkForNewAppVersion();
      }
    };

    const handleFocus = () => {
      void checkForNewAppVersion();
    };

    void checkForNewAppVersion();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  if (authConfigMissingOnHostedApp) {
    return <HostedAuthConfigError />;
  }

  if (!isLoaded) {
    return <div className="h-[100dvh] bg-background flex items-center justify-center" />;
  }

  return (
    <WouterRouter base={basePath}>
      {authEnabled ? (
        <ClerkProviderWithRoutes />
      ) : (
        <AppRoutes />
      )}
      <SessionSummaryDialog />
    </WouterRouter>
  );
}

function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}

export default App;
