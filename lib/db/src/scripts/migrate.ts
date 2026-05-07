import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running migrations.");
}

const migrationDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../migrations",
);

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationFiles = (await readdir(migrationDir))
      .filter((name) => name.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    if (migrationFiles.length === 0) {
      console.log("No migration files found.");
      return;
    }

    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(migrationDir, migrationFile);
      const migrationSql = await readFile(migrationPath, "utf8");
      const checksum = createHash("sha256").update(migrationSql).digest("hex");

      const existing = await client.query<{
        checksum: string;
      }>(
        "SELECT checksum FROM schema_migrations WHERE name = $1 LIMIT 1",
        [migrationFile],
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(
            `Migration ${migrationFile} already applied with different checksum.`,
          );
        }

        console.log(`Skipping already applied migration: ${migrationFile}`);
        continue;
      }

      console.log(`Applying migration: ${migrationFile}`);

      await client.query("BEGIN");
      try {
        await client.query(migrationSql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
          [migrationFile, checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("Migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
