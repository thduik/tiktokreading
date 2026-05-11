type CacheScalar = string | number | boolean | null | undefined;

const CACHE_NAMESPACE_BASE =
  process.env.REDIS_CACHE_NAMESPACE?.trim() || "readtok:api";
const CACHE_NAMESPACE = `${CACHE_NAMESPACE_BASE}:v2`;

function serializePart(value: CacheScalar) {
  if (value === undefined) {
    return "";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  return String(value);
}

function stableParamString(params: Record<string, CacheScalar>) {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return entries
    .map(([key, value]) => `${key}=${encodeURIComponent(serializePart(value))}`)
    .join("&");
}

export function passagesListCacheKey(params: Record<string, CacheScalar>) {
  return `${CACHE_NAMESPACE}:passages:list:${stableParamString(params)}`;
}

export function passageIdsCacheKey(params: Record<string, CacheScalar>) {
  return `${CACHE_NAMESPACE}:passages:ids:${stableParamString(params)}`;
}

export function passageDetailCacheKey({
  id,
  includeAnswerKey,
}: {
  id: string;
  includeAnswerKey: boolean;
}) {
  return `${CACHE_NAMESPACE}:passages:detail:${encodeURIComponent(
    id,
  )}:answers=${includeAnswerKey ? "1" : "0"}`;
}

export function leaderboardRowsCacheKey(params: Record<string, CacheScalar>) {
  return `${CACHE_NAMESPACE}:leaderboard:rows:${stableParamString(params)}`;
}

export function rankTiersCacheKey() {
  return `${CACHE_NAMESPACE}:rank-tiers`;
}
