import express, { type Express } from "express";
import helmet from "helmet";
import compression from "compression";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "./services/photos";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
// Replit routes through loopback/private proxy hops. Trust their addresses,
// rather than a fixed hop count that would group all visitors under one proxy IP.
app.set("trust proxy", "loopback, linklocal, uniquelocal");
app.disable("x-powered-by");
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.get("X-Forwarded-Proto") === "http") {
    if (!process.env.SITE_URL) { res.status(503).json({ error: "Canonical site URL is not configured." }); return; }
    res.redirect(308, new URL(req.originalUrl, process.env.SITE_URL).href);
    return;
  }
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["https://www.google.com", "https://maps.google.com"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(compression());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use("/api", router);
app.use("/api", (_req, res) => { res.status(404).json({ error: "Endpoint not found." }); });
app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) { res.status(400).json({ error: error.issues.map(i => `${i.path.join(".") || "Input"}: ${i.message}`).join("; ") }); return; }
  if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof multer.MulterError) { res.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Each photo must be no larger than 5MB." : "Upload at most 20 photos using the photos field." }); return; }
  const code = (error as { code?: string })?.code;
  if (code === "23505") { res.status(409).json({ error: "An apartment with this slug already exists. Please choose a different slug." }); return; }
  if (code === "23503") { res.status(400).json({ error: "The related apartment or photo no longer exists." }); return; }
  if ((error as { status?: number })?.status === 400) { res.status(400).json({ error: "Invalid request body." }); return; }
  req.log.error({ err: error }, "Request failed");
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
