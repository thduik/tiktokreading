import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
import {
  fetchPassageList,
  normalizePassageFactoryTag,
  PASSAGE_FACTORY_TAG_VALUES,
  readStoredPassageFactoryTag,
  writeStoredPassageFactoryTag,
  type PassageFactoryTag,
  type PassageListItem,
  type QuestionTypeIndex,
} from "@/lib/passages-api";
import { AppPageHeader } from "@/components/app-page-header";

const bandFilterOptions = [
  { key: "all", label: "All", band: null as number | null },
  { key: "60", label: "Band 6.0", band: 60 },
  { key: "70", label: "Band 7.0", band: 70 },
  { key: "75", label: "Band 7.5", band: 75 },
  { key: "80", label: "Band 8.0+", band: 80 },
];

const typeFilterOptions: Array<{
  key: "all" | QuestionTypeIndex;
  label: string;
  type: QuestionTypeIndex | null;
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
];

const versionFilterOptions: Array<{
  key: "all" | PassageFactoryTag;
  label: string;
  factoryTag: PassageFactoryTag | null;
}> = [
  { key: "all", label: "All versions", factoryTag: null },
  ...PASSAGE_FACTORY_TAG_VALUES.map((factoryTag) => ({
    key: factoryTag,
    label: factoryTag.toUpperCase(),
    factoryTag,
  })),
];

type FilterMode = "band" | "question_type";
const PAGE_SIZE = 30;
const SESSION_LIST_KEY_PREFIX = "readtok_home_session_list_v2:";

function readInitialFilters() {
  if (typeof window === "undefined") {
    return {
      filterMode: "band" as FilterMode,
      activeBand: null as number | null,
      activeType: null as QuestionTypeIndex | null,
      activeFactoryTag: null as PassageFactoryTag | null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const rawMode = params.get("filterMode");
  const mode: FilterMode = rawMode === "question_type" ? "question_type" : "band";

  const rawBand = params.get("band");
  const parsedBand =
    rawBand !== null && rawBand.trim().length > 0 && Number.isFinite(Number(rawBand))
      ? Number(rawBand)
      : null;

  const rawType = params.get("questionType");
  const allowedTypes: QuestionTypeIndex[] = [
    "tfng",
    "mcq",
    "sentence_completion",
    "short_answer",
  ];
  const parsedType =
    rawType && allowedTypes.includes(rawType as QuestionTypeIndex)
      ? (rawType as QuestionTypeIndex)
      : null;
  const parsedFactoryTag =
    normalizePassageFactoryTag(
      params.get("factoryTag") ?? params.get("factory_tag"),
    ) ?? readStoredPassageFactoryTag();

  return {
    filterMode: mode,
    activeBand: parsedBand,
    activeType: parsedType,
    activeFactoryTag: parsedFactoryTag,
  };
}

function readSessionItems(cacheKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(`${SESSION_LIST_KEY_PREFIX}${cacheKey}`);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed as PassageListItem[];
  } catch {
    return null;
  }
}

function writeSessionItems(cacheKey: string, items: PassageListItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    `${SESSION_LIST_KEY_PREFIX}${cacheKey}`,
    JSON.stringify(items),
  );
}

export default function Home() {
  const [filterMode, setFilterMode] = useState<FilterMode>(() => readInitialFilters().filterMode);
  const [activeBand, setActiveBand] = useState<number | null>(
    () => readInitialFilters().activeBand,
  );
  const [activeType, setActiveType] = useState<QuestionTypeIndex | null>(
    () => readInitialFilters().activeType,
  );
  const [activeFactoryTag, setActiveFactoryTag] = useState<PassageFactoryTag | null>(
    () => readInitialFilters().activeFactoryTag,
  );
  const [items, setItems] = useState<PassageListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextOffset, setNextOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(() => {
    const initial = readInitialFilters();
    return (
      initial.activeBand !== null ||
      initial.activeType !== null ||
      initial.activeFactoryTag !== null
    );
  });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryKeyRef = useRef<string>("");

  const queryKey = useMemo(
    () =>
      `${filterMode}|${activeBand ?? "all"}|${activeType ?? "all"}|${
        activeFactoryTag ?? "all"
      }`,
    [filterMode, activeBand, activeType, activeFactoryTag],
  );

  useEffect(() => {
    queryKeyRef.current = queryKey;
  }, [queryKey]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsLoadingMore(false);
    setError(null);
    setItems([]);
    setHasMore(true);
    setNextOffset(0);

    async function loadPassages() {
      try {
        const sessionItems = readSessionItems(queryKey);
        if (sessionItems && sessionItems.length > 0) {
          if (!cancelled && queryKeyRef.current === queryKey) {
            setItems(sessionItems);
            setNextOffset(sessionItems.length);
            setHasMore(sessionItems.length >= PAGE_SIZE);
          }
          return;
        }

        const response = await fetchPassageList({
          status: "active",
          band_index:
            filterMode === "band" ? (activeBand ?? undefined) : undefined,
          question_type_index:
            filterMode === "question_type" ? (activeType ?? undefined) : undefined,
          factory_tag: activeFactoryTag ?? undefined,
          limit: PAGE_SIZE,
          offset: 0,
        });

        if (!cancelled) {
          if (queryKeyRef.current !== queryKey) {
            return;
          }
          setItems(response.items);
          setNextOffset(response.items.length);
          setHasMore(response.items.length === PAGE_SIZE);
          writeSessionItems(queryKey, response.items);
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
  }, [activeBand, activeType, filterMode, queryKey]);

  useEffect(() => {
    if (isLoading || isLoadingMore || !hasMore || !loadMoreRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry?.isIntersecting) {
          return;
        }

        setIsLoadingMore(true);
        setError(null);
        const requestKey = queryKeyRef.current;

        fetchPassageList({
          status: "active",
          band_index:
            filterMode === "band" ? (activeBand ?? undefined) : undefined,
          question_type_index:
            filterMode === "question_type" ? (activeType ?? undefined) : undefined,
          factory_tag: activeFactoryTag ?? undefined,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })
          .then((response) => {
            if (queryKeyRef.current !== requestKey) {
              return;
            }
            setItems((currentItems) => {
              const seen = new Set(currentItems.map((item) => item.id));
              const merged = [...currentItems];
              for (const item of response.items) {
                if (!seen.has(item.id)) {
                  merged.push(item);
                  seen.add(item.id);
                }
              }
              return merged;
            });
            setNextOffset((currentOffset) => currentOffset + response.items.length);
            setHasMore(response.items.length === PAGE_SIZE);
          })
          .catch((fetchError) => {
            const message =
              fetchError instanceof Error
                ? fetchError.message
                : "Failed to load passages.";
            setError(message);
          })
          .finally(() => {
            setIsLoadingMore(false);
          });
      },
      {
        root: null,
        rootMargin: "200px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [
    isLoading,
    isLoadingMore,
    hasMore,
    nextOffset,
    filterMode,
    activeBand,
    activeType,
    activeFactoryTag,
    queryKey,
  ]);

  const selectedBandValue = activeBand === null ? "all" : String(activeBand);
  const selectedTypeValue = activeType ?? "all";
  const selectedFactoryTagValue = activeFactoryTag ?? "all";
  const hasActiveFilters =
    activeBand !== null || activeType !== null || activeFactoryTag !== null;
  const filterSummary = [
    filterMode === "band"
      ? bandFilterOptions.find((option) => option.band === activeBand)?.label ?? "All bands"
      : typeFilterOptions.find((option) => option.type === activeType)?.label ??
        "All types",
    activeFactoryTag ? activeFactoryTag.toUpperCase() : "All versions",
  ].join(" · ");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ids = items.map((item) => item.id);
    window.sessionStorage.setItem("readtok_feed_ids", JSON.stringify(ids));
  }, [items]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    writeStoredPassageFactoryTag(activeFactoryTag);

    const params = new URLSearchParams();
    params.set("filterMode", filterMode);
    if (filterMode === "band" && activeBand !== null) {
      params.set("band", String(activeBand));
    }
    if (filterMode === "question_type" && activeType !== null) {
      params.set("questionType", activeType);
    }
    if (activeFactoryTag) {
      params.set("factoryTag", activeFactoryTag);
    }

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [activeBand, activeFactoryTag, activeType, filterMode]);

  return (
    <div className="min-h-full w-full px-4 pb-24 pt-6" data-testid="page-list">
      <AppPageHeader title="Passage List" />

      <section
        className="mb-4 rounded-lg border border-border bg-card p-3"
        aria-label="filters"
      >
        <button
          type="button"
          onClick={() => setIsFiltersOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-left transition-colors hover:border-primary"
          aria-expanded={isFiltersOpen}
          aria-controls="passage-list-filters-panel"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Filters</p>
              <p className="truncate text-xs text-muted-foreground">
                {hasActiveFilters ? filterSummary : "Show filters"}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              isFiltersOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isFiltersOpen ? (
          <div
            id="passage-list-filters-panel"
            className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
          >
            <div className="min-w-0 flex-1">
              <select
                value={filterMode}
                onChange={(event) => {
                  setFilterMode(event.target.value as FilterMode);
                }}
                className="h-11 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
              >
                <option value="band">Band score</option>
                <option value="question_type">Question type</option>
              </select>
            </div>

            <div className="min-w-0 flex-1">
              {filterMode === "band" ? (
                <select
                  value={selectedBandValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    setActiveBand(value === "all" ? null : Number(value));
                  }}
                  className="h-11 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
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
                    setActiveType(value === "all" ? null : (value as QuestionTypeIndex));
                  }}
                  className="h-11 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                >
                  {typeFilterOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="min-w-0 sm:col-span-2">
              <select
                value={selectedFactoryTagValue}
                onChange={(event) => {
                  const nextFactoryTag =
                    event.target.value === "all"
                      ? null
                      : (event.target.value as PassageFactoryTag);
                  setActiveFactoryTag(nextFactoryTag);
                }}
                className="h-11 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
              >
                {versionFilterOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      )}

      {!error && !isLoading && items.length === 0 && (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-muted-foreground">
          No passages match the selected filters.
        </div>
      )}

      {!error && !isLoading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/?start=${encodeURIComponent(item.id)}${
                activeFactoryTag
                  ? `&factoryTag=${encodeURIComponent(activeFactoryTag)}`
                  : ""
              }`}
              className="block rounded-lg border border-border bg-card px-4 py-4 transition-colors hover:border-primary hover:bg-muted/60"
              data-testid={`card-passage-${item.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold leading-tight text-foreground">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{item.topic_label}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border border-primary/50 bg-primary/15 px-2.5 py-1 font-semibold text-primary">
                  Band {item.band_label}
                </span>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-muted-foreground">
                  {item.question_set_type_label}
                </span>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-muted-foreground">
                  {item.question_count} Questions
                </span>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-muted-foreground">
                  {item.factory_tag.toUpperCase()}
                </span>
              </div>
            </Link>
          ))}
          <div ref={loadMoreRef} className="h-2 w-full" />
          {isLoadingMore && (
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
              Loading more passages...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
