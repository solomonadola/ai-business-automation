import { createHash } from "node:crypto";
import type { LeadRecord } from "../domain/leads/types.js";
import { validateAndNormalizeLead } from "../domain/leads/validation.js";
import {
  type LeadRepository,
  defaultLeadRepository,
  type CreateLeadResult,
} from "../adapters/database/leads.repository.js";
import { ValidationError } from "../http/errors.js";

export class LeadService {
  constructor(
    private readonly repository: LeadRepository = defaultLeadRepository,
  ) {}

  /**
   * Processes an incoming lead submission:
   * 1. Validates and normalizes input fields
   * 2. Resolves or generates a deterministic idempotency key
   * 3. Atomically persists to database with deduplication guarantees
   */
  public async receiveLead(
    input: unknown,
    providedIdempotencyKey?: string,
  ): Promise<CreateLeadResult> {
    const validation = validateAndNormalizeLead(input);

    if (!validation.success) {
      throw new ValidationError(
        "The request contains invalid fields.",
        validation.errors,
      );
    }

    // Determine idempotency key: use client-provided key or compute SHA-256 fingerprint
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

    return result;
  }

  public async getLeadById(id: string): Promise<LeadRecord | null> {
    return this.repository.findById(id);
  }

  private resolveIdempotencyKey(
    email: string,
    message: string,
    providedKey?: string,
  ): string {
    if (providedKey && providedKey.trim().length > 0) {
      // Clean and sanitize provided key, truncating to 64 chars if necessary
      return providedKey.trim().slice(0, 64);
    }

    // Natural deduplication fingerprint based on normalized email and message
    return createHash("sha256").update(`${email}:${message}`).digest("hex");
  }
}

export const leadService = new LeadService();
