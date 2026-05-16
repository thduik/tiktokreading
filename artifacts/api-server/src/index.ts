import app from "./app";
import { ensurePassageSearchCatalogWarm } from "./lib/cache/passage-search-catalog";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void ensurePassageSearchCatalogWarm({ status: "active" })
    .then((result) => {
      logger.info(result, "Passage search catalog ready");
    })
    .catch((error) => {
      logger.warn({ err: error }, "Failed to initialize passage search catalog");
    });
});
