import bcrypt from "bcrypt";
import { pool } from "@workspace/db";

export const amenities = ["Fully furnished short let apartments", "Quick booking", "24/7 electricity", "24/7 Wi-Fi", "DStv and smart TV", "Attached Ubers", "Ample parking space", "CCTV-covered compound", "24/7 customer support"];
export const defaultSettings = {
  whatsapp_number: "2348066164126",
  whatsapp_display: "+234 8066 164 126",
  email: "info.thedonsplace@gmail.com",
  address: "25A Addo Road, Opp. Ecobank, Ajah, Lagos",
  business_name: "The Don's Place",
  owner: "DAH Properties",
  amenities,
  terms: "Booking and payment\nAll bookings and payments are handled through our WhatsApp line. A booking is confirmed only after we reply and confirm payment on WhatsApp.\n\nCheck-in and check-out\nWe confirm check-in and check-out times with you on WhatsApp when you book.\n\nCancellations\nWe agree cancellation terms with you on WhatsApp before you pay.\n\nHouse rules\n- Treat the apartment and furnishings with care.\n- Respect other guests and neighbours.\n- Park only in the parking space provided.\n\nManagement can update this page with the final policies."
};

export async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(39180413)");
    for (const [key, value] of Object.entries(defaultSettings)) {
      await client.query("INSERT INTO settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING", [key, JSON.stringify(value)]);
    }
    const marker = await client.query("INSERT INTO app_seed(key) VALUES('initial-apartments') ON CONFLICT DO NOTHING RETURNING key");
    if (marker.rowCount && !(await client.query("SELECT 1 FROM apartments LIMIT 1")).rowCount) {
      const samples = [
        ["studio-apartment", "Studio Apartment", 45000, "A fully furnished studio for solo travellers and short business stays."],
        ["one-bedroom-apartment", "One-Bedroom Apartment", 65000, "A fully furnished one-bedroom apartment with a separate bedroom and living space."],
        ["two-bedroom-apartment", "Two-Bedroom Apartment", 95000, "A fully furnished two-bedroom apartment for families and small groups."]
      ];
      for (const [index, sample] of samples.entries()) {
        const apartment = await client.query("INSERT INTO apartments(slug,name,price_per_night,blurb,description,highlights,amenities,is_sample,is_featured,sort_order) VALUES($1,$2,$3,$4,$4,$5::jsonb,$6::jsonb,true,true,$7) RETURNING id", [...sample, JSON.stringify(amenities.slice(2, 5)), JSON.stringify(amenities), index]);
        const photo = await client.query("INSERT INTO photos(apartment_id,storage_key,url,thumb_url,alt) VALUES($1,'seed:sample-room','/assets/sample-room.jpg','/assets/sample-room.jpg',$2) RETURNING id", [apartment.rows[0].id, `${sample[1]} — sample photo; replace with your own`]);
        await client.query("UPDATE apartments SET cover_photo_id=$1 WHERE id=$2", [photo.rows[0].id, apartment.rows[0].id]);
      }
    }
    if (!(await client.query("SELECT 1 FROM admin_users LIMIT 1")).rowCount) {
      const username = process.env.ADMIN_USERNAME;
      const password = process.env.ADMIN_PASSWORD;
      if (!username || !password) throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required to initialize the administrator.");
      if (Buffer.byteLength(password, "utf8") > 72) throw new Error("Initial admin password must be at most 72 UTF-8 bytes for bcrypt.");
      await client.query("INSERT INTO admin_users(username,password_hash) VALUES($1,$2)", [username, await bcrypt.hash(password, 12)]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
