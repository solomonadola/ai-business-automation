import { randomUUID } from "node:crypto";
import type { LeadRecord } from "../domain/leads/types.js";
import { validateAndNormalizeLead } from "../domain/leads/validation.js";
import { ValidationError } from "../http/errors.js";

export class LeadService {
  /**
   * Processes an incoming lead submission:
   * 1. Validates schema and fields
   * 2. Normalizes strings and email
   * 3. Creates the intake record with 'received' state
   */
  public async receiveLead(input: unknown): Promise<LeadRecord> {
    const validation = validateAndNormalizeLead(input);

    if (!validation.success) {
      throw new ValidationError(
        "The request contains invalid fields.",
        validation.errors,
      );
    }

    const leadRecord: LeadRecord = {
      id: randomUUID(),
      ...validation.data,
      status: "received",
      createdAt: new Date().toISOString(),
    };

    return leadRecord;
  }
}

export const leadService = new LeadService();
