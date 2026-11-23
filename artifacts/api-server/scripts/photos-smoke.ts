// Real development upload checks. Temporary records and storage objects only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import sharp from "sharp";
import { pool } from "@workspace/db";
import { photoFile, flushDeletions } from "../src/services/photos";

if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production") throw new Error("Development checks only.");
const username = `photos-smoke-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
const ip = `198.51.100.${1 + randomBytes(1)[0] % 250}`;
const testSlug = `photos-smoke-${randomUUID()}`;
const photoIds = new Set<string>();
let cookie = "", csrf = "", apartmentId = "", adminId = "";
const passed: string[] = [];
function pass(message: string) { passed.push(message); console.info(`PASS: ${message}`); }

async function request(method: string, route: string, body?: unknown, expected = 200, authenticated = true) {
  const multipart = body instanceof FormData;
  const response = await fetch(`http://localhost:80/api${route}`, {
    method,
    headers: {
      ...(!multipart ? { "Content-Type": "application/json" } : {}),
      "X-Forwarded-Proto": "https", "X-Forwarded-For": ip,
      ...(authenticated && cookie ? { Cookie: cookie } : {}),
      ...(authenticated && csrf ? { "X-CSRF-Token": csrf } : {})
    },
    body: multipart ? body : body === undefined ? undefined : JSON.stringify(body)
  });
  const set = response.headers.get("set-cookie");
  if (authenticated && set) cookie = set.split(";")[0];
  const data = await response.json().catch(() => null);
  assert.equal(response.status, expected, `${method} ${route}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  return data;
}
function form(files: { bytes: Uint8Array; name: string; type: string }[]) {
  const data = new FormData();
  for (const file of files) data.append("photos", new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name);
  return data;
}
async function records() {
  return (await request("GET", "/admin/apartments")).find((a: { id: string }) => a.id === apartmentId);
}
async function assertAbsent(id: string) {
  assert.deepEqual(await photoFile(id, false).exists(), [false], "Full image must be removed from persistent storage");
  assert.deepEqual(await photoFile(id, true).exists(), [false], "Thumbnail must be removed from persistent storage");
  await request("GET", `/images/${id}.webp`, undefined, 404, false);
}
try {
  adminId = (await pool.query("INSERT INTO admin_users(username,password_hash) VALUES($1,$2) RETURNING id", [username, await bcrypt.hash(password, 12)])).rows[0].id;
  csrf = (await request("GET", "/admin/csrf")).csrfToken;
  csrf = (await request("POST", "/admin/login", { username, password })).csrfToken;
  const a = await request("POST", "/admin/apartments", {
    name: "Temporary photo verification", slug: testSlug, blurb: "Temporary development test",
    description: "", price_per_night: 10000, highlights: [], amenities: [],
    is_available: true, is_featured: false, is_sample: false, sort_order: 1000
  }, 201);
  apartmentId = a.id;
  const jpeg = await readFile(new URL("../../the-dons-place/public/assets/sample-room.jpg", import.meta.url));
  const png = await readFile(new URL("../../the-dons-place/public/assets/logo.png", import.meta.url));
  const webp = await sharp(jpeg).resize({ width: 2200 }).webp().toBuffer();
  const files = [
    { bytes: jpeg, name: "room.jpg", type: "image/jpeg" },
    { bytes: png, name: "logo.png", type: "image/png" },
    { bytes: webp, name: "large-room.webp", type: "image/webp" }
  ];
  const endpoint = `/admin/apartments/${apartmentId}/photos`;
  await request("POST", endpoint, form([files[0]]), 401, false);
  const validToken = csrf;
  csrf = "invalid-token";
  await request("POST", endpoint, form([files[0]]), 403);
  csrf = validToken;
  pass("Unauthenticated and invalid-CSRF uploads rejected");
  const photos = await request("POST", endpoint, form(files), 201);
  assert.equal(photos.length, 3);
  photos.forEach((p: { id: string }) => photoIds.add(p.id));
  pass("Three actual JPEG, PNG and WebP images uploaded to persistent App Storage");
  for (const p of photos) {
    for (const thumb of [false, true]) {
      const object = photoFile(p.id, thumb);
      assert.deepEqual(await object.exists(), [true]);
      const [metadata] = await object.getMetadata();
      assert.equal(metadata.contentType, "image/webp");
      const response = await fetch(`http://localhost:80${thumb ? p.thumb_url : p.url}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/webp");
      const buffer = Buffer.from(await response.arrayBuffer());
      assert.ok(buffer.equals((await object.download())[0]), "Served bytes must match the persistent object");
      const image = await sharp(buffer).metadata();
      assert.equal(image.format, "webp");
      assert.ok(image.width! <= (thumb ? 600 : 1600));
    }
  }
  const large = photos[2];
  assert.equal((await sharp((await photoFile(large.id, false).download())[0]).metadata()).width, 1600);
  assert.equal((await sharp((await photoFile(large.id, true).download())[0]).metadata()).width, 600);
  pass("All six stored WebP variants served correctly; full images capped at 1600px and thumbnails at 600px");

  await request("PUT", `/admin/apartments/${apartmentId}/cover/${photos[1].id}`, undefined, 204);
  const order = [photos[2].id, photos[0].id, photos[1].id];
  await request("PUT", `/admin/apartments/${apartmentId}/photos/order`, { photoIds: order }, 204);
  const catalog = await request("GET", `/apartments/${testSlug}`);
  assert.equal(catalog.photos[0], photos[1].url);
  assert.equal(catalog.thumbnails[0], photos[1].thumb_url);
  for (const p of catalog.photo_records) assert.equal(p.sort_order, order.indexOf(p.id));
  await request("PATCH", `/admin/photos/${photos[0].id}`, { alt: "Verified furnished room" });
  assert.equal((await records()).photo_records.find((p: { id: string }) => p.id === photos[0].id).alt, "Verified furnished room");
  await request("PUT", `/admin/apartments/${apartmentId}/photos/order`, { photoIds: [photos[0].id] }, 400);
  pass("Cover first publicly, saved ordering, alt text updates and incomplete-order rejection");

  await request("POST", endpoint, form([{ bytes: Buffer.from("not an image"), name: "fake.jpg", type: "image/jpeg" }]), 400);
  await request("POST", endpoint, form([{ bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00]), name: "broken.jpg", type: "image/jpeg" }]), 400);
  await request("POST", endpoint, form([{ bytes: Buffer.alloc(5 * 1024 * 1024 + 1), name: "too-large.png", type: "image/png" }]), 400);
  const tiny = { bytes: await sharp(jpeg).resize({ width: 16 }).jpeg().toBuffer(), name: "tiny.jpg", type: "image/jpeg" };
  await request("POST", endpoint, form(Array.from({ length: 18 }, () => tiny)), 400);
  await request("POST", endpoint, form(Array.from({ length: 21 }, () => tiny)), 400);
  assert.equal((await records()).photo_records.length, 3);
  pass("Fake/corrupt files, over-5MB files, over-20-per-apartment and over-20-per-request uploads rejected without changing photos");

  await request("DELETE", `/admin/photos/${photos[1].id}`, undefined, 204);
  await assertAbsent(photos[1].id);
  assert.equal((await records()).cover_photo_id, null);
  pass("Deleting a cover photo removed both stored variants and cleared the cover reference");
  await request("DELETE", `/admin/apartments/${apartmentId}`, undefined, 204);
  apartmentId = "";
  for (const p of photos) await assertAbsent(p.id);
  assert.equal((await pool.query("SELECT 1 FROM photos WHERE id=ANY($1::uuid[])", [[...photoIds]])).rowCount, 0);
  assert.equal((await pool.query("SELECT 1 FROM storage_deletions WHERE storage_key=ANY($1::text[])", [[...photoIds].map(id => `photos/${id}`)])).rowCount, 0);
  pass("Deleting the apartment removed every remaining photo record and both persistent image variants; no queued cleanup left");

  const before = new Set((await request("GET", "/gallery")).map((p: { id: string }) => p.id));
  await request("POST", "/admin/gallery", form([files[0]]), 201);
  const general = (await request("GET", "/gallery")).filter((p: { id: string }) => !before.has(p.id));
  assert.equal(general.length, 1);
  assert.equal(general[0].apartment_id, null);
  photoIds.add(general[0].id);
  assert.deepEqual(await photoFile(general[0].id, false).exists(), [true]);
  await request("DELETE", `/admin/photos/${general[0].id}`, undefined, 204);
  await assertAbsent(general[0].id);
  pass("General gallery upload, public listing and persistent deletion");
  await request("POST", "/admin/logout", undefined, 204);
  console.info(`ALL ${passed.length} PHOTO CHECK GROUPS PASSED. Temporary test records and objects removed.`);
} finally {
  // Cleanup is scoped to this run's temporary apartment/user and tracked photo IDs.
  if (apartmentId) {
    const remaining = await pool.query("SELECT id FROM photos WHERE apartment_id=$1", [apartmentId]);
    remaining.rows.forEach(p => photoIds.add(p.id));
  }
  if (photoIds.size) {
    for (const id of photoIds) {
      await Promise.all([photoFile(id, false).delete({ ignoreNotFound: true }), photoFile(id, true).delete({ ignoreNotFound: true })]);
    }
    await pool.query("DELETE FROM photos WHERE id=ANY($1::uuid[])", [[...photoIds]]);
  }
  if (apartmentId) await pool.query("DELETE FROM apartments WHERE id=$1", [apartmentId]);
  if (adminId) {
    await pool.query("DELETE FROM session WHERE sess->>'adminId'=$1", [adminId]);
    await pool.query("DELETE FROM admin_users WHERE id=$1", [adminId]);
  }
  await pool.query("DELETE FROM login_attempts WHERE ip=$1", [ip]);
  await flushDeletions();
  await pool.end();
}
