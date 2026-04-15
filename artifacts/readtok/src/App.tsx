import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Saved from "@/pages/saved";
import Profile from "@/pages/profile";
import BottomNav from "@/components/bottom-nav";
import Onboarding from "@/components/onboarding";
import { useAppState } from "@/hooks/use-app-state";
import { useEffect } from "react";

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  const isFeed = location === "/";

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden relative">
      <main className={`flex-1 w-full overflow-hidden ${isFeed ? "" : "pb-[72px]"}`}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/saved" component={Saved} />
          <Route path="/profile" component={Profile} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNav />
    </div>
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

  if (!hasCompletedOnboarding) {
    return <Onboarding onComplete={completeOnboarding} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
