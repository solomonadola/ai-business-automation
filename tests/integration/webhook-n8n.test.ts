import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { clearLeadsTable, getLeadCount } from "../helpers/db.js";
import { closeDatabasePool } from "../../src/adapters/database/client.js";
import { defaultNotificationSink } from "../../src/adapters/notifications/in-memory-sink.js";
import { config } from "../../src/config.js";

describe("n8n Inbound Webhook Integration", () => {
  const app = buildApp({ logger: false });

  beforeAll(async () => {
    await clearLeadsTable();
  });

  beforeEach(async () => {
    await clearLeadsTable();
    defaultNotificationSink.clear();
  });

  afterAll(async () => {
    await clearLeadsTable();
    defaultNotificationSink.clear();
    await app.close();
    await closeDatabasePool();
  });

  const validLeadPayload = {
    name: "Linus Torvalds",
    email: "linus@kernel.org",
    company: "Linux Foundation",
    website: "https://kernel.org",
    message:
      "Need automated workflows to classify kernel patches and inquiries.",
  };

  it("accepts authenticated webhook from n8n and executes full workflow", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/webhooks/n8n/leads",
      headers: {
        "x-webhook-secret": config.WEBHOOK_SECRET,
      },
      payload: validLeadPayload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.isDuplicate).toBe(false);
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe("completed");
    expect(body.data.fitScore).toBe(88);
    expect(body.data.category).toBe("high_fit");
    expect(body.data.notificationSent).toBe(true);

    const count = await getLeadCount();
    expect(count).toBe(1);
  });

  it("rejects unauthenticated webhook request missing secret header with 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/webhooks/n8n/leads",
      payload: validLeadPayload,
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("Missing X-Webhook-Secret");
  });

  it("rejects webhook request with invalid secret token with 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/webhooks/n8n/leads",
      headers: {
        "x-webhook-secret": "fraudulent-tampered-secret",
      },
      payload: validLeadPayload,
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("Invalid webhook secret token");
  });

  it("safely handles duplicate webhook deliveries via idempotency key", async () => {
    const key = "n8n-delivery-event-12345";

    // First delivery
    const res1 = await app.inject({
      method: "POST",
      url: "/api/webhooks/n8n/leads",
      headers: {
        "x-webhook-secret": config.WEBHOOK_SECRET,
        "x-idempotency-key": key,
      },
      payload: validLeadPayload,
    });

    expect(res1.statusCode).toBe(201);
    const id1 = res1.json().data.id;

    // Second duplicate delivery
    const res2 = await app.inject({
      method: "POST",
      url: "/api/webhooks/n8n/leads",
      headers: {
        "x-webhook-secret": config.WEBHOOK_SECRET,
        "x-idempotency-key": key,
      },
      payload: validLeadPayload,
    });

    expect(res2.statusCode).toBe(200);
    expect(res2.headers["x-idempotent-replay"]).toBe("true");
    const body2 = res2.json();
    expect(body2.isDuplicate).toBe(true);
    expect(body2.data.id).toBe(id1);

    // Assert strictly 1 record exists in PostgreSQL
    const count = await getLeadCount();
    expect(count).toBe(1);
  });

  it("rejects malformed webhook payloads with 400 Bad Request", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/webhooks/n8n/leads",
      headers: {
        "x-webhook-secret": config.WEBHOOK_SECRET,
      },
      payload: {
        name: "",
        email: "bad-email-format",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.details)).toBe(true);
  });
});
