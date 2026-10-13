# Security Architecture & Controls

## 1. Overview

This document details the security posture, controls, and defense-in-depth principles implemented across the AI Business Automation platform.

---

## 2. Threat Model & Mitigations

| Threat                                            | Attack Vector                                                  | Mitigation in Place                                                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SQL Injection**                                 | Malicious characters in lead input or parameters               | Drizzle ORM strictly parameterizes all database queries. Raw dynamic string concatenation in SQL is prohibited.                                                                           |
| **Denial of Service (DoS / Resource Exhaustion)** | Oversized HTTP payloads or flood attacks                       | Fastify `bodyLimit: 104857` (100 KB payload cap) rejects oversized bodies with HTTP 413. `@fastify/rate-limit` enforces a 100 req/min per-IP ceiling returning HTTP 429.                  |
| **Timing Side-Channel Attacks**                   | Secret brute-forcing on webhooks                               | `crypto.timingSafeEqual` compares constant-length SHA-256 digests in `webhook-auth.ts`, preventing timing leakage.                                                                        |
| **Credential / Secret Leakage in Logs**           | Accidental logging of tokens or sensitive bodies               | Pino structured redaction automatically filters `authorization`, `x-webhook-secret`, `cookie`, `apiKey`, `password`, `secret`, and `token`.                                               |
| **Information Leakage via Stack Traces**          | Uncaught application exceptions leaking schema/internals       | Centralized `setErrorHandler` intercepts all unhandled errors, sanitizes error bodies, generates a correlation ID, and returns HTTP 500 without leaking stack traces.                     |
| **Clickjacking / MIME Sniffing / XSS**            | Browser injection attacks                                      | `@fastify/helmet` enforces strict headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict `Content-Security-Policy`, and HSTS.                                        |
| **Prompt Injection / Malformed AI Output**        | Adversarial text in lead `message` attempting to hijack output | Structured JSON schema validation with Zod (`ClassifierOutputSchema`) parses LLM output strictly. Controlled enums (`category`, `recommendedAction`) prevent arbitrary command execution. |
| **Outage Cascades / Slow LORIS**                  | Hanging third-party LLM or webhook requests                    | Outbound HTTP requests use explicit `AbortController` timeouts (10s max) and bounded exponential backoff retries.                                                                         |

---

## 3. Database Access Controls & Hardening

1. **Least-Privilege Role**:
   - In production environments, the application database user must not be `SUPERUSER` or `postgres`.
   - The user requires only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on tables `leads`, `workflow_attempts`, and `__drizzle_migrations`.
   - Table alterations (`DDL`) should run via migration scripts using a separate migration role.
2. **Encrypted Transport (TLS)**:
   - For cloud or hosted PostgreSQL (e.g. AWS RDS, GCP Cloud SQL, Supabase), connection strings must enforce `sslmode=require` or `sslmode=verify-full`.
3. **Connection Pooling**:
   - PostgreSQL connection pool size is bounded (`max: 10` connections per application instance) to prevent database exhaustion.

---

## 4. Webhook Authentication

Inbound webhooks (e.g. from n8n or external triggers) are authenticated via the `X-Webhook-Secret` header:

1. The secret is validated against the server configuration `WEBHOOK_SECRET`.
2. Validation uses timing-safe digest comparison:
   ```ts
   const providedHash = createHash("sha256").update(providedSecret).digest();
   const expectedHash = createHash("sha256").update(expectedSecret).digest();
   return timingSafeEqual(providedHash, expectedHash);
   ```
3. Outbound webhook deliveries to n8n include an HMAC SHA-256 signature (`X-Webhook-Signature`) generated from the payload and shared secret.

---

## 5. Observability and Redaction Standards

- **Correlation IDs**: All requests carry or generate an `x-request-id` UUID. This ID is propagated to client response headers, logged in Pino records (`reqId`), and attached to all error envelopes (`correlationId`).
- **Structured JSON Logging**: All logs are emitted in JSON format via Pino.
- **Redaction Rules**: The following JSON keys and header paths are automatically censored to `[REDACTED]`:
  - `req.headers.authorization`
  - `req.headers['x-webhook-secret']`
  - `req.headers.cookie`
  - `password`, `*.password`
  - `apiKey`, `*.apiKey`
  - `secret`, `*.secret`
  - `token`, `*.token`

---

## 6. Dependency Scanning & Audit Findings

- **Automated Scanning**: Security audits can be executed via `npm audit`.
- **Known Advisories**:
  - Drizzle ORM (< 0.45.2) and dev-dependencies (`tinypool`, `esbuild`) contain ecosystem advisories for dynamic SQL identifiers and prototype pollution in dev workers.
  - The codebase does not use dynamic SQL identifiers or untrusted worker options.
  - Upgrading to major versions (Vitest 5, Drizzle 0.45+) should be scheduled during routine maintenance windows.
