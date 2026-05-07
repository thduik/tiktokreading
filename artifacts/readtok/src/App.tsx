import { useEffect, useRef, useState } from "react";
import { SignIn, SignUp, ClerkProvider, useUser } from "@clerk/react";
import { Switch, Route, Router as WouterRouter, useLocation, useRoute } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
    colorPrimary: "#2dd4bf",
    colorBackground: "#0b0f14",
    colorText: "#f8fafc",
    colorTextSecondary: "#94a3b8",
    colorInputBackground: "#f8fafc",
    colorInputText: "#0f172a",
    borderRadius: "0.9rem",
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
      backgroundColor: "#0f131a",
      border: "1px solid #1f2937",
      boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
      color: "#f8fafc",
    },
    footer: {
      backgroundColor: "#0f131a",
      borderColor: "#1f2937",
    },
    footerActionText: "text-muted-foreground",
    footerActionLink: "text-primary hover:text-primary/90",
    formFieldLabel: {
      color: "#e2e8f0",
    },
    formFieldInput: {
      backgroundColor: "#f8fafc",
      color: "#0f172a",
      borderColor: "#cbd5e1",
    },
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground",
    socialButtonsBlockButton: {
      backgroundColor: "#f8fafc",
      color: "#0f172a",
      border: "1px solid #cbd5e1",
      boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
    },
    socialButtonsIconButton: {
      backgroundColor: "#f8fafc",
      color: "#0f172a",
      border: "1px solid #cbd5e1",
      boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
    },
    socialButtonsBlockButtonText: {
      color: "#0f172a",
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
        <div className="w-full max-w-[400px] rounded-3xl border border-border bg-card p-6 text-center">
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
        <div className="w-full max-w-[400px] rounded-3xl border border-border bg-card p-6 text-center">
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
