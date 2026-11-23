import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { GetApartmentParams, GetApartmentResponse, GetGalleryResponse, GetSettingsResponse, ListApartmentsResponse } from "@workspace/api-zod";
import { apartments, gallery, settings } from "../services/catalog";
import { photoFile, HttpError } from "../services/photos";

const router: IRouter = Router();
// Revalidate every read so price edits are immediate while allowing 60s shared caching.
export let publicVersion = Date.now();
export function invalidatePublic() { publicVersion = Math.max(Date.now(), publicVersion + 1); }
router.get("/health", (_req, res) => { res.json({ ok: true }); });
router.get("/apartments", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=60, no-cache");
  // Never cache in-process: every response sees committed administrator edits.
  res.json(ListApartmentsResponse.parse(await apartments()));
});
router.get("/apartments/:slug", async (req, res) => {
  const { slug } = GetApartmentParams.parse(req.params);
  const result = (await apartments()).find(a => a.slug === slug);
  if (!result) throw new HttpError(404, "Apartment not found.");
  res.set("Cache-Control", "public, max-age=60, no-cache");
  res.json(GetApartmentResponse.parse(result));
});
router.get("/gallery", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=60, no-cache");
  res.json(GetGalleryResponse.parse(await gallery()));
});
router.get("/settings", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=60, no-cache");
  res.json(GetSettingsResponse.parse(await settings()));
});
router.get("/images/:filename", async (req, res) => {
  const match = /^([a-f0-9-]{36})\.(thumb\.)?webp$/.exec(String(req.params.filename));
  if (!match || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(match[1])) throw new HttpError(404, "Photo not found.");
  if (!(await pool.query("SELECT 1 FROM photos WHERE id=$1 AND storage_key NOT LIKE 'seed:%'", [match[1]])).rowCount) throw new HttpError(404, "Photo not found.");
  const file = photoFile(match[1], !!match[2]);
  if (!(await file.exists())[0]) throw new HttpError(404, "Photo not found.");
  res.set({ "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" });
  file.createReadStream().on("error", () => { if (!res.headersSent) res.status(503).end(); else res.destroy(); }).pipe(res);
});
router.get("/seo", async (_req, res) => {
  const s = await settings();
  let siteUrl: string | null = null;
  if (process.env.SITE_URL) {
    const url = new URL(process.env.SITE_URL);
    if (url.protocol === "https:") siteUrl = url.origin;
  }
  res.json({ siteUrl, business: {
    "@context": "https://schema.org", "@type": "LodgingBusiness",
    name: s.business_name, address: s.address, telephone: `+${s.whatsapp_number}`,
    email: s.email, ...(siteUrl ? { url: siteUrl } : {})
  } });
});
function xml(x: string) { return x.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!); }
router.get("/sitemap.xml", async (_req, res) => {
  if (!process.env.SITE_URL) throw new HttpError(503, "The canonical site URL will be configured after publishing.");
  const origin = new URL(process.env.SITE_URL).origin;
  const urls = ["/", "/apartments.html", "/gallery.html", "/contact.html", "/terms.html", ...(await apartments()).map(a => `/apartment.html?slug=${encodeURIComponent(a.slug)}`)];
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(p => `<url><loc>${xml(origin + p)}</loc></url>`).join("")}</urlset>`);
});
export default router;
