import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
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
    notificationSent: boolean("notification_sent").default(false).notNull(),
    notificationMessageId: varchar("notification_message_id", { length: 128 }),
    notificationSentAt: timestamp("notification_sent_at", {
      withTimezone: true,
    }),
    processingAttempts: integer("processing_attempts").default(0).notNull(),
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

export const workflowAttemptsTable = pgTable(
  "workflow_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leadsTable.id, { onDelete: "cascade" }),
    step: varchar("step", { length: 32 }).notNull(), // 'classification' | 'notification'
    attemptNumber: integer("attempt_number").notNull(),
    status: varchar("status", { length: 32 }).notNull(), // 'success' | 'failed' | 'retrying'
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_workflow_attempts_lead_id").on(table.leadId, table.createdAt),
  ],
);

export type LeadDbRow = typeof leadsTable.$inferSelect;
export type NewLeadDbRow = typeof leadsTable.$inferInsert;
export type WorkflowAttemptDbRow = typeof workflowAttemptsTable.$inferSelect;
export type NewWorkflowAttemptDbRow = typeof workflowAttemptsTable.$inferInsert;
