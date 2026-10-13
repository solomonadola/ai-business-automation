import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { clearLeadsTable, getLeadCount } from "../helpers/db.js";
import { closeDatabasePool } from "../../src/adapters/database/client.js";

describe("Database Persistence & Idempotency Integration", () => {
  const app = buildApp({ logger: false });

  beforeAll(async () => {
    await clearLeadsTable();
  });

  beforeEach(async () => {
    await clearLeadsTable();
  });

  afterAll(async () => {
    await clearLeadsTable();
    await app.close();
    await closeDatabasePool();
  });

  it("persists a valid lead and assigns a database record", async () => {
    const payload = {
      name: "Taylor Swift",
      email: "taylor@example.com",
      company: "Music Corp",
      website: "https://taylorswift.com",
      message: "Looking to automate concert lead bookings.",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.isDuplicate).toBe(false);
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe("received");
    expect(body.data.email).toBe("taylor@example.com");

    // Confirm database row exists
    const count = await getLeadCount();
    expect(count).toBe(1);

    // Verify GET /api/leads/:id retrieves the persisted record
    const getResponse = await app.inject({
      method: "GET",
      url: `/api/leads/${body.data.id}`,
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().data.id).toBe(body.data.id);
  });

  it("deduplicates sequential identical submissions without creating duplicate records", async () => {
    const payload = {
      name: "Morgan Freeman",
      email: "morgan@example.com",
      message: "Need workflow automation for production studios.",
    };

    // First submission
    const res1 = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload,
    });

    expect(res1.statusCode).toBe(201);
    const body1 = res1.json();
    expect(body1.isDuplicate).toBe(false);
    const firstId = body1.data.id;

    // Second submission with exact same details
    const res2 = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload,
    });

    expect(res2.statusCode).toBe(200);
    expect(res2.headers["x-idempotent-replay"]).toBe("true");
    const body2 = res2.json();
    expect(body2.isDuplicate).toBe(true);
    expect(body2.data.id).toBe(firstId);

    // Third submission
    const res3 = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload,
    });

    expect(res3.statusCode).toBe(200);
    expect(res3.json().data.id).toBe(firstId);

    // Assert that the database contains strictly 1 record
    const count = await getLeadCount();
    expect(count).toBe(1);
  });

  it("respects client-supplied Idempotency-Key header", async () => {
    const key = "custom-webhook-key-998877";
    const payload = {
      name: "Client Hook",
      email: "webhook@example.com",
      message: "Automated webhook submission.",
    };

    const res1 = await app.inject({
      method: "POST",
      url: "/api/leads",
      headers: { "idempotency-key": key },
      payload,
    });

    expect(res1.statusCode).toBe(201);
    const id1 = res1.json().data.id;

    const res2 = await app.inject({
      method: "POST",
      url: "/api/leads",
      headers: { "idempotency-key": key },
      payload,
    });

    expect(res2.statusCode).toBe(200);
    expect(res2.headers["x-idempotent-replay"]).toBe("true");
    expect(res2.json().data.id).toBe(id1);

    const count = await getLeadCount();
    expect(count).toBe(1);
  });

  it("safely handles concurrent duplicate submissions without race conditions", async () => {
    const concurrentPayload = {
      name: "Concurrency Tester",
      email: "concurrent@example.com",
      message: "Testing concurrent submissions under high burst.",
    };

    // Execute 10 concurrent requests simultaneously
    const requests = Array.from({ length: 10 }).map(() =>
      app.inject({
        method: "POST",
        url: "/api/leads",
        payload: concurrentPayload,
      }),
    );

    const responses = await Promise.all(requests);

    // All requests must return success (either 201 for the winner or 200 for the replays)
    const createdResponses = responses.filter((r) => r.statusCode === 201);
    const replayResponses = responses.filter((r) => r.statusCode === 200);

    // Exactly 1 insert should win the race
    expect(createdResponses.length).toBe(1);
    // The other 9 should be gracefully returned as duplicates
    expect(replayResponses.length).toBe(9);

    // All 10 responses must refer to the exact same lead ID
    const leadIds = responses.map((r) => r.json().data.id);
    const uniqueIds = new Set(leadIds);
    expect(uniqueIds.size).toBe(1);

    // Database must contain exactly 1 row
    const count = await getLeadCount();
    expect(count).toBe(1);
  });
});
