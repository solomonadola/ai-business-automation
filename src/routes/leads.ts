import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { leadService } from "../services/lead.service.js";

export async function registerLeadRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/leads",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const lead = await leadService.receiveLead(request.body);

      return reply.status(201).send({
        success: true,
        data: lead,
        correlationId: request.id,
      });
    },
  );
}
