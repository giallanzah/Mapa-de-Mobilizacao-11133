import { createInsertSchema } from "drizzle-zod";
import {
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const churchStatus = pgEnum("church_status", [
  "no_group",
  "group_ready",
  "action_done",
]);
export const flyerReportStatus = pgEnum("flyer_report_status", [
  "pending",
  "approved",
  "rejected",
]);
export const issueReportStatus = pgEnum("issue_report_status", [
  "open",
  "reviewed",
  "dismissed",
]);

export const churches = pgTable(
  "churches",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    regionCode: text("region_code").notNull(),
    regionName: text("region_name").notNull(),
    address: text("address"),
    locality: text("locality"),
    postalCode: text("postal_code"),
    phone: text("phone"),
    website: text("website"),
    socialUrl: text("social_url"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    mapsUrl: text("maps_url").notNull(),
    whatsappUrl: text("whatsapp_url"),
    flyersConfirmed: integer("flyers_confirmed").notNull().default(0),
    flyerGoal: integer("flyer_goal").notNull().default(100),
    status: churchStatus("status").notNull().default("no_group"),
    sourceId: text("source_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sourceIdIdx: uniqueIndex("churches_source_id_idx").on(table.sourceId),
  }),
);

export const flyerReports = pgTable("flyer_reports", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id")
    .notNull()
    .references(() => churches.id),
  actionDate: date("action_date").notNull(),
  flyerCount: integer("flyer_count").notNull(),
  volunteerName: text("volunteer_name").notNull(),
  volunteerPhone: text("volunteer_phone").notNull(),
  note: text("note"),
  status: flyerReportStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const issueReports = pgTable("issue_reports", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id")
    .notNull()
    .references(() => churches.id),
  issueType: text("issue_type").notNull(),
  note: text("note").notNull(),
  reporterName: text("reporter_name"),
  reporterContact: text("reporter_contact"),
  status: issueReportStatus("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertChurchSchema = createInsertSchema(churches).omit({
  id: true,
  createdAt: true,
});
export const insertFlyerReportSchema = createInsertSchema(flyerReports).omit({
  id: true,
  status: true,
  createdAt: true,
});
export const insertIssueReportSchema = createInsertSchema(issueReports).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type Church = typeof churches.$inferSelect;
export type FlyerReport = typeof flyerReports.$inferSelect;
export type IssueReport = typeof issueReports.$inferSelect;
export type ChurchInsert = z.infer<typeof insertChurchSchema>;