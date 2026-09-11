import { pgTable, text, timestamp, uuid, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertProfileSchema = createInsertSchema(profiles);
export const selectProfileSchema = createSelectSchema(profiles);
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

export const userReconstructions = pgTable("user_reconstructions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => profiles.id).notNull(),
  region: text("region").default("North Indian Ocean").notNull(),
  subregion: text("subregion").notNull(),
  sst: numeric("sst"),
  ssha: numeric("ssha"),
  sss: numeric("sss"),
  rmse: numeric("rmse"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserReconstructionSchema = createInsertSchema(userReconstructions);
export const selectUserReconstructionSchema = createSelectSchema(userReconstructions);
export type UserReconstruction = typeof userReconstructions.$inferSelect;
export type InsertUserReconstruction = typeof userReconstructions.$inferInsert;