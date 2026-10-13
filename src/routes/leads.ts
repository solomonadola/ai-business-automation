import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { leadService } from "../services/lead.service.js";
import { leadOrchestratorService } from "../services/lead-orchestrator.service.js";
import { NotFoundError } from "../http/errors.js";

export async function registerLeadRoutes(app: FastifyInstance): Promise<void> {
  // 1. Lead Intake
  app.post(
    "/api/leads",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rawIdempotencyKey = request.headers["idempotency-key"];
      const idempotencyKey =
        typeof rawIdempotencyKey === "string" ? rawIdempotencyKey : undefined;

      const { lead, isDuplicate } = await leadService.receiveLead(
        request.body,
        idempotencyKey,
      );

      if (isDuplicate) {
        return reply.status(200).header("x-idempotent-replay", "true").send({
          success: true,
          data: lead,
          isDuplicate: true,
          correlationId: request.id,
        });
      }

      return reply.status(201).send({
        success: true,
        data: lead,
        isDuplicate: false,
        correlationId: request.id,
      });
    },
  );

  // 2. List Recent Leads
  app.get(
    "/api/leads",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const leads = await leadService.getRecentLeads(25);
      return reply.status(200).send({
        success: true,
        data: leads,
        count: leads.length,
        correlationId: request.id,
      });
    },
  );

  // 3. List Failed Leads for Investigation
  app.get(
    "/api/leads/failed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const failedLeads = await leadOrchestratorService.getFailedLeads();

      return reply.status(200).send({
        success: true,
        data: failedLeads,
        count: failedLeads.length,
        correlationId: request.id,
      });
    },
  );

  // 3. Inspect Single Lead by ID
  app.get(
    "/api/leads/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const lead = await leadService.getLeadById(id);

      if (!lead) {
        throw new NotFoundError(`Lead with ID '${id}' not found.`);
      }

      return reply.status(200).send({
        success: true,
        data: lead,
        correlationId: request.id,
      });
    },
  );

  // 4. Trigger Classification Step
  app.post(
    "/api/leads/:id/classify",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const classifiedLead = await leadService.classifyLead(id);

      return reply.status(200).send({
        success: true,
        data: classifiedLead,
        correlationId: request.id,
      });
    },
  );

  // 5. Trigger Full Workflow Execution (Intake -> Classification -> Notification -> Complete)
  app.post(
    "/api/leads/:id/process",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const processedLead =
        await leadOrchestratorService.processLeadWorkflow(id);

      return reply.status(200).send({
        success: true,
        data: processedLead,
        correlationId: request.id,
      });
    },
  );

  // 6. Retry Failed Lead Workflow
  app.post(
    "/api/leads/:id/retry",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const retriedLead = await leadOrchestratorService.retryFailedLead(id);

      return reply.status(200).send({
        success: true,
        data: retriedLead,
        correlationId: request.id,
      });
    },
  );

  // 7. Inspect Lead Workflow Audit Attempts
  app.get(
    "/api/leads/:id/history",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const history = await leadOrchestratorService.getWorkflowHistory(id);

      return reply.status(200).send({
        success: true,
        data: history,
        correlationId: request.id,
      });
    },
  );
}
