import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { leadService } from "../services/lead.service.js";
import { NotFoundError } from "../http/errors.js";

export async function registerLeadRoutes(app: FastifyInstance): Promise<void> {
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
}
