import { useMemo } from "react";
import { Link } from "wouter";
import { ChevronLeft, Sparkles, Trophy } from "lucide-react";
import { AppPageHeader } from "@/components/app-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAppState } from "@/hooks/use-app-state";
import { ACHIEVEMENTS } from "@/lib/achievements";

function formatPhaseLabel(phase: "v1" | "v2") {
  return phase === "v2" ? "Phase 2" : "Phase 1";
}

export default function AchievementsPage() {
  const { stats } = useAppState();
  const unlockedKeySet = useMemo(
    () => new Set(stats.achievementProgress.unlockedAchievementKeys ?? []),
    [stats.achievementProgress.unlockedAchievementKeys],
  );
  const allAchievements = ACHIEVEMENTS;
  const unlockedCount = allAchievements.filter((achievement) =>
    unlockedKeySet.has(achievement.key),
  ).length;
  const completionPercent =
    allAchievements.length > 0
      ? Math.round((unlockedCount / allAchievements.length) * 100)
      : 0;
  const level = stats.achievementLevelProgress;

  const grouped = useMemo(() => {
    const familyMap = new Map<
      string,
      { family: string; phase: "v1" | "v2"; items: typeof ACHIEVEMENTS }
    >();

    for (const achievement of allAchievements) {
      const existing = familyMap.get(achievement.family);
      if (!existing) {
        familyMap.set(achievement.family, {
          family: achievement.family,
          phase: achievement.phase,
          items: [achievement],
        });
        continue;
      }
      existing.items.push(achievement);
      if (achievement.phase === "v2") {
        existing.phase = "v2";
      }
    }

    return [...familyMap.values()]
      .map((group) => {
        const orderedItems = [...group.items];
        const unlockedItems = orderedItems.filter((item) =>
          unlockedKeySet.has(item.key),
        );
        const firstLockedIndex = orderedItems.findIndex(
          (item) => !unlockedKeySet.has(item.key),
        );

        const previewItems = [...unlockedItems];

        if (orderedItems.length > 1 && firstLockedIndex >= 0) {
          const adjacentLocked = orderedItems[firstLockedIndex];
          if (adjacentLocked) {
            previewItems.push({
              ...adjacentLocked,
              title: "???",
            });
          }

          const secondLocked = orderedItems[firstLockedIndex + 1];
          if (secondLocked) {
            previewItems.push({
              ...secondLocked,
              title: "?????",
              description: "????",
            });
          }
        }

        return {
          ...group,
          items: previewItems,
        };
      })
      .filter((group) => group.items.length > 0)
      .sort((left, right) => left.family.localeCompare(right.family));
  }, [allAchievements, unlockedKeySet]);

  return (
    <div
      className="h-full w-full overflow-y-auto px-4 pb-24 pt-10"
      data-testid="page-achievements"
    >
      <AppPageHeader title="Achievement Vault" />
      <div className="-mt-2 mb-3">
        <Button asChild variant="ghost" size="sm" className="h-8 px-2">
          <Link href="/profile" aria-label="Back to profile">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to profile
          </Link>
        </Button>
      </div>

      <Card className="mt-3 overflow-hidden rounded-lg border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Achievement Level
              </p>
              <h2 className="mt-1 text-xl font-bold text-foreground">
                Lv. {level.currentLevel}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Achievement XP {level.totalXp.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-primary/35 bg-primary/12 px-3 py-2 text-right">
              <p className="text-xs font-bold text-primary">{completionPercent}%</p>
              <p className="text-[11px] text-muted-foreground">
                {unlockedCount}/{allAchievements.length}
              </p>
            </div>
          </div>
          <Progress value={level.progressPercent} className="mt-3 h-2 bg-background" />
          <p className="mt-2 text-xs text-muted-foreground">
            {level.nextLevelXpFloor === null
              ? "Max achievement level reached."
              : `${level.xpNeededForNextLevel} XP to Level ${level.currentLevel + 1}`}
          </p>
        </CardContent>
      </Card>

      <div className="mt-3 space-y-3">
        {grouped.length === 0 ? (
          <Card className="overflow-hidden rounded-lg border-border bg-card">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground">
                No achievements unlocked yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Answer questions to unlock your first achievement.
              </p>
            </CardContent>
          </Card>
        ) : (
          grouped.map((group) => (
          <Card
            key={group.family}
            className="overflow-hidden rounded-lg border-border bg-card"
          >
            <CardContent className="p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{group.family}</p>
                  <p className="text-xs text-muted-foreground">{formatPhaseLabel(group.phase)}</p>
                </div>
                <div className="rounded-md border border-border bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  {group.items.filter((item) => unlockedKeySet.has(item.key)).length}/
                  {group.items.length}
                </div>
              </div>
              <div className="space-y-2">
                {group.items.map((achievement) => {
                  const isUnlocked = unlockedKeySet.has(achievement.key);
                  return (
                    <div
                      key={achievement.key}
                      className={`rounded-lg border px-3 py-2 ${
                        isUnlocked
                          ? "border-primary/35 bg-primary/10"
                          : "border-border bg-muted/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {achievement.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {achievement.description}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold text-primary">
                            +{achievement.achievementXp} XP
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {isUnlocked ? (
                              <span className="inline-flex items-center gap-1">
                                <Trophy className="h-3 w-3" />
                                Unlocked
                              </span>
                            ) : (
                              <span>Locked</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          ))
        )}
      </div>
    </div>
  );
}
