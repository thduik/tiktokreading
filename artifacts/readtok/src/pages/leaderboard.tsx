import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, Medal, Trophy } from "lucide-react";
import { RankPlate } from "@/components/rank-plate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchLeaderboard,
  type LeaderboardEntry,
  type LeaderboardEnvelope,
} from "@/lib/profile-api";
import {
  DEFAULT_RANK_TIERS,
  getRankPlateData,
  normalizeRankTiers,
} from "@/lib/rank-visual";

const RANK_OPTIONS = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
] as const;

function formatAccuracy(entry: LeaderboardEntry) {
  return `${entry.accuracy_percent}%`;
}

function LeaderboardRow({
  entry,
  rankTiers,
}: {
  entry: LeaderboardEntry;
  rankTiers: LeaderboardEnvelope["rank_tiers"];
}) {
  const plate = getRankPlateData(
    entry.ranked_points,
    rankTiers,
    entry.current_rank,
  );

  return (
    <div
      className={`rounded-lg border px-3 py-3 ${
        entry.is_viewer
          ? "border-primary/50 bg-primary/10"
          : "border-border bg-card"
      }`}
      data-testid={`leaderboard-row-${entry.position}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-bold text-foreground">
          #{entry.position}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {entry.display_name}
                {entry.is_viewer ? " (You)" : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.ranked_points} RP • {formatAccuracy(entry)} • {entry.total_questions_answered} answered
              </p>
            </div>
            <RankPlate plate={plate} variant="compact" className="shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [scope, setScope] = useState<"global" | "rank">("global");
  const [selectedRank, setSelectedRank] = useState<(typeof RANK_OPTIONS)[number]>("Bronze");
  const [data, setData] = useState<LeaderboardEnvelope | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchLeaderboard({
          scope,
          rank: scope === "rank" ? selectedRank : undefined,
          limit: 50,
        });

        if (!cancelled) {
          setData(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load leaderboard");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [scope, selectedRank]);

  const rankTiers = useMemo(
    () => normalizeRankTiers(data?.rank_tiers ?? DEFAULT_RANK_TIERS),
    [data?.rank_tiers],
  );

  const viewerCard = useMemo(() => {
    if (!data?.viewer) {
      return null;
    }

    const viewerInList = data.items.some((entry) => entry.user_id === data.viewer?.user_id);
    if (viewerInList) {
      return null;
    }

    return (
      <Card className="border-primary/35 bg-primary/10" data-testid="leaderboard-viewer-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                Your Position
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                #{data.viewer.position} in {scope === "global" ? "Global" : selectedRank}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.viewer.ranked_points} RP • {formatAccuracy(data.viewer)}
              </p>
            </div>
            <Medal className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }, [data?.viewer, data?.items, scope, selectedRank]);

  return (
    <div className="min-h-full w-full overflow-y-auto px-4 pb-24 pt-6" data-testid="page-leaderboard">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-lg">
          <Link href="/profile" aria-label="Back to profile">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Ranked</p>
          <h1 className="truncate text-2xl font-bold text-foreground">Leaderboard</h1>
        </div>
      </div>

      <Card className="mb-4 border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={scope === "global" ? "default" : "outline"}
              className={scope === "global" ? "" : "bg-muted hover:bg-muted/80"}
              onClick={() => setScope("global")}
              data-testid="leaderboard-filter-global"
            >
              Global
            </Button>
            {RANK_OPTIONS.map((rank) => (
              <Button
                key={rank}
                type="button"
                variant={scope === "rank" && selectedRank === rank ? "default" : "outline"}
                className={scope === "rank" && selectedRank === rank ? "" : "bg-muted hover:bg-muted/80"}
                onClick={() => {
                  setSelectedRank(rank);
                  setScope("rank");
                }}
                data-testid={`leaderboard-filter-${rank.toLowerCase()}`}
              >
                {rank}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 overflow-hidden border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                {scope === "global" ? "Global Board" : `${selectedRank} Board`}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                Top readers by ranked points
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                LP comes first. Ties break by correct answers and total answered.
              </p>
            </div>
            <Trophy className="h-8 w-8 shrink-0 text-primary/80" />
          </div>
        </CardContent>
      </Card>

      {viewerCard}

      {error && (
        <Card className="mb-4 border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-lg border border-border bg-muted"
            />
          ))}
        </div>
      )}

      {!isLoading && !error && data && data.items.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-6 text-center">
            <p className="text-base font-semibold text-foreground">No ranked readers yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Once users start answering ranked questions, this board will fill in.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map((entry) => (
            <LeaderboardRow key={entry.user_id} entry={entry} rankTiers={rankTiers} />
          ))}
        </div>
      )}
    </div>
  );
}
