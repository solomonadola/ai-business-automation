import type { FastifyInstance } from "fastify";
import { checkDatabaseHealth } from "../adapters/database/client.js";

export async function registerHealthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/health", async () => {
    const databaseUp = await checkDatabaseHealth();
    return {
      status: databaseUp ? "ok" : "degraded",
      database: databaseUp ? "up" : "down",
      timestamp: new Date().toISOString(),
    };
  });
}
