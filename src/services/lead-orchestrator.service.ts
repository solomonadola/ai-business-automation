import type {
  LeadRecord,
  WorkflowAttemptRecord,
} from "../domain/leads/types.js";
import {
  type LeadRepository,
  defaultLeadRepository,
} from "../adapters/database/leads.repository.js";
import {
  type LeadService,
  leadService as defaultLeadService,
} from "./lead.service.js";
import { type Notifier } from "../domain/notifications/notifier.interface.js";
import { defaultNotificationSink } from "../adapters/notifications/in-memory-sink.js";
import {
  executeWithRetry,
  isTransientError,
} from "../domain/workflows/retry-policy.js";
import { assertCanTransition } from "../domain/workflows/state-machine.js";
import { NotFoundError, AppError } from "../http/errors.js";

export class LeadOrchestratorService {
  constructor(
    private readonly repository: LeadRepository = defaultLeadRepository,
    private readonly leadService: LeadService = defaultLeadService,
    private readonly notifier: Notifier = defaultNotificationSink,
  ) {}

  /**
   * Executes the full end-to-end processing workflow for a lead:
   * 1. Validates current state
   * 2. Classifies lead using AI (if not already classified)
   * 3. Dispatches notification (with duplicate prevention and bounded retries)
   * 4. Transitions lead to 'completed'
   */
  public async processLeadWorkflow(leadId: string): Promise<LeadRecord> {
    const lead = await this.repository.findById(leadId);

    if (!lead) {
      throw new NotFoundError(`Lead with ID '${leadId}' not found.`);
    }

    // Idempotency: If already completed, safely return existing state with zero side effects
    if (lead.status === "completed" && lead.notificationSent) {
      return lead;
    }

    const attemptNumber = await this.repository.incrementAttempts(leadId);

    // Step 1: AI Lead Classification
    let classifiedLead = lead;
    if (lead.status !== "classified" || lead.fitScore === undefined) {
      assertCanTransition(lead.status, "classifying");

      try {
        await this.repository.recordWorkflowAttempt({
          leadId,
          step: "classification",
          attemptNumber,
          status: "retrying",
        });

        classifiedLead = await this.leadService.classifyLead(leadId);

        await this.repository.recordWorkflowAttempt({
          leadId,
          step: "classification",
          attemptNumber,
          status: "success",
          metadata: {
            score: classifiedLead.fitScore,
            category: classifiedLead.category,
            action: classifiedLead.recommendedAction,
          },
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.repository.recordWorkflowAttempt({
          leadId,
          step: "classification",
          attemptNumber,
          status: "failed",
          errorMessage: errorMsg,
        });
        throw err;
      }
    }

    // Step 2: Sales Team Notification (with deduplication guard)
    if (classifiedLead.notificationSent) {
      // Notification already delivered previously; mark completed safely
      const completedLead = await this.repository.updateStatus(
        leadId,
        "completed",
      );
      return completedLead ?? classifiedLead;
    }

    assertCanTransition(classifiedLead.status, "notification_pending");
    await this.repository.updateStatus(leadId, "notification_pending");

    try {
      const notificationResult = await executeWithRetry(
        async (retryAttempt) => {
          try {
            return await this.notifier.send({
              leadId: classifiedLead.id,
              recipient: "sales-team@company.internal",
              subject: `[Lead Alert] ${classifiedLead.category?.toUpperCase()}: ${classifiedLead.name}`,
              name: classifiedLead.name,
              email: classifiedLead.email,
              company: classifiedLead.company,
              category: classifiedLead.category ?? "medium_fit",
              score: classifiedLead.fitScore ?? 50,
              recommendedAction:
                classifiedLead.recommendedAction ?? "send_info_packet",
              summary:
                classifiedLead.reasoningSummary ??
                "Lead submitted for workflow automation review.",
              attemptNumber: retryAttempt,
              idempotencyKey: classifiedLead.idempotencyKey,
            });
          } catch (err: unknown) {
            const errObj = err instanceof Error ? err : new Error(String(err));
            await this.repository.recordWorkflowAttempt({
              leadId,
              step: "notification",
              attemptNumber: retryAttempt,
              status: isTransientError(errObj) ? "retrying" : "failed",
              errorMessage: errObj.message,
            });
            throw errObj;
          }
        },
        { maxRetries: 3, baseDelayMs: 50 },
      );

      // Transition to 'completed' and record notification metadata
      const completedLead = await this.repository.updateNotificationSent(
        leadId,
        notificationResult.messageId,
      );

      await this.repository.recordWorkflowAttempt({
        leadId,
        step: "notification",
        attemptNumber,
        status: "success",
        metadata: {
          messageId: notificationResult.messageId,
          provider: notificationResult.provider,
          deliveredAt: notificationResult.deliveredAt,
        },
      });

      return completedLead ?? classifiedLead;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.repository.recordFailure(
        leadId,
        `Notification delivery failed: ${errorMsg}`,
      );
      throw new AppError(
        `Workflow notification failed: ${errorMsg}`,
        502,
        "NOTIFICATION_FAILED",
      );
    }
  }

  /**
   * Safely retries a failed lead workflow:
   * Clears transient failure status and re-executes eligible workflow steps
   */
  public async retryFailedLead(leadId: string): Promise<LeadRecord> {
    const lead = await this.repository.findById(leadId);

    if (!lead) {
      throw new NotFoundError(`Lead with ID '${leadId}' not found.`);
    }

    if (lead.status !== "failed") {
      throw new AppError(
        `Lead is currently in '${lead.status}' status. Only leads in 'failed' status can be retried.`,
        400,
        "INVALID_STATE_FOR_RETRY",
      );
    }

    return this.processLeadWorkflow(leadId);
  }

  public async getFailedLeads(): Promise<LeadRecord[]> {
    return this.repository.findFailedLeads();
  }

  public async getWorkflowHistory(
    leadId: string,
  ): Promise<WorkflowAttemptRecord[]> {
    return this.repository.getWorkflowAttempts(leadId);
  }
}

export const leadOrchestratorService = new LeadOrchestratorService();
