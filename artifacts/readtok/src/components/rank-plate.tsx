import { Shield } from "lucide-react";
import type { RankPlateData } from "@/lib/rank-visual";
import { cn } from "@/lib/utils";

type RankPlateVariant = "compact" | "full";

function rankPlateTheme(baseRank: string) {
  const normalized = baseRank.trim().toLowerCase();
  if (normalized === "bronze") {
    return "border-amber-600/35 bg-[linear-gradient(135deg,rgba(217,119,6,0.18),rgba(120,53,15,0.1))] text-amber-100";
  }
  if (normalized === "silver") {
    return "border-slate-400/35 bg-[linear-gradient(135deg,rgba(148,163,184,0.18),rgba(71,85,105,0.12))] text-slate-100";
  }
  if (normalized === "gold") {
    return "border-yellow-500/35 bg-[linear-gradient(135deg,rgba(234,179,8,0.2),rgba(161,98,7,0.12))] text-yellow-100";
  }
  if (normalized === "platinum") {
    return "border-cyan-500/35 bg-[linear-gradient(135deg,rgba(6,182,212,0.18),rgba(14,116,144,0.12))] text-cyan-100";
  }
  if (normalized === "diamond") {
    return "border-sky-500/35 bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(14,165,233,0.12))] text-sky-100";
  }
  if (normalized === "master") {
    return "border-rose-500/35 bg-[linear-gradient(135deg,rgba(244,63,94,0.18),rgba(159,18,57,0.12))] text-rose-100";
  }
  if (normalized === "grandmaster") {
    return "border-fuchsia-500/35 bg-[linear-gradient(135deg,rgba(217,70,239,0.18),rgba(126,34,206,0.12))] text-fuchsia-100";
  }
  return "border-emerald-500/35 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.12))] text-emerald-100";
}

export function RankPlate({
  plate,
  variant = "compact",
  className,
}: {
  plate: RankPlateData;
  variant?: RankPlateVariant;
  className?: string;
}) {
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border shadow-sm backdrop-blur",
        rankPlateTheme(plate.baseRank),
        isCompact ? "inline-flex h-9 items-center gap-2 px-3" : "p-3",
        className,
      )}
      data-testid="rank-plate"
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border border-white/15 bg-black/10",
          isCompact ? "h-6 w-6" : "h-10 w-10",
        )}
      >
        <Shield className={cn(isCompact ? "h-3.5 w-3.5" : "h-5 w-5")} />
      </div>

      <div className={cn("min-w-0", isCompact ? "flex items-baseline gap-2" : "space-y-1")}>
        <p
          className={cn(
            "font-semibold leading-none",
            isCompact ? "min-w-0 truncate text-sm" : "text-base",
          )}
        >
          {plate.displayLabel}
        </p>
        {isCompact ? (
          <p className="shrink-0 text-[11px] font-medium text-white/75">
            {plate.rankedPoints} RP
          </p>
        ) : (
          <>
            <p className="text-xs text-white/80">{plate.rankedPoints} RP</p>
            <p className="text-[11px] text-white/70">
              {plate.nextLabel
                ? `${plate.pointsNeededForNextLabel} RP to ${plate.nextLabel}`
                : "Top rank reached"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
