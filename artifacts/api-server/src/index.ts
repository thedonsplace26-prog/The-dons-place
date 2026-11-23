import app from "./app";
import { logger } from "./lib/logger";
import { seed } from "./services/seed";
import { flushDeletions } from "./services/photos";

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

await seed();
const cleanup = setInterval(() => { void flushDeletions().catch(err => logger.warn({ err }, "Persistent photo cleanup will retry")); }, 60_000);
cleanup.unref();
app.listen(port, "0.0.0.0", (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
