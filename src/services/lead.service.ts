import { createHash } from "node:crypto";
import type { LeadRecord } from "../domain/leads/types.js";
import { validateAndNormalizeLead } from "../domain/leads/validation.js";
import {
  type LeadRepository,
  defaultLeadRepository,
  type CreateLeadResult,
} from "../adapters/database/leads.repository.js";
import type { LeadClassifier } from "../domain/classification/classifier.interface.js";
import { defaultMockClassifier } from "../adapters/llm/mock-classifier.js";
import { ValidationError, NotFoundError, AppError } from "../http/errors.js";

export class LeadService {
  constructor(
    private readonly repository: LeadRepository = defaultLeadRepository,
    private readonly classifier: LeadClassifier = defaultMockClassifier,
  ) {}

  /**
   * Processes an incoming lead submission:
   * 1. Validates and normalizes input fields
   * 2. Resolves or generates a deterministic idempotency key
   * 3. Atomically persists to database with deduplication guarantees
   * 4. Optionally runs classification immediately if autoClassify is enabled
   */
  public async receiveLead(
    input: unknown,
    providedIdempotencyKey?: string,
    autoClassify = false,
  ): Promise<CreateLeadResult> {
    const validation = validateAndNormalizeLead(input);

    if (!validation.success) {
      throw new ValidationError(
        "The request contains invalid fields.",
        validation.errors,
      );
    }

    const idempotencyKey = this.resolveIdempotencyKey(
      validation.data.email,
      validation.data.message,
      providedIdempotencyKey,
    );

    const result = await this.repository.createOrGetByIdempotencyKey({
      idempotencyKey,
      name: validation.data.name,
      email: validation.data.email,
      company: validation.data.company,
      website: validation.data.website,
      message: validation.data.message,
    });

    if (
      autoClassify &&
      !result.isDuplicate &&
      result.lead.status === "received"
    ) {
      try {
        const classifiedLead = await this.classifyLead(result.lead.id);
        return {
          lead: classifiedLead,
          isDuplicate: false,
        };
      } catch {
        // If classification fails during intake, lead is safely persisted in 'failed' status
        const updated = await this.repository.findById(result.lead.id);
        return {
          lead: updated ?? result.lead,
          isDuplicate: false,
        };
      }
    }

    return result;
  }

  /**
   * Classifies a stored lead using the configured LLM classifier.
   * Enforces cost controls by reusing existing classification results.
   */
  public async classifyLead(id: string): Promise<LeadRecord> {
    const lead = await this.repository.findById(id);

    if (!lead) {
      throw new NotFoundError(`Lead with ID '${id}' not found.`);
    }

    // Cost Control: Do not re-call LLM if already classified with valid score
    if (lead.status === "classified" && lead.fitScore !== undefined) {
      return lead;
    }

    // Transition to 'classifying'
    await this.repository.updateStatus(id, "classifying");

    try {
      const classification = await this.classifier.classify({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        company: lead.company,
        website: lead.website,
        message: lead.message,
      });

      const updated = await this.repository.updateClassification(
        id,
        classification,
      );
      if (!updated) {
        throw new AppError("Failed to persist classification result", 500);
      }

      return updated;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.repository.recordFailure(id, errorMessage);
      throw new AppError(
        `Lead classification failed: ${errorMessage}`,
        502,
        "CLASSIFICATION_FAILED",
      );
    }
  }

  public async getLeadById(id: string): Promise<LeadRecord | null> {
    return this.repository.findById(id);
  }

  public async getRecentLeads(limit = 20): Promise<LeadRecord[]> {
    return this.repository.findRecentLeads(limit);
  }

  private resolveIdempotencyKey(
    email: string,
    message: string,
    providedKey?: string,
  ): string {
    if (providedKey && providedKey.trim().length > 0) {
      return providedKey.trim().slice(0, 64);
    }

    return createHash("sha256").update(`${email}:${message}`).digest("hex");
  }
}

export const leadService = new LeadService();
