import { useEffect, useRef } from "react";
import { SignIn, SignUp, ClerkProvider, useClerk } from "@clerk/react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Saved from "@/pages/saved";
import Profile from "@/pages/profile";
import BottomNav from "@/components/bottom-nav";
import Onboarding from "@/components/onboarding";
import { useAppState } from "@/hooks/use-app-state";

const queryClient = new QueryClient();
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
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
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
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
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

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
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
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden relative">
      <main className={`flex-1 w-full overflow-hidden ${isFeed || isAuthPage ? "" : "pb-[72px]"}`}>
        <Switch>
          <Route path="/" component={Home} />
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
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router
            hasCompletedOnboarding={hasCompletedOnboarding}
            completeOnboarding={completeOnboarding}
          />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  const { isLoaded, hasCompletedOnboarding, completeOnboarding } = useAppState();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.error('ServiceWorker registration failed: ', err);
        });
      });
    }
  }, []);

  if (!isLoaded) {
    return <div className="h-[100dvh] bg-background flex items-center justify-center" />;
  }

  if (!clerkPubKey) {
    return (
      <div className="h-[100dvh] bg-background text-foreground flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold mb-3">Authentication is still being prepared</h1>
          <p className="text-muted-foreground">Restart the app once setup finishes, then sign in from your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes
        hasCompletedOnboarding={hasCompletedOnboarding}
        completeOnboarding={completeOnboarding}
      />
    </WouterRouter>
  );
}

export default App;
