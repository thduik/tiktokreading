import type { PassageDetail, PassageFactoryTag } from "@/lib/passages-api";

export type FeedRuntimeSession = {
  factoryTagFilter: PassageFactoryTag | null;
  passages: PassageDetail[];
  currentIndex: number;
  answersByPassageId: Record<string, Record<string, string>>;
  revealedByPassageId: Record<string, Record<string, boolean>>;
  elapsedSecondsByPassageId: Record<string, number>;
  questionOrderByPassageId: Record<string, number[]>;
  feedIds: string[];
  listOffset: number;
  feedScrollLeft: number;
};

export type ActivePassageBackupEntry = {
  passage: PassageDetail;
  answersByQuestionId: Record<string, string>;
  revealedByQuestionId: Record<string, boolean>;
  elapsedSeconds: number;
  questionOrder: number[];
  viewedAt: number;
};

export type ActivePassageResumeSnapshot = {
  factoryTagFilter: PassageFactoryTag | null;
  entry: ActivePassageBackupEntry;
};

type PersistedActivePassageResumeSnapshot = ActivePassageResumeSnapshot & {
  version: 1;
  savedAt: number;
  lastActivityAt: number;
};

export const PASSAGE_REPORT_SESSION_KEY_PREFIX = "readtok_reported_passage:";
export const ACTIVE_PASSAGE_RESUME_TTL_MS = 5 * 60 * 1000;
export const ACTIVE_PASSAGE_BACKUP_HEARTBEAT_MS = 30 * 1000;
const ACTIVE_PASSAGE_RESUME_STORAGE_PREFIX = "readtok_active_passage_resume_v1:";

export function passageReportSessionKey(passageId: string) {
  return `${PASSAGE_REPORT_SESSION_KEY_PREFIX}${passageId}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isPassageDetailLike(value: unknown): value is PassageDetail {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<PassageDetail>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.passage === "string" &&
    typeof candidate.factory_tag === "string" &&
    typeof candidate.status === "string" &&
    Array.isArray(candidate.questions) &&
    Array.isArray(candidate.answer_key) &&
    Array.isArray(candidate.vocab) &&
    Array.isArray(candidate.passage_sentences)
  );
}

function isActivePassageBackupEntry(value: unknown): value is ActivePassageBackupEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<ActivePassageBackupEntry>;
  return (
    isPassageDetailLike(candidate.passage) &&
    candidate.answersByQuestionId !== undefined &&
    candidate.revealedByQuestionId !== undefined &&
    isRecordOfString(candidate.answersByQuestionId) &&
    isRecordOfBoolean(candidate.revealedByQuestionId) &&
    typeof candidate.elapsedSeconds === "number" &&
    Number.isFinite(candidate.elapsedSeconds) &&
    Array.isArray(candidate.questionOrder) &&
    candidate.questionOrder.every((item) => typeof item === "number" && Number.isInteger(item)) &&
    typeof candidate.viewedAt === "number" &&
    Number.isFinite(candidate.viewedAt)
  );
}

function isRecordOfString(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "string");
}

function isRecordOfBoolean(value: unknown): value is Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "boolean");
}

export function buildActivePassageResumeStorageKey(factoryTagFilter: PassageFactoryTag | null) {
  return `${ACTIVE_PASSAGE_RESUME_STORAGE_PREFIX}${factoryTagFilter ?? "all"}`;
}

export function clearActivePassageResume(factoryTagFilter: PassageFactoryTag | null) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(buildActivePassageResumeStorageKey(factoryTagFilter));
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function writeActivePassageResume(
  snapshot: ActivePassageResumeSnapshot,
  lastActivityAt = Date.now(),
) {
  if (!canUseStorage()) {
    return;
  }

  const payload: PersistedActivePassageResumeSnapshot = {
    ...snapshot,
    version: 1,
    savedAt: Date.now(),
    lastActivityAt,
  };

  try {
    window.localStorage.setItem(
      buildActivePassageResumeStorageKey(snapshot.factoryTagFilter),
      JSON.stringify(payload),
    );
  } catch {
    // Ignore storage write failures; resume snapshot is best-effort.
  }
}

export function readActivePassageResume(
  factoryTagFilter: PassageFactoryTag | null,
  now = Date.now(),
): ActivePassageResumeSnapshot | null {
  if (!canUseStorage()) {
    return null;
  }

  const storageKey = buildActivePassageResumeStorageKey(factoryTagFilter);
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedActivePassageResumeSnapshot>;
    if (
      parsed.version !== 1 ||
      typeof parsed.savedAt !== "number" ||
      typeof parsed.lastActivityAt !== "number" ||
      now - parsed.lastActivityAt > ACTIVE_PASSAGE_RESUME_TTL_MS ||
      !isActivePassageBackupEntry(parsed.entry)
    ) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return {
      factoryTagFilter:
        parsed.factoryTagFilter === null || typeof parsed.factoryTagFilter === "string"
          ? parsed.factoryTagFilter
          : null,
      entry: parsed.entry,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
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
