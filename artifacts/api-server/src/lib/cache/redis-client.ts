import { createClient } from "redis";
import { logger } from "../logger";

type RedisClientInstance = ReturnType<typeof createClient>;

let clientPromise: Promise<RedisClientInstance | null> | null = null;
let cacheDisabled = false;

function redisUrl() {
  const value = process.env.REDIS_URL;
  return value && value.trim().length > 0 ? value.trim() : null;
}

async function initializeRedisClient() {
  const url = redisUrl();
  if (!url || cacheDisabled) {
    return null;
  }

  const client = createClient({ url });

  client.on("error", (error: unknown) => {
    logger.warn({ err: error }, "Redis client error");
  });

  try {
    await client.connect();
    logger.info("Redis cache connected");
    return client;
  } catch (error) {
    cacheDisabled = true;
    logger.warn({ err: error }, "Redis connect failed; cache disabled");
    return null;
  }
}

export async function getRedisClient() {
  if (!clientPromise) {
    clientPromise = initializeRedisClient();
  }

  return clientPromise;
}
