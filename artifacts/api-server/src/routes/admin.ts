import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { pool } from "@workspace/db";
import {
  CreateApartmentBody, CreateApartmentResponse, UpdateApartmentBody, UpdateApartmentResponse,
  ListAdminApartmentsResponse, UpdatePhotoBody, ReorderPhotosBody, UpdateSettingsBody,
  GetAdminSettingsResponse, UpdateSettingsResponse
} from "@workspace/api-zod";
import { apartments, settings } from "../services/catalog";
import { uploadPhotos, flushDeletions, HttpError } from "../services/photos";
import { invalidatePublic } from "./public";

const router: IRouter = Router();
const uuid = z.string().uuid();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 20, fields: 0, parts: 20 } }).array("photos", 20);

router.get("/apartments", async (_req, res) => { res.json(ListAdminApartmentsResponse.parse(await apartments(true))); });
router.post("/apartments", async (req, res) => {
  const a = CreateApartmentBody.parse(req.body);
  const result = await pool.query(`INSERT INTO apartments(slug,name,blurb,description,price_per_night,highlights,amenities,is_available,is_featured,is_sample,sort_order)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11) RETURNING id`,
  [a.slug, a.name, a.blurb, a.description || "", a.price_per_night, JSON.stringify(a.highlights), JSON.stringify(a.amenities), a.is_available, a.is_featured, a.is_sample || false, a.sort_order]);
  invalidatePublic();
  res.status(201).json(CreateApartmentResponse.parse((await apartments(true, result.rows[0].id))[0]));
});
router.patch("/apartments/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const data = UpdateApartmentBody.parse(req.body);
  const fields = Object.entries(data);
  if (!fields.length) throw new HttpError(400, "Provide at least one field to update.");
  // Column names come only from the strict generated schema, never user-provided identifiers.
  const allowed = new Set(["slug", "name", "blurb", "description", "price_per_night", "highlights", "amenities", "is_available", "is_featured", "is_sample", "sort_order"]);
  const selected = fields.filter(([key]) => allowed.has(key));
  const result = await pool.query(`UPDATE apartments SET ${selected.map(([key], i) => `${key}=$${i + 2}${["highlights", "amenities"].includes(key) ? "::jsonb" : ""}`).join(",")},updated_at=now() WHERE id=$1 RETURNING id`, [id, ...selected.map(([key, value]) => ["highlights", "amenities"].includes(key) ? JSON.stringify(value) : value)]);
  if (!result.rowCount) throw new HttpError(404, "Apartment not found.");
  invalidatePublic();
  res.json(UpdateApartmentResponse.parse((await apartments(true, id))[0]));
});
router.delete("/apartments/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!(await client.query("SELECT id FROM apartments WHERE id=$1 FOR UPDATE", [id])).rowCount) throw new HttpError(404, "Apartment not found.");
    await client.query("INSERT INTO storage_deletions(storage_key) SELECT storage_key FROM photos WHERE apartment_id=$1 ON CONFLICT DO NOTHING", [id]);
    await client.query("DELETE FROM apartments WHERE id=$1", [id]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  invalidatePublic();
  try { await flushDeletions(); }
  catch { throw new HttpError(503, "Apartment deleted. Photo file cleanup is queued and will retry when persistent storage is reachable."); }
  res.status(204).end();
});
router.post("/apartments/:id/photos", (req, _res, next) => {
  uuid.parse(req.params.id);
  next();
}, upload, async (req, res) => {
  const id = uuid.parse(req.params.id);
  await uploadPhotos(id, req.files as Express.Multer.File[] || []);
  invalidatePublic();
  res.status(201).json((await apartments(true, id))[0].photo_records);
});
router.post("/gallery", upload, async (req, res) => {
  await uploadPhotos(null, req.files as Express.Multer.File[] || []);
  invalidatePublic();
  res.status(201).json({ ok: true });
});
router.patch("/photos/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { alt } = UpdatePhotoBody.parse(req.body);
  if (!(await pool.query("UPDATE photos SET alt=$1 WHERE id=$2 RETURNING id", [alt, id])).rowCount) throw new HttpError(404, "Photo not found.");
  invalidatePublic();
  res.json({ ok: true });
});
router.delete("/photos/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reference = (await client.query("SELECT apartment_id FROM photos WHERE id=$1", [id])).rows[0];
    if (!reference) throw new HttpError(404, "Photo not found.");
    if (reference.apartment_id) await client.query("SELECT id FROM apartments WHERE id=$1 FOR UPDATE", [reference.apartment_id]);
    const photo = (await client.query("SELECT storage_key FROM photos WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!photo) throw new HttpError(404, "Photo not found.");
    await client.query("INSERT INTO storage_deletions(storage_key) VALUES($1) ON CONFLICT DO NOTHING", [photo.storage_key]);
    await client.query("DELETE FROM photos WHERE id=$1", [id]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  invalidatePublic();
  try { await flushDeletions(); }
  catch { throw new HttpError(503, "Photo removed from the site. File cleanup is queued and will retry when storage is reachable."); }
  res.status(204).end();
});
router.put("/apartments/:id/photos/order", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { photoIds } = ReorderPhotosBody.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!(await client.query("SELECT id FROM apartments WHERE id=$1 FOR UPDATE", [id])).rowCount) throw new HttpError(404, "Apartment not found.");
    const existing = (await client.query("SELECT id FROM photos WHERE apartment_id=$1", [id])).rows.map(r => r.id);
    if (existing.length !== photoIds.length || new Set(photoIds).size !== photoIds.length || photoIds.some(x => !existing.includes(x))) throw new HttpError(400, "Photo order must contain each of this apartment's photos exactly once.");
    for (const [order, photoId] of photoIds.entries()) await client.query("UPDATE photos SET sort_order=$1 WHERE id=$2 AND apartment_id=$3", [order, photoId, id]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  invalidatePublic();
  res.status(204).end();
});
router.put("/apartments/:id/cover/:photoId", async (req, res) => {
  const id = uuid.parse(req.params.id), photoId = uuid.parse(req.params.photoId);
  const result = await pool.query("UPDATE apartments SET cover_photo_id=$1,updated_at=now() WHERE id=$2 AND EXISTS(SELECT 1 FROM photos WHERE id=$1 AND apartment_id=$2) RETURNING id", [photoId, id]);
  if (!result.rowCount) throw new HttpError(404, "This photo does not belong to that apartment.");
  invalidatePublic();
  res.status(204).end();
});
router.get("/settings", async (_req, res) => { res.json(GetAdminSettingsResponse.parse(await settings())); });
router.put("/settings", async (req, res) => {
  const data = UpdateSettingsBody.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of Object.entries(data)) await client.query("INSERT INTO settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()", [key, JSON.stringify(value)]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  invalidatePublic();
  res.json(UpdateSettingsResponse.parse(await settings()));
});
export default router;
