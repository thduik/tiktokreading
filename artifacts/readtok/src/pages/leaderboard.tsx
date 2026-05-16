import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronLeft, Medal, Trophy } from "lucide-react";
import { RankPlate } from "@/components/rank-plate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { LeaderboardRowsSkeleton } from "@/components/page-skeletons";
import {
  fetchLeaderboard,
  fetchLeaderboardUserStats,
  type AnswerStatBandGroup,
  type AnswerStatQuestionType,
  type AnswerStatsPeriod,
  type LeaderboardEntry,
  type LeaderboardEnvelope,
  type PublicLeaderboardUserStatsEnvelope,
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

const PUBLIC_PERIOD_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "last7", label: "7 Days" },
  { key: "last30", label: "30 Days" },
  { key: "lifetime", label: "Lifetime" },
] as const;

const BAND_LABELS: Record<AnswerStatBandGroup, string> = {
  Band6: "Band 6.0",
  Band7: "Band 7.0",
  Band75: "Band 7.5",
  Band8Plus: "Band 8.0+",
};

const TYPE_LABELS: Record<AnswerStatQuestionType, string> = {
  MCQ: "MCQ",
  TFNG: "TFNG",
  SentenceCompletion: "Sentence Completion",
  ShortAnswer: "Short Answer",
  Matching: "Matching",
};

function formatAccuracy(entry: LeaderboardEntry) {
  return `${entry.accuracy_percent}%`;
}

function getBandSummaries(period: AnswerStatsPeriod) {
  const rows = Object.entries(period.byBandAndType).flatMap(([bandGroup, byType]) => {
    if (!byType) return [];
    const cells = Object.values(byType);
    const total = cells.reduce((sum, cell) => sum + (cell?.total ?? 0), 0);
    const correct = cells.reduce((sum, cell) => sum + (cell?.correct ?? 0), 0);
    const wrong = cells.reduce((sum, cell) => sum + (cell?.wrong ?? 0), 0);
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return total > 0
      ? [{ bandGroup: bandGroup as AnswerStatBandGroup, total, correct, wrong, accuracy }]
      : [];
  });

  return rows.sort((left, right) => right.total - left.total);
}

function getTypeSummaries(period: AnswerStatsPeriod) {
  const totals = new Map<AnswerStatQuestionType, { total: number; correct: number; wrong: number }>();
  for (const byType of Object.values(period.byBandAndType)) {
    if (!byType) continue;
    for (const [questionType, cell] of Object.entries(byType)) {
      if (!cell) continue;
      const key = questionType as AnswerStatQuestionType;
      const current = totals.get(key) ?? { total: 0, correct: 0, wrong: 0 };
      current.total += cell.total;
      current.correct += cell.correct;
      current.wrong += cell.wrong;
      totals.set(key, current);
    }
  }

  return Array.from(totals.entries())
    .map(([questionType, cell]) => ({
      questionType,
      ...cell,
      accuracy: cell.total > 0 ? Math.round((cell.correct / cell.total) * 100) : 0,
    }))
    .sort((left, right) => right.total - left.total);
}

function getHighlights(period: AnswerStatsPeriod) {
  const minAttempts = 3;
  const typeRows = getTypeSummaries(period).filter((row) => row.total >= minAttempts);
  const bestType = [...typeRows].sort(
    (left, right) => right.accuracy - left.accuracy || right.total - left.total,
  )[0] ?? null;
  const weakType = [...typeRows].sort(
    (left, right) => left.accuracy - right.accuracy || right.total - left.total,
  )[0] ?? null;

  const bandRows = getBandSummaries(period).filter((row) => row.total >= minAttempts);
  const bestBand = [...bandRows].sort(
    (left, right) => right.accuracy - left.accuracy || right.total - left.total,
  )[0] ?? null;
  const weakBand = [...bandRows].sort(
    (left, right) => left.accuracy - right.accuracy || right.total - left.total,
  )[0] ?? null;

  return { bestType, weakType, bestBand, weakBand, typeRows, bandRows };
}

function PublicStatsPanel({
  stats,
  activePeriod,
  onChangePeriod,
}: {
  stats: PublicLeaderboardUserStatsEnvelope;
  activePeriod: (typeof PUBLIC_PERIOD_OPTIONS)[number]["key"];
  onChangePeriod: (value: (typeof PUBLIC_PERIOD_OPTIONS)[number]["key"]) => void;
}) {
  const period = stats.periods[activePeriod];
  const highlights = getHighlights(period);

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted p-3">
      <div className="flex flex-wrap gap-2">
        {PUBLIC_PERIOD_OPTIONS.map((option) => (
          <Button
            key={option.key}
            type="button"
            size="sm"
            variant={activePeriod === option.key ? "default" : "outline"}
            className={activePeriod === option.key ? "" : "bg-card hover:bg-card/80"}
            onClick={() => onChangePeriod(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Attempted
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{period.overall.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Accuracy
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{period.overall.accuracy}%</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Best Type
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {highlights.bestType
              ? `${TYPE_LABELS[highlights.bestType.questionType]} ${highlights.bestType.accuracy}%`
              : "Not enough data"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Weak Type
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {highlights.weakType
              ? `${TYPE_LABELS[highlights.weakType.questionType]} ${highlights.weakType.accuracy}%`
              : "Not enough data"}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {highlights.bandRows.slice(0, 4).map((band) => (
          <div key={band.bandGroup} className="rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{BAND_LABELS[band.bandGroup]}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {band.correct}/{band.total} correct • {band.wrong} wrong
                </p>
              </div>
              <p className="text-sm font-semibold text-foreground">{band.accuracy}%</p>
            </div>
            <Progress value={band.accuracy} className="mt-2 h-1.5 bg-background" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PublicAchievementsPanel({
  stats,
  isExpanded,
  onToggleExpanded,
}: {
  stats: PublicLeaderboardUserStatsEnvelope;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const previewItems = stats.achievements.top;
  const hasMore = stats.achievements.total_unlocked > previewItems.length;

  if (stats.achievements.total_unlocked === 0) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted p-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
          Achievements
        </p>
        <p className="mt-2 text-sm text-muted-foreground">No unlocked achievements yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={onToggleExpanded}
        aria-expanded={isExpanded}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Achievements
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.achievements.total_unlocked} unlocked
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {!isExpanded ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {previewItems.map((achievement) => (
            <span
              key={achievement.achievement_key}
              className="inline-flex max-w-full items-center rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground"
            >
              <span className="truncate">{achievement.achievement_title}</span>
            </span>
          ))}
          {hasMore ? (
            <span className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
              ...
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stats.achievements.items.map((achievement) => (
            <div
              key={achievement.achievement_key}
              className="rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {achievement.achievement_title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {achievement.achievement_tier} • {achievement.achievement_category}
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  {achievement.achievement_xp} XP
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicProfileDialog({
  open,
  onOpenChange,
  stats,
  isLoading,
  error,
  activePeriod,
  onChangePeriod,
  isAchievementsExpanded,
  onToggleAchievementsExpanded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: PublicLeaderboardUserStatsEnvelope | null;
  isLoading: boolean;
  error: string | null;
  activePeriod: (typeof PUBLIC_PERIOD_OPTIONS)[number]["key"];
  onChangePeriod: (value: (typeof PUBLIC_PERIOD_OPTIONS)[number]["key"]) => void;
  isAchievementsExpanded: boolean;
  onToggleAchievementsExpanded: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl rounded-lg border border-border bg-card p-4 text-foreground sm:p-5">
        {stats ? (
          <>
            <div className="pr-8">
              <DialogTitle className="text-2xl font-semibold leading-tight text-foreground">
                {stats.user.display_name}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                #{stats.positions.global ?? "-"} global • #{stats.positions.rank ?? "-"} in rank
              </DialogDescription>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Rank
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {stats.progress.current_rank}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  RP
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {stats.progress.ranked_points}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  XP
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {stats.progress.lifetime_xp}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Answered
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {stats.progress.total_questions_answered}
                </p>
              </div>
            </div>

            <PublicStatsPanel
              stats={stats}
              activePeriod={activePeriod}
              onChangePeriod={onChangePeriod}
            />
            <PublicAchievementsPanel
              stats={stats}
              isExpanded={isAchievementsExpanded}
              onToggleExpanded={onToggleAchievementsExpanded}
            />
          </>
        ) : isLoading ? (
          <div className="space-y-3">
            <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
            <div className="h-56 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LeaderboardRow({
  entry,
  rankTiers,
  onToggle,
}: {
  entry: LeaderboardEntry;
  rankTiers: LeaderboardEnvelope["rank_tiers"];
  onToggle: () => void;
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
      <button type="button" className="w-full text-left" onClick={onToggle}>
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
              <div className="flex items-center gap-2">
                <RankPlate plate={plate} variant="compact" className="shrink-0" />
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

export default function LeaderboardPage() {
  const [scope, setScope] = useState<"global" | "rank">("global");
  const [selectedRank, setSelectedRank] = useState<(typeof RANK_OPTIONS)[number]>("Bronze");
  const [data, setData] = useState<LeaderboardEnvelope | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPublicUserId, setSelectedPublicUserId] = useState<string | null>(null);
  const [publicStatsByUserId, setPublicStatsByUserId] = useState<
    Record<string, PublicLeaderboardUserStatsEnvelope>
  >({});
  const [publicStatsErrorByUserId, setPublicStatsErrorByUserId] = useState<
    Record<string, string>
  >({});
  const [loadingPublicUserId, setLoadingPublicUserId] = useState<string | null>(null);
  const [activeDialogPeriod, setActiveDialogPeriod] =
    useState<(typeof PUBLIC_PERIOD_OPTIONS)[number]["key"]>("today");
  const [isAchievementsExpanded, setIsAchievementsExpanded] = useState(false);

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

  useEffect(() => {
    if (!selectedPublicUserId || publicStatsByUserId[selectedPublicUserId]) {
      return;
    }

    const targetPublicUserId = selectedPublicUserId;
    let cancelled = false;
    setLoadingPublicUserId(targetPublicUserId);
    setPublicStatsErrorByUserId((current) => {
      const next = { ...current };
      delete next[targetPublicUserId];
      return next;
    });

    async function loadExpandedStats() {
      try {
        const result = await fetchLeaderboardUserStats(targetPublicUserId);
        if (cancelled) {
          return;
        }
        setPublicStatsByUserId((current) => ({
          ...current,
          [targetPublicUserId]: result,
        }));
      } catch (loadError) {
        if (!cancelled) {
          setPublicStatsErrorByUserId((current) => ({
            ...current,
            [targetPublicUserId]:
              loadError instanceof Error
                ? loadError.message
                : "Could not load public stats",
          }));
        }
      } finally {
        if (!cancelled) {
          setLoadingPublicUserId((current) =>
            current === targetPublicUserId ? null : current,
          );
        }
      }
    }

    void loadExpandedStats();

    return () => {
      cancelled = true;
    };
  }, [selectedPublicUserId, publicStatsByUserId]);

  const rankTiers = useMemo(
    () => normalizeRankTiers(data?.rank_tiers ?? DEFAULT_RANK_TIERS),
    [data?.rank_tiers],
  );

  const viewerCard = useMemo(() => {
    if (!data?.viewer) {
      return null;
    }

    const viewerInList = data.items.some(
      (entry) => entry.public_user_id === data.viewer?.public_user_id,
    );
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
        <LeaderboardRowsSkeleton />
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
            <LeaderboardRow
              key={entry.public_user_id}
              entry={entry}
              rankTiers={rankTiers}
              onToggle={() => {
                setActiveDialogPeriod("today");
                setIsAchievementsExpanded(false);
                setSelectedPublicUserId(entry.public_user_id);
              }}
            />
          ))}
        </div>
      )}

      <PublicProfileDialog
        open={selectedPublicUserId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPublicUserId(null);
            setIsAchievementsExpanded(false);
          }
        }}
        stats={selectedPublicUserId ? publicStatsByUserId[selectedPublicUserId] ?? null : null}
        isLoading={Boolean(selectedPublicUserId && loadingPublicUserId === selectedPublicUserId)}
        error={selectedPublicUserId ? publicStatsErrorByUserId[selectedPublicUserId] ?? null : null}
        activePeriod={activeDialogPeriod}
        onChangePeriod={setActiveDialogPeriod}
        isAchievementsExpanded={isAchievementsExpanded}
        onToggleAchievementsExpanded={() =>
          setIsAchievementsExpanded((current) => !current)
        }
      />
    </div>
  );
}
