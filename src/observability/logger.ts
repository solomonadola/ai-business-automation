import { type FastifyServerOptions } from "fastify";
import { config } from "../config.js";

/**
 * Fields and paths that must be censored if logged to prevent leaking
 * credentials, tokens, cookies, or secrets into log sinks.
 */
export const LOG_REDACT_PATHS: string[] = [
  "req.headers.authorization",
  "req.headers['x-webhook-secret']",
  "req.headers.cookie",
  "req.headers['set-cookie']",
  "body.password",
  "body.apiKey",
  "body.secret",
  "body.token",
  "password",
  "apiKey",
  "secret",
  "token",
  "*.password",
  "*.apiKey",
  "*.secret",
  "*.token",
];

export interface StructuredLoggerOptions {
  level?: string;
  isTest?: boolean;
}

/**
 * Generates Pino structured logger options for Fastify.
 * Standardizes log formatting, log levels, and automatic secret redaction.
 */
export function getLoggerConfig(
  opts: StructuredLoggerOptions = {},
): FastifyServerOptions["logger"] {
  const isTest = opts.isTest ?? config.NODE_ENV === "test";

  if (isTest) {
    return false;
  }

  const level =
    opts.level ?? (config.NODE_ENV === "production" ? "info" : "debug");

  return {
    level,
    redact: {
      paths: LOG_REDACT_PATHS,
      censor: "[REDACTED]",
    },
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url,
          host: req.headers.host,
          remoteAddress: req.socket?.remoteAddress,
          userAgent: req.headers["user-agent"],
        };
      },
    },
  };
}
