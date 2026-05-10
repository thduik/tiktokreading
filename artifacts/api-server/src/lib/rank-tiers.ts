import { asc } from "drizzle-orm";
import { db, rankTiers } from "@workspace/db";
import { rankTiersCacheKey } from "./cache/cache-keys";
import {
  passageCacheTtls,
  readJsonCacheResult,
  type JsonCacheStatus,
  writeJsonCache,
} from "./cache/json-cache";

export type RankTierResponse = {
  key: string;
  label: string;
  min_points: number;
  sort_order: number;
};

function toResponseTiers(
  rows: Array<{ key: string; label: string; minPoints: number; sortOrder: number }>,
): RankTierResponse[] {
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    min_points: row.minPoints,
    sort_order: row.sortOrder,
  }));
}

export async function fetchRankTiers(): Promise<{
  tiers: RankTierResponse[];
  cacheStatus: JsonCacheStatus;
}> {
  const cacheKey = rankTiersCacheKey();
  const cached = await readJsonCacheResult<RankTierResponse[]>(cacheKey);
  if (cached.value) {
    return { tiers: cached.value, cacheStatus: "HIT" };
  }

  const rows = await db.select().from(rankTiers).orderBy(asc(rankTiers.sortOrder));
  const tiers = toResponseTiers(rows);
  await writeJsonCache({
    key: cacheKey,
    value: tiers,
    ttlSeconds: passageCacheTtls.rankTiersSeconds,
  });

  return { tiers, cacheStatus: cached.status === "BYPASS" ? "BYPASS" : "MISS" };
}
