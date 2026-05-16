import { refreshPassageSearchCatalog } from "../lib/cache/passage-search-catalog";

async function main() {
  const result = await refreshPassageSearchCatalog({ status: "active" });
  console.log(
    JSON.stringify({
      ok: true,
      key: result.key,
      count: result.count,
      storage: result.storage,
    }),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});
