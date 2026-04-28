import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { fetchPassageList, type PassageListItem, type QuestionSetTypeIndex } from "@/lib/passages-api";

const bandFilterOptions = [
  { key: "all", label: "All", band: null as number | null },
  { key: "60", label: "Band 6.0", band: 60 },
  { key: "70", label: "Band 7.0", band: 70 },
  { key: "75", label: "Band 7.5", band: 75 },
  { key: "80", label: "Band 8.0+", band: 80 },
];

const typeFilterOptions: Array<{
  key: "all" | QuestionSetTypeIndex;
  label: string;
  type: QuestionSetTypeIndex | null;
}> = [
  { key: "all", label: "All", type: null },
  { key: "tfng", label: "TFNG", type: "tfng" },
  { key: "mcq", label: "MCQ", type: "mcq" },
  {
    key: "sentence_completion",
    label: "Sentence Completion",
    type: "sentence_completion",
  },
  { key: "short_answer", label: "Short Answer", type: "short_answer" },
  { key: "mixed", label: "Mixed", type: "mixed" },
];

type FilterMode = "band" | "question_type";

export default function Home() {
  const [filterMode, setFilterMode] = useState<FilterMode>("band");
  const [activeBand, setActiveBand] = useState<number | null>(null);
  const [activeType, setActiveType] = useState<QuestionSetTypeIndex | null>(null);
  const [items, setItems] = useState<PassageListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function loadPassages() {
      try {
        const response = await fetchPassageList({
          status: "active",
          band_index:
            filterMode === "band" ? (activeBand ?? undefined) : undefined,
          question_set_type_index:
            filterMode === "question_type" ? (activeType ?? undefined) : undefined,
          limit: 200,
        });

        if (!cancelled) {
          setItems(response.items);
        }
      } catch (fetchError) {
        if (!cancelled) {
          const message =
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load passages.";
          setError(message);
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPassages();

    return () => {
      cancelled = true;
    };
  }, [activeBand, activeType, filterMode]);

  const selectedBandValue = activeBand === null ? "all" : String(activeBand);
  const selectedTypeValue = activeType ?? "all";

  return (
    <div className="min-h-full w-full px-4 pb-24 pt-6" data-testid="page-feed">
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/90">
          IELTS Reading
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white tracking-tight">
          Practice Feed
        </h1>
      </header>

      <section
        className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
        aria-label="filters"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              Filter Group
            </span>
            <select
              value={filterMode}
              onChange={(event) => setFilterMode(event.target.value as FilterMode)}
              className="h-11 rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white outline-none transition-colors focus:border-primary/55"
            >
              <option value="band">Band score</option>
              <option value="question_type">Question type</option>
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              {filterMode === "band" ? "Band Value" : "Question Type"}
            </span>
            {filterMode === "band" ? (
              <select
                value={selectedBandValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setActiveBand(value === "all" ? null : Number(value));
                }}
                className="h-11 rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white outline-none transition-colors focus:border-primary/55"
              >
                {bandFilterOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedTypeValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setActiveType(value === "all" ? null : (value as QuestionSetTypeIndex));
                }}
                className="h-11 rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white outline-none transition-colors focus:border-primary/55"
              >
                {typeFilterOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {!error && isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
            />
          ))}
        </div>
      )}

      {!error && !isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-white/70">
          No passages match the selected filters.
        </div>
      )}

      {!error && !isLoading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/passages/${item.id}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition-colors hover:border-primary/40"
              data-testid={`card-passage-${item.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white leading-tight">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm text-white/60">{item.topic_label}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/40" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                  Band {item.band_label}
                </span>
                <span className="rounded-full border border-white/20 bg-white/[0.03] px-2.5 py-1 text-white/80">
                  {item.question_set_type_label}
                </span>
                <span className="rounded-full border border-white/20 bg-white/[0.03] px-2.5 py-1 text-white/70">
                  {item.question_count} Questions
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
