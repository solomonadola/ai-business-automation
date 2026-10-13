import { eq, desc, asc, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db as defaultDb } from "./client.js";
import * as schema from "./schema.js";
import {
  leadsTable,
  workflowAttemptsTable,
  type LeadDbRow,
  type WorkflowAttemptDbRow,
} from "./schema.js";
import type {
  LeadRecord,
  NewLeadRecord,
  LeadProcessingStatus,
  WorkflowAttemptRecord,
} from "../../domain/leads/types.js";
import type {
  LeadClassification,
  LeadCategory,
  RecommendedAction,
} from "../../domain/classification/types.js";

export interface CreateLeadResult {
  lead: LeadRecord;
  isDuplicate: boolean;
}

export interface LeadRepository {
  createOrGetByIdempotencyKey(data: NewLeadRecord): Promise<CreateLeadResult>;
  findById(id: string): Promise<LeadRecord | null>;
  findByEmail(email: string): Promise<LeadRecord[]>;
  findFailedLeads(): Promise<LeadRecord[]>;
  updateStatus(
    id: string,
    status: LeadProcessingStatus,
  ): Promise<LeadRecord | null>;
  updateClassification(
    id: string,
    classification: LeadClassification,
  ): Promise<LeadRecord | null>;
  updateNotificationSent(
    id: string,
    messageId: string,
  ): Promise<LeadRecord | null>;
  recordFailure(id: string, failureReason: string): Promise<LeadRecord | null>;
  incrementAttempts(id: string): Promise<number>;
  recordWorkflowAttempt(
    data: Omit<WorkflowAttemptRecord, "id" | "createdAt">,
  ): Promise<WorkflowAttemptRecord>;
  getWorkflowAttempts(leadId: string): Promise<WorkflowAttemptRecord[]>;
}

export class PgLeadRepository implements LeadRepository {
  private readonly database: NodePgDatabase<typeof schema>;

  constructor(database?: NodePgDatabase<typeof schema>) {
    this.database = database ?? defaultDb;
  }

  public async createOrGetByIdempotencyKey(
    data: NewLeadRecord,
  ): Promise<CreateLeadResult> {
    const inserted = await this.database
      .insert(leadsTable)
      .values({
        idempotencyKey: data.idempotencyKey,
        name: data.name,
        email: data.email,
        company: data.company,
        website: data.website,
        message: data.message,
        status: "received",
      })
      .onConflictDoNothing({ target: leadsTable.idempotencyKey })
      .returning();

    if (inserted.length > 0 && inserted[0]) {
      return {
        lead: this.mapToRecord(inserted[0]),
        isDuplicate: false,
      };
    }

    const existing = await this.database
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.idempotencyKey, data.idempotencyKey))
      .limit(1);

    if (existing.length === 0 || !existing[0]) {
      throw new Error(
        `Failed to insert or retrieve lead with idempotencyKey: ${data.idempotencyKey}`,
      );
    }

    return {
      lead: this.mapToRecord(existing[0]),
      isDuplicate: true,
    };
  }

  public async findById(id: string): Promise<LeadRecord | null> {
    const rows = await this.database
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.id, id))
      .limit(1);

    if (!rows[0]) return null;
    return this.mapToRecord(rows[0]);
  }

  public async findByEmail(email: string): Promise<LeadRecord[]> {
    const rows = await this.database
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.email, email))
      .orderBy(desc(leadsTable.createdAt));

    return rows.map((r) => this.mapToRecord(r));
  }

  public async findFailedLeads(): Promise<LeadRecord[]> {
    const rows = await this.database
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.status, "failed"))
      .orderBy(desc(leadsTable.updatedAt));

    return rows.map((r) => this.mapToRecord(r));
  }

  public async updateStatus(
    id: string,
    status: LeadProcessingStatus,
  ): Promise<LeadRecord | null> {
    const updated = await this.database
      .update(leadsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(leadsTable.id, id))
      .returning();

    if (!updated[0]) return null;
    return this.mapToRecord(updated[0]);
  }

  public async updateClassification(
    id: string,
    classification: LeadClassification,
  ): Promise<LeadRecord | null> {
    const updated = await this.database
      .update(leadsTable)
      .set({
        status: "classified",
        fitScore: classification.score,
        category: classification.category,
        recommendedAction: classification.recommendedAction,
        reasoningSummary: classification.reasoningSummary,
        failureReason: null,
        classifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, id))
      .returning();

    if (!updated[0]) return null;
    return this.mapToRecord(updated[0]);
  }

  public async updateNotificationSent(
    id: string,
    messageId: string,
  ): Promise<LeadRecord | null> {
    const updated = await this.database
      .update(leadsTable)
      .set({
        status: "completed",
        notificationSent: true,
        notificationMessageId: messageId,
        notificationSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, id))
      .returning();

    if (!updated[0]) return null;
    return this.mapToRecord(updated[0]);
  }

  public async recordFailure(
    id: string,
    failureReason: string,
  ): Promise<LeadRecord | null> {
    const updated = await this.database
      .update(leadsTable)
      .set({
        status: "failed",
        failureReason,
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, id))
      .returning();

    if (!updated[0]) return null;
    return this.mapToRecord(updated[0]);
  }

  public async incrementAttempts(id: string): Promise<number> {
    const updated = await this.database
      .update(leadsTable)
      .set({
        processingAttempts: sql`${leadsTable.processingAttempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, id))
      .returning({ attempts: leadsTable.processingAttempts });

    return updated[0]?.attempts ?? 1;
  }

  public async recordWorkflowAttempt(
    data: Omit<WorkflowAttemptRecord, "id" | "createdAt">,
  ): Promise<WorkflowAttemptRecord> {
    const inserted = await this.database
      .insert(workflowAttemptsTable)
      .values({
        leadId: data.leadId,
        step: data.step,
        attemptNumber: data.attemptNumber,
        status: data.status,
        errorMessage: data.errorMessage,
        metadata: data.metadata,
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      throw new Error("Failed to record workflow attempt");
    }

    return this.mapAttemptToRecord(row);
  }

  public async getWorkflowAttempts(
    leadId: string,
  ): Promise<WorkflowAttemptRecord[]> {
    const rows = await this.database
      .select()
      .from(workflowAttemptsTable)
      .where(eq(workflowAttemptsTable.leadId, leadId))
      .orderBy(asc(workflowAttemptsTable.createdAt));

    return rows.map((r) => this.mapAttemptToRecord(r));
  }

  private mapToRecord(row: LeadDbRow): LeadRecord {
    return {
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      name: row.name,
      email: row.email,
      company: row.company ?? undefined,
      website: row.website ?? undefined,
      message: row.message,
      status: row.status as LeadProcessingStatus,
      fitScore: row.fitScore ?? undefined,
      category: (row.category as LeadCategory) ?? undefined,
      recommendedAction:
        (row.recommendedAction as RecommendedAction) ?? undefined,
      reasoningSummary: row.reasoningSummary ?? undefined,
      failureReason: row.failureReason ?? undefined,
      classifiedAt: row.classifiedAt?.toISOString(),
      notificationSent: row.notificationSent,
      notificationMessageId: row.notificationMessageId ?? undefined,
      notificationSentAt: row.notificationSentAt?.toISOString(),
      processingAttempts: row.processingAttempts,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapAttemptToRecord(row: WorkflowAttemptDbRow): WorkflowAttemptRecord {
    return {
      id: row.id,
      leadId: row.leadId,
      step: row.step as WorkflowAttemptRecord["step"],
      attemptNumber: row.attemptNumber,
      status: row.status as WorkflowAttemptRecord["status"],
      errorMessage: row.errorMessage ?? undefined,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const defaultLeadRepository = new PgLeadRepository();
