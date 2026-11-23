import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// Development only. Managed production schema is applied by Replit Publish.
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Production schema changes must be applied through Replit Publish.");
}
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(39180412)");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const directory = path.resolve(import.meta.dirname, "../../../../migrations");
  for (const name of (await readdir(directory)).filter(x => /^\d+.*\.sql$/.test(x)).sort()) {
    if ((await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name])).rowCount) continue;
    await client.query(await readFile(path.join(directory, name), "utf8"));
    await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    logger.info({ migration: name }, "Applied development migration");
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
