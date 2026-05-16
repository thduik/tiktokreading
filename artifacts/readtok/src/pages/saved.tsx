import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, BookText, BookmarkX, Trash2 } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import {
  ensurePassageContentNamespace,
  fetchPassageList,
  type PassageListItem,
} from "@/lib/passages-api";
import { fetchMyVocabBank, type VocabBankItem } from "@/lib/profile-api";
import { authEnabled } from "@/lib/runtime-config";
import { AppPageHeader } from "@/components/app-page-header";
import { SavedPageContentSkeleton } from "@/components/page-skeletons";

export default function Saved() {
  const { savedCardIds, toggleSaveCard, mistakes, clearMistakes } = useAppState();
  const [savedPassages, setSavedPassages] = useState<PassageListItem[]>([]);
  const [activeTab, setActiveTab] = useState<"saved" | "mistakes" | "vocab">("saved");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vocabItems, setVocabItems] = useState<VocabBankItem[]>([]);
  const [isLoadingVocab, setIsLoadingVocab] = useState(false);
  const [vocabError, setVocabError] = useState<string | null>(null);
  const lastLoadedSavedIdsKeyRef = useRef<string>("");
  const savedIdsKey = useMemo(() => savedCardIds.join("|"), [savedCardIds]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedPassages() {
      if (savedCardIds.length === 0) {
        setSavedPassages([]);
        setError(null);
        return;
      }

      if (lastLoadedSavedIdsKeyRef.current === savedIdsKey) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        await ensurePassageContentNamespace({ status: "active" });
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
        lastLoadedSavedIdsKeyRef.current = savedIdsKey;
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
  }, [savedCardIds, savedIdsKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadVocabBank() {
      if (activeTab !== "vocab") {
        return;
      }

      if (!authEnabled) {
        setVocabItems([]);
        setVocabError("Sign in is required to use personal vocab bank.");
        return;
      }

      setIsLoadingVocab(true);
      setVocabError(null);
      try {
        const response = await fetchMyVocabBank(300);
        if (cancelled) {
          return;
        }
        setVocabItems(response.items);
      } catch (fetchError) {
        if (cancelled) {
          return;
        }
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load vocab bank.";
        if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
          setVocabError("Sign in to view your personal vocab bank.");
        } else {
          setVocabError(message);
        }
        setVocabItems([]);
      } finally {
        if (!cancelled) {
          setIsLoadingVocab(false);
        }
      }
    }

    void loadVocabBank();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const emptyState = useMemo(
    () => savedCardIds.length === 0 && !isLoading,
    [isLoading, savedCardIds.length],
  );

  const mistakesEmptyState = mistakes.length === 0;

  return (
    <div className="min-h-full w-full overflow-y-auto px-4 pb-24 pt-6" data-testid="page-saved">
      <AppPageHeader title="Saved & Mistakes" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="grid h-11 flex-1 grid-cols-3 rounded-lg border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`rounded-md text-sm font-semibold ${
              activeTab === "saved"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Saved ({savedCardIds.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mistakes")}
            className={`rounded-md text-sm font-semibold ${
              activeTab === "mistakes"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mistakes ({mistakes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("vocab")}
            className={`rounded-md text-sm font-semibold ${
              activeTab === "vocab"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Vocab ({vocabItems.length})
          </button>
        </div>

        {activeTab === "mistakes" && mistakes.length > 0 && (
          <button
            type="button"
            onClick={clearMistakes}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      {activeTab === "saved" && error && (
        <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {activeTab === "saved" && isLoading && <SavedPageContentSkeleton />}

      {activeTab === "saved" && emptyState && (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-muted-foreground">
          <BookmarkX className="mx-auto mb-3 h-10 w-10 opacity-70" />
          <p className="text-base font-semibold text-foreground">
            No saved passages yet
          </p>
          <p className="mt-1 text-sm">Tap save on any passage to keep it here.</p>
        </div>
      )}

      {activeTab === "saved" && !isLoading && savedPassages.length > 0 && (
        <div className="space-y-3">
          {savedPassages.map((passage) => (
            <div
              key={passage.id}
              className="rounded-lg border border-border bg-card px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/passages/${encodeURIComponent(passage.id)}`}
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

      {activeTab === "mistakes" && mistakesEmptyState && (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-muted-foreground">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 opacity-70" />
          <p className="text-base font-semibold text-foreground">No mistakes logged yet</p>
          <p className="mt-1 text-sm">
            Wrong answers will show up here automatically for quick review.
          </p>
        </div>
      )}

      {activeTab === "mistakes" && !mistakesEmptyState && (
        <div className="space-y-3">
          {mistakes.map((mistake) => (
            <div
              key={mistake.id}
              className="rounded-lg border border-border bg-card px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/passages/${encodeURIComponent(mistake.passageId)}`}
                    className="block"
                    data-testid={`mistake-link-${mistake.id}`}
                  >
                    <h2 className="text-lg font-semibold leading-tight text-foreground">
                      {mistake.passageTitle || "Passage review"}
                    </h2>
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">{mistake.questionPrompt}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {new Date(mistake.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border border-primary/50 bg-primary/15 px-2.5 py-1 font-semibold text-primary">
                  Band {mistake.band}
                </span>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-muted-foreground">
                  {mistake.type}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-destructive">
                    Your answer
                  </p>
                  <p className="mt-2 text-sm text-foreground">{mistake.userAnswer || "Blank"}</p>
                </div>
                <div className="rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-secondary">
                    Correct answer
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    {mistake.correctAnswer || "Unavailable"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "vocab" && vocabError && (
        <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {vocabError}
        </div>
      )}

      {activeTab === "vocab" && isLoadingVocab && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      )}

      {activeTab === "vocab" && !isLoadingVocab && vocabItems.length === 0 && !vocabError && (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-muted-foreground">
          <BookText className="mx-auto mb-3 h-10 w-10 opacity-70" />
          <p className="text-base font-semibold text-foreground">No vocab saved yet</p>
          <p className="mt-1 text-sm">
            Tap a highlighted word in passages, then use “Add to Vocab Bank”.
          </p>
        </div>
      )}

      {activeTab === "vocab" && !isLoadingVocab && vocabItems.length > 0 && (
        <div className="space-y-3">
          {vocabItems.map((item) => (
            <div
              key={item.normalized_term}
              className="rounded-lg border border-border bg-card px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold leading-tight text-foreground">
                    {item.term}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.meaning_en || "No English meaning"}
                  </p>
                  {item.meaning_vi ? (
                    <p className="mt-1 text-sm text-foreground/90">{item.meaning_vi}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>

              {item.example_sentence_en ? (
                <div className="mt-3 rounded-lg border border-border bg-muted px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{item.example_sentence_en}</p>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {item.source_band_label ? (
                  <span className="rounded-md border border-primary/50 bg-primary/15 px-2.5 py-1 font-semibold text-primary">
                    Band {item.source_band_label}
                  </span>
                ) : null}
                {item.source_passage_id && item.source_passage_title ? (
                  <Link
                    href={`/passages/${encodeURIComponent(item.source_passage_id)}`}
                    className="rounded-md border border-border bg-muted px-2.5 py-1 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {item.source_passage_title}
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
