import { closeRedisClient, getRedisClient } from "../lib/cache/redis-client";

const CACHE_NAMESPACE_BASE =
  process.env.REDIS_CACHE_NAMESPACE?.trim() || "readtok:api";
const PASSAGE_CACHE_PREFIX = `${CACHE_NAMESPACE_BASE}:v2:passages:`;

async function main() {
  const client = await getRedisClient();
  if (!client) {
    console.log(
      JSON.stringify({
        ok: true,
        storage: "bypass",
        deleted: 0,
        prefix: PASSAGE_CACHE_PREFIX,
      }),
    );
    return;
  }

  const keys: string[] = [];
  for await (const key of client.scanIterator({ MATCH: `${PASSAGE_CACHE_PREFIX}*`, COUNT: 500 })) {
    keys.push(key);
  }

  if (keys.length > 0) {
    await client.del(keys);
  }

  console.log(
    JSON.stringify({
      ok: true,
      storage: "redis",
      deleted: keys.length,
      prefix: PASSAGE_CACHE_PREFIX,
    }),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRedisClient();
  });
