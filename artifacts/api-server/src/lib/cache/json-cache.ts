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
};

export async function readJsonCache<T>(key: string) {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const value = await client.get(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    logger.warn({ err: error, key }, "Redis read failed");
    return null;
  }
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

