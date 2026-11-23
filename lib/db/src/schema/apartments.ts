import { pgTable, uuid, text, integer, jsonb, boolean, timestamp, check, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const apartmentsTable = pgTable("apartments", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  blurb: text("blurb").notNull(),
  description: text("description").notNull().default(""),
  pricePerNight: integer("price_per_night").notNull(),
  highlights: jsonb("highlights").notNull().default([]),
  amenities: jsonb("amenities").notNull().default([]),
  isAvailable: boolean("is_available").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  isSample: boolean("is_sample").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  coverPhotoId: uuid("cover_photo_id").references((): AnyPgColumn => photosTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, t => [check("apartments_price_per_night_check", sql`${t.pricePerNight} >= 0`)]);
export const photosTable = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  apartmentId: uuid("apartment_id").references((): AnyPgColumn => apartmentsTable.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  url: text("url").notNull(),
  thumbUrl: text("thumb_url"),
  alt: text("alt").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, t => [index("photos_apartment_order_idx").on(t.apartmentId, t.sortOrder)]);
