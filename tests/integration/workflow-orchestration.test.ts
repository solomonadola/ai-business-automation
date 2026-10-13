import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { clearLeadsTable } from "../helpers/db.js";
import { closeDatabasePool } from "../../src/adapters/database/client.js";
import { defaultNotificationSink } from "../../src/adapters/notifications/in-memory-sink.js";

describe("Workflow Orchestration & Notifications Integration", () => {
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

  it("orchestrates end-to-end lifecycle: intake -> classify -> notify -> completed", async () => {
    // 1. Intake
    const intakeRes = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: {
        name: "Margaret Hamilton",
        email: "margaret@apollo.nasa.gov",
        company: "MIT Instrumentation Lab",
        website: "https://mit.edu",
        message:
          "Need automated mission guidance software and lead processing pipelines.",
      },
    });

    expect(intakeRes.statusCode).toBe(201);
    const leadId = intakeRes.json().data.id;

    // 2. Process Full Workflow
    const processRes = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/process`,
    });

    expect(processRes.statusCode).toBe(200);
    const completedLead = processRes.json().data;

    expect(completedLead.id).toBe(leadId);
    expect(completedLead.status).toBe("completed");
    expect(completedLead.category).toBe("high_fit");
    expect(completedLead.fitScore).toBe(88);
    expect(completedLead.notificationSent).toBe(true);
    expect(completedLead.notificationMessageId).toBeDefined();
    expect(completedLead.notificationSentAt).toBeDefined();

    // 3. Verify exactly 1 notification was dispatched to the notification sink
    const dispatched = defaultNotificationSink.getDispatchedForLead(leadId);
    expect(dispatched.length).toBe(1);
    expect(dispatched[0]?.recipient).toBe("sales-team@company.internal");
    expect(dispatched[0]?.score).toBe(88);

    // 4. Verify audit attempt history
    const historyRes = await app.inject({
      method: "GET",
      url: `/api/leads/${leadId}/history`,
    });

    expect(historyRes.statusCode).toBe(200);
    const history = historyRes.json().data;
    expect(history.length).toBeGreaterThanOrEqual(2);

    const classificationStep = history.find(
      (h: { step: string; status: string }) =>
        h.step === "classification" && h.status === "success",
    );
    const notificationStep = history.find(
      (h: { step: string; status: string }) =>
        h.step === "notification" && h.status === "success",
    );

    expect(classificationStep).toBeDefined();
    expect(notificationStep).toBeDefined();
  });

  it("prevents duplicate notifications on repeated workflow execution", async () => {
    // 1. Intake
    const intakeRes = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: {
        name: "Steve Wozniak",
        email: "woz@apple.com",
        company: "Apple Computer",
        message:
          "Looking to automate hardware inquiries and wholesale sales orders.",
      },
    });

    const leadId = intakeRes.json().data.id;

    // 2. Initial processing execution
    const firstProcess = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/process`,
    });

    expect(firstProcess.statusCode).toBe(200);
    const firstMessageId = firstProcess.json().data.notificationMessageId;

    expect(defaultNotificationSink.getDispatchedForLead(leadId).length).toBe(1);

    // 3. Second processing execution (re-run of completed lead)
    const secondProcess = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/process`,
    });

    expect(secondProcess.statusCode).toBe(200);
    expect(secondProcess.json().data.notificationMessageId).toBe(
      firstMessageId,
    );

    // Must strictly remain 1 notification (Zero duplicate notifications)
    expect(defaultNotificationSink.getDispatchedForLead(leadId).length).toBe(1);
  });

  it("recovers from transient notification drops using bounded retries", async () => {
    // Configure sink to drop the first 2 attempts with simulated HTTP 503, then succeed on 3rd attempt
    defaultNotificationSink.setSimulateTransientFailures(2);

    const intakeRes = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: {
        name: "Transient Test User",
        email: "transient@retry.test",
        message: "Testing transient recovery with automated retries.",
      },
    });

    const leadId = intakeRes.json().data.id;

    // Process workflow: should automatically retry and complete
    const processRes = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/process`,
    });

    expect(processRes.statusCode).toBe(200);
    expect(processRes.json().data.status).toBe("completed");
    expect(processRes.json().data.notificationSent).toBe(true);

    // Verify exactly 1 notification arrived
    expect(defaultNotificationSink.getDispatchedForLead(leadId).length).toBe(1);

    // Verify audit logs show the retrying attempts
    const historyRes = await app.inject({
      method: "GET",
      url: `/api/leads/${leadId}/history`,
    });

    const history = historyRes.json().data;
    const retryAttempts = history.filter(
      (h: { step: string; status: string }) =>
        h.step === "notification" && h.status === "retrying",
    );
    expect(retryAttempts.length).toBe(2);
  });

  it("records permanent failure, lists lead in /failed, and recovers via /retry", async () => {
    // 1. Simulate permanent notification failure (HTTP 400)
    defaultNotificationSink.setSimulatePermanentFailure(true);

    const intakeRes = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: {
        name: "Failure Test User",
        email: "permanent@failure.test",
        message: "Testing permanent failure transition and manual recovery.",
      },
    });

    const leadId = intakeRes.json().data.id;

    // 2. Process workflow: fails permanently
    const processRes = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/process`,
    });

    expect(processRes.statusCode).toBe(502);
    expect(processRes.json().error.code).toBe("NOTIFICATION_FAILED");

    // 3. Inspect failed leads endpoint
    const failedListRes = await app.inject({
      method: "GET",
      url: "/api/leads/failed",
    });

    expect(failedListRes.statusCode).toBe(200);
    const failedLeads = failedListRes.json().data;
    expect(failedLeads.some((l: { id: string }) => l.id === leadId)).toBe(true);

    // 4. Resolve notification failure condition
    defaultNotificationSink.setSimulatePermanentFailure(false);

    // 5. Trigger /retry endpoint
    const retryRes = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/retry`,
    });

    expect(retryRes.statusCode).toBe(200);
    expect(retryRes.json().data.status).toBe("completed");
    expect(retryRes.json().data.notificationSent).toBe(true);

    // 6. Verify lead is removed from /failed list
    const updatedFailedListRes = await app.inject({
      method: "GET",
      url: "/api/leads/failed",
    });

    const updatedFailedLeads = updatedFailedListRes.json().data;
    expect(
      updatedFailedLeads.some((l: { id: string }) => l.id === leadId),
    ).toBe(false);
  });
});
