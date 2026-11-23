import { pool } from "@workspace/db";

export async function settings() {
  const result = await pool.query("SELECT key,value FROM settings");
  return Object.fromEntries(result.rows.map(r => [r.key, r.value]));
}

export async function apartments(admin = false, id?: string) {
  const result = await pool.query(`SELECT a.*, a.price_per_night AS price FROM apartments a
    ${id ? "WHERE a.id=$1" : admin ? "" : "WHERE a.is_available=true"}
    ORDER BY a.sort_order,a.created_at`, id ? [id] : []);
  if (!result.rows.length) return [];
  const photos = await pool.query("SELECT id,apartment_id,url,thumb_url,alt,sort_order FROM photos WHERE apartment_id=ANY($1::uuid[]) ORDER BY sort_order,created_at", [result.rows.map(a => a.id)]);
  return result.rows.map(a => {
    const records = photos.rows.filter(p => p.apartment_id === a.id).sort((x, y) => Number(y.id === a.cover_photo_id) - Number(x.id === a.cover_photo_id) || x.sort_order - y.sort_order);
    return { ...a, photos: records.map(p => p.url), thumbnails: records.map(p => p.thumb_url || p.url), photo_records: records };
  });
}

export async function gallery() {
  return (await pool.query(`SELECT p.id,p.apartment_id,p.url,p.thumb_url,p.alt,p.sort_order FROM photos p
    LEFT JOIN apartments a ON a.id=p.apartment_id
    WHERE p.apartment_id IS NULL OR a.is_available=true ORDER BY p.sort_order,p.created_at`)).rows;
}
