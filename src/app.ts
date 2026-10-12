import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { AppError } from "./http/errors.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLeadRoutes } from "./routes/leads.js";

interface HttpErrorLike {
  statusCode: number;
  code?: string;
  message: string;
}

function isHttpClientError(err: unknown): err is HttpErrorLike {
  if (typeof err === "object" && err !== null && "statusCode" in err) {
    const code = (err as { statusCode: unknown }).statusCode;
    return typeof code === "number" && code >= 400 && code < 500;
  }
  return false;
}

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(opts);

  // Centralized Error Handling matching Section 6 principles
  app.setErrorHandler((error: unknown, request, reply) => {
    const correlationId = request.id;

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          correlationId,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      });
    }

    // Fastify client errors (e.g. malformed JSON body)
    if (isHttpClientError(error)) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code ?? "BAD_REQUEST",
          message: error.message,
          correlationId,
        },
      });
    }

    // Unhandled server errors: log internally, never leak stack traces to client
    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected internal error occurred.",
        correlationId,
      },
    });
  });

  // Standardized 404 response
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found.`,
        correlationId: request.id,
      },
    });
  });

  // Register routes
  void app.register(registerHealthRoutes);
  void app.register(registerLeadRoutes);

  return app;
}
