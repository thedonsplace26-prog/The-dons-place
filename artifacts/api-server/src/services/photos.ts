import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function storedFile(key: string) {
  const directory = process.env.PRIVATE_OBJECT_DIR;
  if (!directory) throw new HttpError(503, "Persistent photo storage is not configured yet. Please finish App Storage setup.");
  const [bucket, ...prefix] = directory.replace(/^\/+/, "").split("/");
  if (!bucket) throw new HttpError(503, "Persistent photo storage is not configured.");
  return objectStorageClient.bucket(bucket).file([...prefix, key].filter(Boolean).join("/"));
}
function isImage(bytes: Buffer) {
  return (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
    (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP");
}

export async function uploadPhotos(apartmentId: string | null, files: Express.Multer.File[]) {
  if (!files.length) throw new HttpError(400, "Choose at least one JPG, PNG or WebP photo.");
  // Reject before processing if the persistent bucket hasn't been provisioned.
  storedFile("configuration-check");
  const processed: { id: string; full: Buffer; thumb: Buffer }[] = [];
  for (const file of files) {
    if (!isImage(file.buffer)) throw new HttpError(400, "Only genuine JPG, PNG and WebP images are accepted.");
    try {
      const image = sharp(file.buffer, { limitInputPixels: 40_000_000, animated: false, failOn: "error" });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || "") || (metadata.pages || 1) > 1) throw new Error("Unsupported image");
      processed.push({
        id: randomUUID(),
        full: await image.clone().rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
        thumb: await image.clone().rotate().resize({ width: 600, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
      });
    } catch { throw new HttpError(400, "An image could not be read. Use a valid, non-animated JPG, PNG or WebP under 40 megapixels."); }
  }
  const client = await pool.connect();
  const uploaded: string[] = [];
  try {
    await client.query("BEGIN");
    let position = 0;
    if (apartmentId) {
      if (!(await client.query("SELECT id FROM apartments WHERE id=$1 FOR UPDATE", [apartmentId])).rowCount) throw new HttpError(404, "Apartment not found.");
      const count = Number((await client.query("SELECT count(*) AS n FROM photos WHERE apartment_id=$1", [apartmentId])).rows[0].n);
      if (count + files.length > 20) throw new HttpError(400, "Each apartment can have at most 20 photos.");
      position = Number((await client.query("SELECT coalesce(max(sort_order),-1)+1 AS n FROM photos WHERE apartment_id=$1", [apartmentId])).rows[0].n);
    }
    for (const photo of processed) {
      for (const [suffix, bytes] of [["webp", photo.full], ["thumb.webp", photo.thumb]] as const) {
        const key = `photos/${photo.id}.${suffix}`;
        uploaded.push(key);
        await storedFile(key).save(bytes, { resumable: false, contentType: "image/webp", metadata: { cacheControl: "public, max-age=31536000, immutable" } });
      }
      const key = `photos/${photo.id}`;
      await client.query("INSERT INTO photos(id,apartment_id,storage_key,url,thumb_url,sort_order) VALUES($1,$2,$3,$4,$5,$6)", [photo.id, apartmentId, key, `/api/images/${photo.id}.webp`, `/api/images/${photo.id}.thumb.webp`, position++]);
    }
    if (apartmentId) await client.query("UPDATE apartments SET cover_photo_id=coalesce(cover_photo_id,$1),updated_at=now() WHERE id=$2", [processed[0].id, apartmentId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    // Failed uploads are also durably tracked for retry, never silently orphaned.
    for (const key of new Set(uploaded.map(x => x.replace(/\.(thumb\.)?webp$/, "")))) {
      await pool.query("INSERT INTO storage_deletions(storage_key) VALUES($1) ON CONFLICT DO NOTHING", [key]);
    }
    await flushDeletions().catch(err => logger.warn({ err }, "Upload cleanup queued for retry"));
    throw error;
  } finally { client.release(); }
}

let flushing = false;
export async function flushDeletions() {
  if (flushing) return;
  flushing = true;
  try {
    const pending = await pool.query("SELECT storage_key FROM storage_deletions ORDER BY created_at LIMIT 100");
    for (const { storage_key: key } of pending.rows) {
      if (!key.startsWith("seed:")) {
        await Promise.all([storedFile(`${key}.webp`).delete({ ignoreNotFound: true }), storedFile(`${key}.thumb.webp`).delete({ ignoreNotFound: true })]);
      }
      await pool.query("DELETE FROM storage_deletions WHERE storage_key=$1", [key]);
    }
  } finally { flushing = false; }
}
export function photoFile(id: string, thumb: boolean) {
  return storedFile(`photos/${id}.${thumb ? "thumb." : ""}webp`);
}
