import { randomBytes, timingSafeEqual } from "node:crypto";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@workspace/db";
import type { RequestHandler } from "express";
import { allowedRequestOrigin, trustedSiteOrigins } from "../lib/trustedOrigins";

declare module "express-session" {
  interface SessionData {
    adminId?: string;
    username?: string;
    csrfToken?: string;
  }
}

const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error("SESSION_SECRET is required.");
const allowedOrigins = trustedSiteOrigins(process.env.SITE_URL, process.env.TRUSTED_SITE_ORIGINS);
const PgStore = connectPg(session);
export const sessionMiddleware = session({
  name: "dons.sid",
  secret,
  store: new PgStore({ pool, tableName: "session", createTableIfMissing: false }),
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: { httpOnly: true, secure: true, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 }
});
export function token(req: Express.Request & { session: session.Session & Partial<session.SessionData> }) {
  return req.session.csrfToken ||= randomBytes(32).toString("hex");
}
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.session.adminId) { res.status(401).json({ error: "Please log in to continue." }); return; }
  next();
};
export const csrf: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) { next(); return; }
  const incoming = req.get("X-CSRF-Token") || "";
  const expected = req.session.csrfToken || "";
  if (!incoming || !expected || Buffer.byteLength(incoming) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(incoming), Buffer.from(expected))) {
    res.status(403).json({ error: "Your security token has expired. Refresh the page and try again." }); return;
  }
  const origin = req.get("Origin");
  if (origin && !allowedRequestOrigin(origin, req.get("Host"), allowedOrigins)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." }); return;
  }
  next();
};
