import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import { buildApp } from "../../src/app.js";
import { LOG_REDACT_PATHS } from "../../src/observability/logger.js";
import { OpenAiCompatibleClassifier } from "../../src/adapters/llm/openai-classifier.js";
import { WebhookNotifier } from "../../src/adapters/notifications/webhook-notifier.js";

describe("Milestone 6: Security and Observability", () => {
  describe("Security Headers (Helmet)", () => {
    it("should set hardened security headers on HTTP responses", async () => {
      const app = buildApp({ logger: false });

      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["content-security-policy"]).toBeDefined();
      expect(response.headers["strict-transport-security"]).toContain(
        "max-age=",
      );
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
    });
  });

  describe("Correlation & Request ID Tracking", () => {
    it("should preserve client-supplied x-request-id in response headers and errors", async () => {
      const app = buildApp({ logger: false });
      const customId = "client-trace-id-9988";

      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: {
          "x-request-id": customId,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-request-id"]).toBe(customId);
    });

    it("should generate a UUID correlation ID when x-request-id is omitted and attach to error envelopes", async () => {
      const app = buildApp({ logger: false });

      const response = await app.inject({
        method: "GET",
        url: "/non-existent-route",
      });

      expect(response.statusCode).toBe(404);
      const generatedId = response.headers["x-request-id"] as string;
      expect(generatedId).toBeDefined();
      expect(generatedId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );

      const json = response.json();
      expect(json.error.code).toBe("NOT_FOUND");
      expect(json.error.correlationId).toBe(generatedId);
    });
  });

  describe("Request Size Limits (Payload Cap)", () => {
    it("should reject payloads exceeding body limit with 413 and standardized error code", async () => {
      // 100 KB default cap: test with a custom small limit app instance for fast verification
      const app = buildApp({
        logger: false,
        bodyLimit: 500, // 500 bytes max
      });

      const oversizedPayload = {
        name: "Test",
        email: "test@example.com",
        message: "X".repeat(1000), // ~1000 bytes > 500 byte cap
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/leads",
        payload: oversizedPayload,
      });

      expect(response.statusCode).toBe(413);
      const json = response.json();
      expect(json.error.code).toBe("PAYLOAD_TOO_LARGE");
      expect(json.error.correlationId).toBeDefined();
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limiting and return 429 when request threshold is exceeded", async () => {
      const app = buildApp({
        logger: false,
        rateLimit: {
          max: 2,
          timeWindow: 60000,
        },
      });

      // 1st request succeeds
      const res1 = await app.inject({ method: "GET", url: "/health" });
      expect(res1.statusCode).toBe(200);

      // 2nd request succeeds
      const res2 = await app.inject({ method: "GET", url: "/health" });
      expect(res2.statusCode).toBe(200);

      // 3rd request exceeds limit
      const res3 = await app.inject({ method: "GET", url: "/health" });
      expect(res3.statusCode).toBe(429);
      const json = res3.json();
      expect(json.error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(json.error.message).toContain("Rate limit exceeded");
      expect(json.error.correlationId).toBeDefined();
    });
  });

  describe("Structured Logging and Secret Redaction", () => {
    it("should redact sensitive fields and headers from log outputs", async () => {
      let loggedChunks = "";
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          loggedChunks += chunk.toString();
          callback();
        },
      });

      const app = buildApp({
        logger: {
          level: "info",
          stream,
        },
      });

      // Add a test route logging sensitive fields
      app.post("/test-logging", async (request) => {
        request.log.info(
          {
            apiKey: "secret-key-xyz",
            token: "oauth-bearer-token",
            password: "super-secret-password",
            unrelated: "public-metadata",
          },
          "Audit event",
        );
        return { ok: true };
      });

      await app.inject({
        method: "POST",
        url: "/test-logging",
        headers: {
          authorization: "Bearer secret-token-1234",
          "x-webhook-secret": "my-webhook-secret",
          cookie: "sessionId=supersecret",
        },
        payload: {
          test: true,
        },
      });

      expect(loggedChunks).toContain('"apiKey":"[REDACTED]"');
      expect(loggedChunks).toContain('"token":"[REDACTED]"');
      expect(loggedChunks).toContain('"password":"[REDACTED]"');
      expect(loggedChunks).toContain('"unrelated":"public-metadata"');
      expect(loggedChunks).not.toContain("secret-key-xyz");
      expect(loggedChunks).not.toContain("super-secret-password");
      expect(loggedChunks).not.toContain("secret-token-1234");
      expect(loggedChunks).not.toContain("my-webhook-secret");
    });

    it("should verify defined redaction paths include all required sensitive fields", () => {
      expect(LOG_REDACT_PATHS).toContain("req.headers.authorization");
      expect(LOG_REDACT_PATHS).toContain("req.headers['x-webhook-secret']");
      expect(LOG_REDACT_PATHS).toContain("req.headers.cookie");
      expect(LOG_REDACT_PATHS).toContain("password");
      expect(LOG_REDACT_PATHS).toContain("apiKey");
      expect(LOG_REDACT_PATHS).toContain("secret");
      expect(LOG_REDACT_PATHS).toContain("token");
    });
  });

  describe("Internal Server Error Sanitization", () => {
    it("should not leak stack traces or internal implementation details on 500 errors", async () => {
      const app = buildApp({ logger: false });

      app.get("/test-fault", async () => {
        throw new Error(
          "Internal secret database connection string: postgres://admin:supersecret@db",
        );
      });

      const response = await app.inject({
        method: "GET",
        url: "/test-fault",
      });

      expect(response.statusCode).toBe(500);
      const json = response.json();
      expect(json.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(json.error.message).toBe("An unexpected internal error occurred.");
      expect(json.error.correlationId).toBeDefined();
      expect(response.body).not.toContain("supersecret");
      expect(response.body).not.toContain("postgres://admin");
      expect(response.body).not.toContain("Error:");
    });
  });

  describe("Provider Outage & Timeout Handling", () => {
    it("should handle LLM classifier fetch timeout cleanly via AbortSignal", async () => {
      const slowClassifier = new OpenAiCompatibleClassifier({
        apiKey: "test-key",
        baseUrl: "http://10.255.255.1",
        timeoutMs: 1, // 1ms timeout triggers immediately
        maxRetries: 0, // No retries so test executes instantly
      });

      await expect(
        slowClassifier.classify({
          id: "lead-timeout-test",
          name: "Test",
          email: "test@example.com",
          message: "Automation request",
        }),
      ).rejects.toThrow("timed out");
    });

    it("should handle Webhook notifier network outage cleanly", async () => {
      const brokenNotifier = new WebhookNotifier({
        webhookUrl: "http://127.0.0.1:9999/webhook",
        timeoutMs: 50,
      });

      await expect(
        brokenNotifier.send({
          leadId: "lead-1",
          recipient: "test@example.com",
          subject: "Test",
          name: "Test",
          email: "test@example.com",
          category: "high_fit",
          score: 90,
          recommendedAction: "schedule_follow_up",
          summary: "Summary",
          attemptNumber: 1,
          idempotencyKey: "test-key-broken",
        }),
      ).rejects.toThrow(/fetch failed|Connection refused|ECONNREFUSED/);
    });

    it("should handle Webhook notifier timeout cleanly via AbortSignal", async () => {
      const slowNotifier = new WebhookNotifier({
        webhookUrl: "http://10.255.255.1/webhook",
        timeoutMs: 1,
      });

      await expect(
        slowNotifier.send({
          leadId: "lead-1",
          recipient: "test@example.com",
          subject: "Test",
          name: "Test",
          email: "test@example.com",
          category: "high_fit",
          score: 90,
          recommendedAction: "schedule_follow_up",
          summary: "Summary",
          attemptNumber: 1,
          idempotencyKey: "test-key-slow",
        }),
      ).rejects.toThrow("timed out");
    });
  });
});
