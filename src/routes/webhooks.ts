import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { webhookAuthHook } from "../http/middleware/webhook-auth.js";
import { leadService } from "../services/lead.service.js";
import { leadOrchestratorService } from "../services/lead-orchestrator.service.js";

export async function registerWebhookRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/api/webhooks/n8n/leads",
    {
      preHandler: webhookAuthHook,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Check for idempotency key from n8n headers
      const rawIdempotencyKey =
        request.headers["idempotency-key"] ??
        request.headers["x-idempotency-key"];
      const idempotencyKey =
        typeof rawIdempotencyKey === "string" ? rawIdempotencyKey : undefined;

      // 1. Intake the lead (with database deduplication)
      const { lead, isDuplicate } = await leadService.receiveLead(
        request.body,
        idempotencyKey,
      );

      // If duplicate delivery, return existing state safely
      if (isDuplicate) {
        return reply.status(200).header("x-idempotent-replay", "true").send({
          success: true,
          data: lead,
          isDuplicate: true,
          correlationId: request.id,
        });
      }

      // 2. Execute full workflow (classification + notification + completion)
      const completedLead = await leadOrchestratorService.processLeadWorkflow(
        lead.id,
      );

      return reply.status(201).send({
        success: true,
        data: completedLead,
        isDuplicate: false,
        correlationId: request.id,
      });
    },
  );
}
