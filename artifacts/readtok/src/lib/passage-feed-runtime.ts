import type { PassageDetail, PassageFactoryTag } from "@/lib/passages-api";

export type FeedRuntimeSession = {
  factoryTagFilter: PassageFactoryTag | null;
  passages: PassageDetail[];
  currentIndex: number;
  answersByPassageId: Record<string, Record<string, string>>;
  revealedByPassageId: Record<string, Record<string, boolean>>;
  elapsedSecondsByPassageId: Record<string, number>;
  feedIds: string[];
  listOffset: number;
  feedScrollLeft: number;
};

export const PASSAGE_REPORT_SESSION_KEY_PREFIX = "readtok_reported_passage:";

export function passageReportSessionKey(passageId: string) {
  return `${PASSAGE_REPORT_SESSION_KEY_PREFIX}${passageId}`;
}

export function uniqueIds(ids: string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (id.length === 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

export function shuffleIds(ids: string[]) {
  const cloned = [...ids];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = cloned[index];
    cloned[index] = cloned[swapIndex];
    cloned[swapIndex] = temp;
  }
  return cloned;
}

export function readIdArrayFromStorage(storageKey: string) {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
  } catch {
    return [];
  }
}

export function writeIdArrayToStorage(storageKey: string, ids: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(uniqueIds(ids)));
}

export function selectRandomIdsFromPool({
  poolIds,
  alreadyShownIds,
  excludeIds,
  count,
}: {
  poolIds: string[];
  alreadyShownIds: string[];
  excludeIds: string[];
  count: number;
}) {
  const excludeSet = new Set(excludeIds);
  const shownSet = new Set(alreadyShownIds);

  const freshCandidates = poolIds.filter(
    (id) => !shownSet.has(id) && !excludeSet.has(id),
  );
  if (freshCandidates.length >= count) {
    return shuffleIds(freshCandidates).slice(0, count);
  }

  const resetCandidates = poolIds.filter((id) => !excludeSet.has(id));
  return shuffleIds(resetCandidates).slice(0, count);
}

export function formatElapsedTimer(totalSeconds: number) {
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.trunc(totalSeconds))
    : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
