import { randomUUID } from "node:crypto";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import helmet from "@fastify/helmet";
import rateLimit, { type RateLimitPluginOptions } from "@fastify/rate-limit";
import { AppError } from "./http/errors.js";
import { getLoggerConfig, LOG_REDACT_PATHS } from "./observability/logger.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLeadRoutes } from "./routes/leads.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerUiRoutes } from "./routes/ui.js";

export interface AppOptions extends FastifyServerOptions {
  rateLimit?: RateLimitPluginOptions | false;
}

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

export function buildApp(opts: AppOptions = {}): FastifyInstance {
  const { rateLimit: rateLimitOpts, ...fastifyOpts } = opts;

  let loggerOption: FastifyServerOptions["logger"] = fastifyOpts.logger;
  if (loggerOption === undefined) {
    loggerOption = getLoggerConfig();
  } else if (typeof loggerOption === "object" && loggerOption !== null) {
    const baseConfig = getLoggerConfig({ isTest: false });
    loggerOption = {
      ...(typeof baseConfig === "object" && baseConfig !== null
        ? baseConfig
        : {}),
      ...loggerOption,
      redact: {
        paths: LOG_REDACT_PATHS,
        censor: "[REDACTED]",
      },
    };
  }

  const app = Fastify({
    requestIdHeader: "x-request-id",
    genReqId: (req) =>
      (typeof req.headers["x-request-id"] === "string" &&
        req.headers["x-request-id"].length > 0 &&
        req.headers["x-request-id"]) ||
      randomUUID(),
    bodyLimit: 104857, // 100 KB max body size cap
    connectionTimeout: 10000,
    keepAliveTimeout: 5000,
    ...fastifyOpts,
    logger: loggerOption,
  });

  // Attach correlation ID to every outgoing response header
  app.addHook("onSend", async (request, reply) => {
    void reply.header("x-request-id", request.id);
  });

  // Register security headers (Helmet)
  void app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
    frameguard: { action: "deny" },
  });

  // Register rate limiting unless explicitly disabled
  if (rateLimitOpts !== false) {
    void app.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute",
      ...rateLimitOpts,
    });
  }

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

    // Fastify client errors (e.g. malformed JSON, rate limits, body limits)
    if (isHttpClientError(error)) {
      let code = error.code;
      if (!code) {
        if (error.statusCode === 429) {
          code = "RATE_LIMIT_EXCEEDED";
        } else if (error.statusCode === 413) {
          code = "PAYLOAD_TOO_LARGE";
        } else {
          code = "BAD_REQUEST";
        }
      } else if (code === "FST_ERR_CTP_BODY_TOO_LARGE") {
        code = "PAYLOAD_TOO_LARGE";
      }

      return reply.status(error.statusCode).send({
        error: {
          code,
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
  void app.register(registerUiRoutes);
  void app.register(registerHealthRoutes);
  void app.register(registerLeadRoutes);
  void app.register(registerWebhookRoutes);

  return app;
}
