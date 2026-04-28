import { useEffect } from "react";
import { SignIn, SignUp, ClerkProvider } from "@clerk/react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
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

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const authAppearance = {
  variables: {
    colorPrimary: "#14d8c8",
    colorBackground: "#111111",
    colorText: "#f8fafc",
    colorTextSecondary: "#a1a1aa",
    colorInputBackground: "#171717",
    colorInputText: "#f8fafc",
    borderRadius: "0.9rem",
  },
  elements: {
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    cardBox: "shadow-none",
    card: "bg-card border border-border shadow-2xl",
    footer: "bg-card border-border",
    footerActionText: "text-muted-foreground",
    footerActionLink: "text-primary hover:text-primary/90",
    formFieldLabel: "text-foreground",
    formFieldInput:
      "bg-white text-zinc-950 border-white/20 placeholder:text-zinc-500",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground",
    socialButtonsBlockButton:
      "bg-white/5 border-border text-foreground hover:bg-white/10",
    socialButtonsBlockButtonText: "text-foreground",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90",
  },
};

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function SignInPage() {
  if (!clerkPubKey) {
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
  if (!clerkPubKey) {
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

interface RouterProps {
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
}

function Router({ hasCompletedOnboarding, completeOnboarding }: RouterProps) {
  const [location] = useLocation();
  const isFeed = location === "/";
  const isAuthPage = location.startsWith("/sign-in") || location.startsWith("/sign-up");
  const isOnboarding = isFeed && !hasCompletedOnboarding;

  if (isOnboarding) {
    return <Onboarding onComplete={completeOnboarding} />;
  }

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      <main className={`min-h-0 flex-1 w-full overflow-y-auto ${isFeed || isAuthPage ? "" : "pb-[72px]"}`}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/passages/:id" component={PassageDetailPage} />
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
      publishableKey={clerkPubKey}
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

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .catch((err) => {
          console.error("ServiceWorker registration failed: ", err);
        });
    };

    window.addEventListener("load", registerServiceWorker);
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  if (!isLoaded) {
    return <div className="h-[100dvh] bg-background flex items-center justify-center" />;
  }

  return (
    <WouterRouter base={basePath}>
      {clerkPubKey ? (
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
