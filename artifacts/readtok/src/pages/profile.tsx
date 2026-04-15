import { useAppState } from "@/hooks/use-app-state";
import { Target, TrendingUp, BookOpenCheck, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Profile() {
  const { stats } = useAppState();

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
