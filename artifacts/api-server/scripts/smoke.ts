// Development API smoke checks. Does not read or alter the owner's credentials.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { pool } from "@workspace/db";

if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production") throw new Error("Development checks only.");
const username = `smoke-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
const octet = 1 + randomBytes(1)[0] % 125;
const testIps = [`203.0.113.${octet}`, `203.0.113.${octet + 128}`];
let ip = testIps[0];
let cookie = "", csrf = "", apartmentId = "", adminId = "";
async function request(method: string, path: string, body?: unknown, expected = 200) {
  const response = await fetch(`http://localhost:80/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https", "X-Forwarded-For": ip, ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const set = response.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const data = await response.json().catch(() => null);
  assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  return data;
}
try {
  const user = await pool.query("INSERT INTO admin_users(username,password_hash) VALUES($1,$2) RETURNING id", [username, await bcrypt.hash(password, 12)]);
  adminId = user.rows[0].id;
  await request("GET", "/health");
  const publicList = await request("GET", "/apartments");
  assert.ok(publicList.length >= 3);
  await request("GET", "/admin/me", undefined, 401);
  await request("POST", "/admin/apartments", {}, 401);
  csrf = (await request("GET", "/admin/csrf")).csrfToken;
  assert.ok(cookie, "Secure session cookie must be returned through the HTTPS proxy.");
  const savedToken = csrf;
  csrf = "invalid";
  await request("POST", "/admin/login", { username, password }, 403);
  csrf = savedToken;
  csrf = (await request("POST", "/admin/login", { username, password })).csrfToken;
  assert.equal((await request("GET", "/admin/me")).username, username);
  const input = { name: "API smoke apartment", slug: `smoke-${randomUUID()}`, blurb: "Temporary development test", description: "", price_per_night: 12345, highlights: [], amenities: [], is_available: true, is_featured: false, is_sample: false, sort_order: 100 };
  apartmentId = (await request("POST", "/admin/apartments", input, 201)).id;
  await request("PATCH", `/admin/apartments/${apartmentId}`, { price_per_night: -1 }, 400);
  await request("PATCH", `/admin/apartments/${apartmentId}`, { price_per_night: 54321 });
  assert.equal((await request("GET", `/apartments/${input.slug}`)).price, 54321);
  await request("PATCH", `/admin/apartments/${apartmentId}`, { is_available: false });
  await request("GET", `/apartments/${input.slug}`, undefined, 404);
  assert.ok(!(await request("GET", "/apartments")).some((a: { id: string }) => a.id === apartmentId));
  await request("PUT", `/admin/apartments/${apartmentId}/photos/order`, { photoIds: [] }, 204);
  await request("PUT", `/admin/apartments/${apartmentId}/cover/${randomUUID()}`, undefined, 404);
  const contact = await request("GET", "/admin/settings");
  await request("PUT", "/admin/settings", contact);
  await request("POST", "/admin/password", { currentPassword: "wrong", newPassword: password + "abc" }, 400);
  const changed = randomBytes(24).toString("hex");
  await request("POST", "/admin/password", { currentPassword: password, newPassword: changed }, 204);
  await request("DELETE", `/admin/apartments/${apartmentId}`, undefined, 204);
  apartmentId = "";
  await request("POST", "/admin/logout", undefined, 204);
  await request("GET", "/admin/me", undefined, 401);
  csrf = (await request("GET", "/admin/csrf")).csrfToken;
  await request("POST", "/admin/login", { username, password }, 401);
  csrf = (await request("POST", "/admin/login", { username, password: changed })).csrfToken;
  await request("POST", "/admin/logout", undefined, 204);
  ip = testIps[1];
  csrf = (await request("GET", "/admin/csrf")).csrfToken;
  for (let i = 0; i < 5; i++) await request("POST", "/admin/login", { username, password: "not-the-password" }, 401);
  await request("POST", "/admin/login", { username, password: changed }, 429);
  console.info("PASS: health, public data, authentication, CSRF, apartment CRUD, price freshness, availability, validation, settings, password change, logout, five-attempt login lockout.");
} finally {
  if (apartmentId) await pool.query("DELETE FROM apartments WHERE id=$1", [apartmentId]);
  if (adminId) {
    await pool.query("DELETE FROM session WHERE sess->>'adminId'=$1", [adminId]);
    await pool.query("DELETE FROM admin_users WHERE id=$1", [adminId]);
  }
  await pool.query("DELETE FROM login_attempts WHERE ip=ANY($1::text[])", [testIps]);
  await pool.end();
}
