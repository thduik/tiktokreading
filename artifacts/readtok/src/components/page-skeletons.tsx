import { Skeleton } from "@/components/ui/skeleton";

function HeaderSkeleton({ titleWidth = "w-40" }: { titleWidth?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 pt-0.5">
        <Skeleton className={`h-8 rounded-lg ${titleWidth}`} />
      </div>
    </div>
  );
}

function PassageCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-4/5 rounded-lg" />
          <Skeleton className="h-4 w-2/3 rounded-lg" />
        </div>
        <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="h-6 w-24 rounded-md" />
      </div>
    </div>
  );
}

export function PassageListContentSkeleton() {
  return (
    <>
      <section className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-20 rounded-lg" />
              <Skeleton className="h-3 w-28 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
        </div>
      </section>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <PassageCardSkeleton key={index} />
        ))}
      </div>
    </>
  );
}

export function PassageListPageSkeleton() {
  return (
    <div className="min-h-full w-full px-4 pb-24 pt-6">
      <HeaderSkeleton titleWidth="w-44" />
      <PassageListContentSkeleton />
    </div>
  );
}

export function SavedPageContentSkeleton() {
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-11 flex-1 rounded-lg" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <PassageCardSkeleton key={index} />
        ))}
      </div>
    </>
  );
}

export function SavedPageSkeleton() {
  return (
    <div className="min-h-full w-full overflow-y-auto px-4 pb-24 pt-6">
      <HeaderSkeleton titleWidth="w-52" />
      <SavedPageContentSkeleton />
    </div>
  );
}

export function LeaderboardPageSkeleton() {
  return (
    <div className="min-h-full w-full overflow-y-auto px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-16 rounded-lg" />
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-20 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24 rounded-lg" />
            <Skeleton className="h-7 w-48 rounded-lg" />
            <Skeleton className="h-4 w-64 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-card px-3 py-3"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-36 rounded-lg" />
                <Skeleton className="h-3 w-40 rounded-lg" />
              </div>
              <Skeleton className="h-9 w-24 shrink-0 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeaderboardRowsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-card px-3 py-3"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-36 rounded-lg" />
              <Skeleton className="h-3 w-40 rounded-lg" />
            </div>
            <Skeleton className="h-9 w-24 shrink-0 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="min-h-full w-full overflow-y-auto px-4 pb-24 pt-6">
      <HeaderSkeleton titleWidth="w-40" />

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-20 rounded-lg" />
              <Skeleton className="h-8 w-48 rounded-lg" />
              <Skeleton className="h-4 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-14 w-28 shrink-0 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={`rounded-lg border border-border bg-card p-4 ${
                index === 0 || index === 2 ? "col-span-2" : ""
              }`}
            >
              <div className="space-y-2">
                <Skeleton className="h-3 w-24 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-4 w-28 rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-28 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function GenericPageSkeleton() {
  return (
    <div className="min-h-full w-full overflow-y-auto px-4 pb-24 pt-6">
      <HeaderSkeleton />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
