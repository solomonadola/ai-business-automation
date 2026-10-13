import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const leadsTable = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: varchar("idempotency_key", { length: 64 })
      .notNull()
      .unique(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    company: varchar("company", { length: 100 }),
    website: varchar("website", { length: 255 }),
    message: text("message").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("received"),
    fitScore: integer("fit_score"),
    category: varchar("category", { length: 32 }),
    recommendedAction: varchar("recommended_action", { length: 32 }),
    reasoningSummary: text("reasoning_summary"),
    failureReason: text("failure_reason"),
    classifiedAt: timestamp("classified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_leads_email_created_at").on(table.email, table.createdAt),
  ],
);

export type LeadDbRow = typeof leadsTable.$inferSelect;
export type NewLeadDbRow = typeof leadsTable.$inferInsert;
