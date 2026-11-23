import { pgTable, text, jsonb, timestamp, uuid, varchar, json, integer, index } from "drizzle-orm/pg-core";
export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const adminUsersTable = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true })
});
export const sessionsTable = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull()
}, t => [index("session_expire_idx").on(t.expire)]);
export const loginAttemptsTable = pgTable("login_attempts", {
  ip: text("ip").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull()
});
export const storageDeletionsTable = pgTable("storage_deletions", {
  storageKey: text("storage_key").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const appSeedTable = pgTable("app_seed", {
  key: text("key").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const schemaMigrationsTable = pgTable("schema_migrations", {
  name: text("name").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow()
});
