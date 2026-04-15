import { useAppState } from "@/hooks/use-app-state";
import { useUser, useClerk } from "@clerk/react";
import { Link } from "wouter";
import { Target, TrendingUp, BookOpenCheck, Zap, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Profile() {
  const { stats } = useAppState();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const displayName =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "ReadTok learner";
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="h-full w-full overflow-y-auto p-4 pt-10" data-testid="page-profile">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-profile-title">Your Stats</h1>
          <p className="text-sm text-muted-foreground">Keep up the momentum!</p>
        </div>
      </div>

      <Card className="bg-card border-border overflow-hidden relative mb-4" data-testid="card-account">
        <CardContent className="p-4">
          {!isLoaded ? (
            <div className="h-24 animate-pulse rounded-2xl bg-white/5" data-testid="account-loading" />
          ) : isSignedIn ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={displayName}
                    className="h-14 w-14 rounded-2xl object-cover border border-primary/30"
                    data-testid="img-user-avatar"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <UserRound className="h-7 w-7 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold flex items-center gap-2">
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
              <Button
                variant="outline"
                className="w-full border-border bg-secondary/50"
                onClick={() => signOut({ redirectUrl: `${import.meta.env.BASE_URL}profile` })}
                data-testid="button-sign-out"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          ) : (
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
                <Button asChild variant="outline" className="border-border bg-secondary/50" data-testid="button-profile-sign-up">
                  <Link href="/sign-up">Sign up</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-card border-border overflow-hidden relative" data-testid="stat-streak">
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
              <p className="text-xs text-primary mt-2 font-medium">You're on fire!</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border overflow-hidden relative" data-testid="stat-accuracy">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Target className="w-12 h-12" />
          </div>
          <CardContent className="p-4 pt-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Accuracy</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">{stats.accuracy}</span>
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.correctAnswersTotal} / {stats.totalQuestionsAnswered} correct
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 bg-card border-border overflow-hidden relative" data-testid="stat-practiced">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <BookOpenCheck className="w-16 h-16" />
          </div>
          <CardContent className="p-4 pt-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Passages Completed</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-primary">{stats.totalPracticed}</span>
              <span className="text-sm text-muted-foreground">passages</span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-12 text-center">
        <p className="text-xs text-muted-foreground opacity-50">ReadTok v1.0.0</p>
      </div>
    </div>
  );
}
