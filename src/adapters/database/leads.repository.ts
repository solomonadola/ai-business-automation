import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db as defaultDb } from "./client.js";
import * as schema from "./schema.js";
import { leadsTable, type LeadDbRow } from "./schema.js";
import type {
  LeadRecord,
  NewLeadRecord,
  LeadProcessingStatus,
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
  updateStatus(
    id: string,
    status: LeadProcessingStatus,
  ): Promise<LeadRecord | null>;
  updateClassification(
    id: string,
    classification: LeadClassification,
  ): Promise<LeadRecord | null>;
  recordFailure(id: string, failureReason: string): Promise<LeadRecord | null>;
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
      .where(eq(leadsTable.email, email));

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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export const defaultLeadRepository = new PgLeadRepository();
