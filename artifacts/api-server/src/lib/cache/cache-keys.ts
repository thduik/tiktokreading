type CacheScalar = string | number | boolean | null | undefined;

const CACHE_NAMESPACE = process.env.REDIS_CACHE_NAMESPACE?.trim() || "readtok:api:v1";

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

