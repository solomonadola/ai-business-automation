import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { registerHealthRoutes } from "./routes/health.js";

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(opts);

  // Register routes
  void app.register(registerHealthRoutes);

  return app;
}
