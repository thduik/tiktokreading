import { useEffect, useRef, useState } from "react";
import { SignIn, SignUp, ClerkProvider, useUser } from "@clerk/react";
import { Switch, Route, Router as WouterRouter, useLocation, useRoute } from "wouter";
import { Target, TrendingUp, Zap } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Saved from "@/pages/saved";
import Profile from "@/pages/profile";
import PassageDetailPage from "@/pages/passage-detail";
import BottomNav from "@/components/bottom-nav";
import Onboarding from "@/components/onboarding";
import { AppStateProvider, useAppState } from "@/hooks/use-app-state";
import { fetchPassageList } from "@/lib/passages-api";
import { bootstrapMyProfile } from "@/lib/profile-api";
import { authEnabled, clerkProxyUrl, clerkPublishableKey } from "@/lib/runtime-config";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const pendingDisplayNameStorageKey = "readtok_pending_display_name";
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
        await bootstrapMyProfile({
          email: currentUser.primaryEmailAddress?.emailAddress,
          displayName: pendingDisplayName,
        });
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

interface RouterProps {
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
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

function Router({ hasCompletedOnboarding, completeOnboarding }: RouterProps) {
  const [location, setLocation] = useLocation();
  const [isLaunchingFromOnboarding, setIsLaunchingFromOnboarding] = useState(false);
  const isFeed = location === "/";
  const isList = location === "/list";
  const isPassage = location.startsWith("/passages/");
  const isFeedExperience = isFeed || isPassage;
  const isAuthPage = location.startsWith("/sign-in") || location.startsWith("/sign-up");
  const isOnboarding = isFeed && !hasCompletedOnboarding;

  async function completeOnboardingAndOpenRandomPassage() {
    if (isLaunchingFromOnboarding) {
      return;
    }

    setIsLaunchingFromOnboarding(true);
    let nextPath = "/";
    try {
      const response = await fetchPassageList({
        status: "active",
        limit: 500,
        offset: 0,
      });
      if (response.items.length > 0) {
        const randomIndex = Math.floor(Math.random() * response.items.length);
        const randomPassage = response.items[randomIndex];
        if (randomPassage) {
          nextPath = `/?start=${encodeURIComponent(randomPassage.id)}`;
        }
      }
    } catch {
      nextPath = "/";
    } finally {
      completeOnboarding();
      setLocation(nextPath);
      setIsLaunchingFromOnboarding(false);
    }
  }

  if (isOnboarding) {
    return <Onboarding onComplete={completeOnboardingAndOpenRandomPassage} />;
  }

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      {authEnabled && <AuthProfileBootstrapper />}
      <main
        className={`min-h-0 flex-1 w-full ${
          isFeedExperience ? "overflow-hidden" : "overflow-y-auto"
        } ${isFeedExperience || isList || isAuthPage ? "" : "pb-[60px]"}`}
      >
        <Switch>
          <Route path="/" component={PassageDetailPage} />
          <Route path="/list" component={Home} />
          <Route path="/passages/:id" component={LegacyPassageRouteRedirect} />
          <Route path="/saved" component={Saved} />
          <Route path="/profile" component={Profile} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      {!isAuthPage && <BottomNav />}
    </div>
  );
}

interface ClerkProviderWithRoutesProps {
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
}

function ClerkProviderWithRoutes({
  hasCompletedOnboarding,
  completeOnboarding,
}: ClerkProviderWithRoutesProps) {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      proxyUrl={clerkProxyUrl || undefined}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <TooltipProvider>
        <Router
          hasCompletedOnboarding={hasCompletedOnboarding}
          completeOnboarding={completeOnboarding}
        />
        <Toaster />
      </TooltipProvider>
    </ClerkProvider>
  );
}

function AppRoutes({
  hasCompletedOnboarding,
  completeOnboarding,
}: ClerkProviderWithRoutesProps) {
  return (
    <TooltipProvider>
      <Router
        hasCompletedOnboarding={hasCompletedOnboarding}
        completeOnboarding={completeOnboarding}
      />
      <Toaster />
    </TooltipProvider>
  );
}

function SessionSummaryDialog() {
  const { pendingSessionSummary, dismissSessionSummary } = useAppState();

  if (!pendingSessionSummary) {
    return null;
  }

  const lpLabel = `${pendingSessionSummary.lpDeltaTotal >= 0 ? "+" : ""}${pendingSessionSummary.lpDeltaTotal}`;
  const xpLabel = `+${Math.max(0, pendingSessionSummary.xpDeltaTotal)}`;

  return (
    <Dialog
      open={Boolean(pendingSessionSummary)}
      onOpenChange={(open) => {
        if (!open) {
          dismissSessionSummary();
        }
      }}
    >
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm rounded-lg border border-border bg-card p-5 text-foreground">
        <div className="space-y-4 pr-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              10-Question Checkpoint
            </p>
            <DialogTitle className="mt-1 text-2xl font-semibold leading-tight text-foreground">
              Nice session.
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {pendingSessionSummary.correct} correct / {pendingSessionSummary.answered} answered.
            </DialogDescription>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-muted px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                Accuracy
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {pendingSessionSummary.accuracyPercent}%
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                LP
              </p>
              <p
                className={`mt-2 text-lg font-semibold ${
                  pendingSessionSummary.lpDeltaTotal >= 0
                    ? "text-primary"
                    : "text-destructive"
                }`}
              >
                {lpLabel}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                XP
              </p>
              <p className="mt-2 text-lg font-semibold text-secondary">{xpLabel}</p>
            </div>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-muted-foreground">
            Keep stacking clean sets. Every 10 answers gives you another checkpoint.
          </div>

          <Button className="w-full" onClick={dismissSessionSummary}>
            Keep going
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AppContent() {
  const { isLoaded, hasCompletedOnboarding, completeOnboarding } = useAppState();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const unregisterServiceWorkers = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }
      } catch (err) {
        console.error("ServiceWorker cleanup failed: ", err);
      }
    };

    void unregisterServiceWorkers();
  }, []);

  if (!isLoaded) {
    return <div className="h-[100dvh] bg-background flex items-center justify-center" />;
  }

  return (
    <WouterRouter base={basePath}>
      {authEnabled ? (
        <ClerkProviderWithRoutes
          hasCompletedOnboarding={hasCompletedOnboarding}
          completeOnboarding={completeOnboarding}
        />
      ) : (
        <AppRoutes
          hasCompletedOnboarding={hasCompletedOnboarding}
          completeOnboarding={completeOnboarding}
        />
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
