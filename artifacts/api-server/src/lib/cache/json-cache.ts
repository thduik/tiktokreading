import { logger } from "../logger";
import { getRedisClient } from "./redis-client";

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export const passageCacheTtls = {
  listSeconds: parsePositiveInteger(process.env.REDIS_PASSAGES_LIST_TTL_SECONDS, 60),
  detailSeconds: parsePositiveInteger(
    process.env.REDIS_PASSAGE_DETAIL_TTL_SECONDS,
    300,
  ),
  idsSeconds: parsePositiveInteger(process.env.REDIS_PASSAGE_IDS_TTL_SECONDS, 300),
  leaderboardSeconds: parsePositiveInteger(
    process.env.REDIS_LEADERBOARD_TTL_SECONDS,
    30,
  ),
  rankTiersSeconds: parsePositiveInteger(
    process.env.REDIS_RANK_TIERS_TTL_SECONDS,
    3600,
  ),
};

export type JsonCacheStatus = "HIT" | "MISS" | "BYPASS";

export async function readJsonCacheResult<T>(
  key: string,
): Promise<{ status: JsonCacheStatus; value: T | null }> {
  const client = await getRedisClient();
  if (!client) {
    return { status: "BYPASS", value: null };
  }

  try {
    const value = await client.get(key);
    if (!value) {
      return { status: "MISS", value: null };
    }

    return { status: "HIT", value: JSON.parse(value) as T };
  } catch (error) {
    logger.warn({ err: error, key }, "Redis read failed");
    return { status: "BYPASS", value: null };
  }
}

export async function readJsonCache<T>(key: string) {
  const result = await readJsonCacheResult<T>(key);
  return result.value;
}

export async function writeJsonCache<T>({
  key,
  value,
  ttlSeconds,
}: {
  key: string;
  value: T;
  ttlSeconds: number;
}) {
  const client = await getRedisClient();
  if (!client) {
    return;
  }

  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.warn({ err: error, key }, "Redis write failed");
  }
}
