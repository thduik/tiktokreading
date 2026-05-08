import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { BookmarkX } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { fetchPassageList, type PassageListItem } from "@/lib/passages-api";

export default function Saved() {
  const { savedCardIds, toggleSaveCard } = useAppState();
  const [savedPassages, setSavedPassages] = useState<PassageListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedPassages() {
      if (savedCardIds.length === 0) {
        setSavedPassages([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchPassageList({
          ids: savedCardIds,
          status: "active",
          limit: 200,
        });

        if (cancelled) {
          return;
        }

        const sortOrder = new Map(savedCardIds.map((id, index) => [id, index]));
        const sortedItems = [...response.items].sort(
          (a, b) => (sortOrder.get(a.id) ?? 0) - (sortOrder.get(b.id) ?? 0),
        );

        setSavedPassages(sortedItems);
      } catch (fetchError) {
        if (!cancelled) {
          const message =
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load saved passages.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSavedPassages();

    return () => {
      cancelled = true;
    };
  }, [savedCardIds]);

  const emptyState = useMemo(
    () => savedCardIds.length === 0 && !isLoading,
    [isLoading, savedCardIds.length],
  );

  return (
    <div className="min-h-full w-full overflow-y-auto px-4 pb-24 pt-6" data-testid="page-saved">
      <header className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/90">
          Your Library
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          Saved Passages
        </h1>
      </header>

      {error && (
        <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      )}

      {emptyState && (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-muted-foreground">
          <BookmarkX className="mx-auto mb-3 h-10 w-10 opacity-70" />
          <p className="text-base font-semibold text-foreground">
            No saved passages yet
          </p>
          <p className="mt-1 text-sm">Tap save on any passage to keep it here.</p>
        </div>
      )}

      {!isLoading && savedPassages.length > 0 && (
        <div className="space-y-3">
          {savedPassages.map((passage) => (
            <div
              key={passage.id}
              className="rounded-lg border border-border bg-card px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/?start=${encodeURIComponent(passage.id)}`}
                  className="block min-w-0 flex-1"
                  data-testid={`saved-link-${passage.id}`}
                >
                  <h2 className="text-lg font-semibold leading-tight text-foreground">
                    {passage.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{passage.topic_label}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleSaveCard(passage.id)}
                  className="rounded-lg border border-border bg-muted p-2 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  aria-label="Remove from saved"
                >
                  <BookmarkX className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border border-primary/50 bg-primary/15 px-2.5 py-1 font-semibold text-primary">
                  Band {passage.band_label}
                </span>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-muted-foreground">
                  {passage.question_set_type_label}
                </span>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-muted-foreground">
                  {passage.question_count} Questions
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
