import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { clearLeadsTable } from "../helpers/db.js";
import { closeDatabasePool } from "../../src/adapters/database/client.js";

describe("AI Lead Classification Integration", () => {
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

  it("classifies a received lead and persists structured AI results to PostgreSQL", async () => {
    // 1. Intake the lead
    const intakeRes = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: {
        name: "Grace Hopper",
        email: "grace@navy.mil",
        company: "Naval Computing",
        website: "https://navy.mil",
        message:
          "Need automated compiler and business pipeline processing at scale.",
      },
    });

    expect(intakeRes.statusCode).toBe(201);
    const leadId = intakeRes.json().data.id;

    // 2. Classify the lead
    const classifyRes = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/classify`,
    });

    expect(classifyRes.statusCode).toBe(200);
    const classifiedData = classifyRes.json().data;

    expect(classifiedData.id).toBe(leadId);
    expect(classifiedData.status).toBe("classified");
    expect(classifiedData.category).toBe("high_fit");
    expect(classifiedData.fitScore).toBe(88);
    expect(classifiedData.recommendedAction).toBe("schedule_follow_up");
    expect(classifiedData.reasoningSummary).toBeDefined();
    expect(classifiedData.classifiedAt).toBeDefined();

    // 3. Verify PostgreSQL persistence via GET
    const fetchRes = await app.inject({
      method: "GET",
      url: `/api/leads/${leadId}`,
    });

    expect(fetchRes.statusCode).toBe(200);
    const persisted = fetchRes.json().data;
    expect(persisted.status).toBe("classified");
    expect(persisted.fitScore).toBe(88);
    expect(persisted.category).toBe("high_fit");
    expect(persisted.recommendedAction).toBe("schedule_follow_up");
    expect(persisted.failureReason).toBeUndefined();
  });

  it("enforces cost control: re-classifying an already classified lead reuses stored results", async () => {
    // 1. Intake lead
    const intakeRes = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: {
        name: "Alan Turing",
        email: "alan@bletchley.org",
        company: "Codebreaker Labs",
        message: "Looking to automate computational decryption workflows.",
      },
    });

    const leadId = intakeRes.json().data.id;

    // 2. Initial classification
    const firstClassify = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/classify`,
    });

    expect(firstClassify.statusCode).toBe(200);
    const firstData = firstClassify.json().data;
    const initialClassifiedAt = firstData.classifiedAt;

    // 3. Second classification attempt
    const secondClassify = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/classify`,
    });

    expect(secondClassify.statusCode).toBe(200);
    const secondData = secondClassify.json().data;

    // Must return the exact same classification timestamp without re-invoking the model
    expect(secondData.classifiedAt).toBe(initialClassifiedAt);
    expect(secondData.fitScore).toBe(firstData.fitScore);
  });

  it("handles classification failures safely and records failure state in database", async () => {
    // 1. Intake a lead designed to trigger timeout in mock classifier
    const intakeRes = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: {
        name: "Timeout Case",
        email: "timeout@failure.test",
        message: "Simulating timeout with [simulated_timeout] keyword.",
      },
    });

    const leadId = intakeRes.json().data.id;

    // 2. Attempt classification
    const classifyRes = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/classify`,
    });

    expect(classifyRes.statusCode).toBe(502);
    const errorBody = classifyRes.json();
    expect(errorBody.error.code).toBe("CLASSIFICATION_FAILED");

    // 3. Verify lead transitioned to 'failed' in PostgreSQL with failure reason recorded
    const fetchRes = await app.inject({
      method: "GET",
      url: `/api/leads/${leadId}`,
    });

    expect(fetchRes.statusCode).toBe(200);
    const failedLead = fetchRes.json().data;
    expect(failedLead.status).toBe("failed");
    expect(failedLead.failureReason).toContain("timed out");
    expect(failedLead.fitScore).toBeUndefined();
  });

  it("returns 404 when attempting to classify a non-existent lead", async () => {
    const randomUuid = "00000000-0000-0000-0000-000000000000";
    const response = await app.inject({
      method: "POST",
      url: `/api/leads/${randomUuid}/classify`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
  });
});
