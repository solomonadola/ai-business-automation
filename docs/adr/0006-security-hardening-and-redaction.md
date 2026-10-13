# ADR 0006: Security Hardening, Observability, and Log Redaction

## Status

Accepted

## Context

Production services handling lead and contact information must guard against Denial of Service (DoS), sensitive data leakage, credential exposure in centralized log collectors, and timing side-channel attacks.

## Decision

1. **Defensive HTTP Headers**:
   Integrated `@fastify/helmet` to inject strict security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy: no-referrer`, and strict `Content-Security-Policy`).
2. **Resource Exhaustion Controls**:
   - Registered `@fastify/rate-limit` enforcing a default 100 requests per minute per IP limit (`HTTP 429 RATE_LIMIT_EXCEEDED`).
   - Configured `bodyLimit: 104857` (100 KB max body size) rejecting oversized requests with `HTTP 413 PAYLOAD_TOO_LARGE`.
3. **Correlation ID Tracing**:
   Every incoming request is assigned or preserves a correlation UUID (`x-request-id`). This identifier is propagated to response headers and attached to every structured error envelope.
4. **Pino Structured Redaction**:
   All Fastify/Pino loggers automatically censor sensitive paths (`req.headers.authorization`, `req.headers['x-webhook-secret']`, `req.headers.cookie`, `apiKey`, `password`, `secret`, `token`) replacing values with `[REDACTED]`.

## Consequences

- Protects downstream log aggregators from storing credentials.
- Error responses remain informative and traceable while never exposing internal stack traces.
