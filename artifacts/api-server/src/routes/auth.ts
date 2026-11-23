import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { pool } from "@workspace/db";
import { AdminLoginBody, AdminLoginResponse, ChangePasswordBody, GetAdminMeResponse, GetCsrfResponse } from "@workspace/api-zod";
import { requireAdmin, csrf, token } from "../middlewares/admin";
import { HttpError } from "../services/photos";

const router: IRouter = Router();
const generic = "Invalid username or password. Please try again later if you've made several attempts.";
// Bcrypt work is bounded both in-process and across autoscale instances (Postgres below).
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: generic } });
const dummyHash = bcrypt.hash("unused-login-timing-value", 12);
router.get("/csrf", (req, res) => { res.json(GetCsrfResponse.parse({ csrfToken: token(req) })); });
router.post("/login", limiter, csrf, async (req, res) => {
  const input = AdminLoginBody.parse(req.body);
  const ip = req.ip || "unknown";
  const attempt = await pool.query(`INSERT INTO login_attempts(ip,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes')
    ON CONFLICT(ip) DO UPDATE SET
    attempts=CASE WHEN login_attempts.reset_at<=now() THEN 1 ELSE login_attempts.attempts+1 END,
    reset_at=CASE WHEN login_attempts.reset_at<=now() THEN now()+interval '15 minutes' ELSE login_attempts.reset_at END
    RETURNING attempts`, [ip]);
  if (attempt.rows[0].attempts > 5) throw new HttpError(429, generic);
  const user = (await pool.query("SELECT id,username,password_hash FROM admin_users WHERE username=$1", [input.username])).rows[0];
  const valid = await bcrypt.compare(input.password, user?.password_hash || await dummyHash);
  if (!user || !valid) throw new HttpError(401, generic);
  await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
  req.session.adminId = user.id;
  req.session.username = user.username;
  const csrfToken = token(req);
  await pool.query("UPDATE admin_users SET last_login_at=now() WHERE id=$1", [user.id]);
  await pool.query("DELETE FROM login_attempts WHERE ip=$1", [ip]);
  await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
  res.json(AdminLoginResponse.parse({ username: user.username, csrfToken }));
});
router.use(requireAdmin, csrf);
router.get("/me", (req, res) => { res.json(GetAdminMeResponse.parse({ username: req.session.username, csrfToken: token(req) })); });
router.post("/logout", async (req, res) => {
  await new Promise<void>((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
  res.clearCookie("dons.sid", { httpOnly: true, secure: true, sameSite: "lax" });
  res.status(204).end();
});
router.post("/password", async (req, res) => {
  const input = ChangePasswordBody.parse(req.body);
  if (Buffer.byteLength(input.newPassword, "utf8") > 72) throw new HttpError(400, "New password must be at most 72 UTF-8 bytes.");
  const user = (await pool.query("SELECT password_hash FROM admin_users WHERE id=$1", [req.session.adminId])).rows[0];
  if (!user || !await bcrypt.compare(input.currentPassword, user.password_hash)) throw new HttpError(400, "Current password is incorrect.");
  await pool.query("UPDATE admin_users SET password_hash=$1 WHERE id=$2", [await bcrypt.hash(input.newPassword, 12), req.session.adminId]);
  await pool.query("DELETE FROM session WHERE sess->>'adminId'=$1 AND sid<>$2", [req.session.adminId, req.sessionID]);
  res.status(204).end();
});
export default router;
