import { decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const assessments = mysqlTable("assessments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  mode: mysqlEnum("mode", ["demo", "live"]).notNull(),
  analyzedAt: timestamp("analyzedAt").defaultNow().notNull(),
  startDate: varchar("startDate", { length: 32 }).notNull(),
  startTime: varchar("startTime", { length: 16 }).notNull(),
  thresholdC: decimal("thresholdC", { precision: 6, scale: 2 }).notNull(),
  industry: varchar("industry", { length: 120 }).notNull().default("Industrial operations"),
  operationalContext: text("operationalContext"),
  siteCount: int("siteCount").notNull(),
  criticalCount: int("criticalCount").notNull(),
  highCount: int("highCount").notNull(),
  anomalyCount: int("anomalyCount").notNull(),
  complianceCount: int("complianceCount").notNull(),
  summary: text("summary"),
  sitesJson: json("sitesJson").notNull(),
  resultsJson: json("resultsJson").notNull(),
  flagsJson: json("flagsJson").notNull(),
  actionsJson: json("actionsJson"),
});

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = typeof assessments.$inferInsert;