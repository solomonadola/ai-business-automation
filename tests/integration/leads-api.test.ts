import { describe, it, expect, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import type { ApiErrorResponse } from "../../src/http/errors.js";

describe("POST /api/leads API Integration", () => {
  const app = buildApp({ logger: false });

  afterAll(async () => {
    await app.close();
  });

  const validPayload = {
    name: "Jordan Lee",
    email: "jordan@example.com",
    company: "Example Co",
    website: "https://example.com",
    message: "We need help automating our sales process.",
  };

  it("accepts valid lead submission and returns 201 with normalized data", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.correlationId).toBeDefined();
    expect(body.data).toMatchObject({
      name: "Jordan Lee",
      email: "jordan@example.com",
      company: "Example Co",
      website: "https://example.com",
      message: "We need help automating our sales process.",
      status: "received",
    });
    expect(body.data.id).toBeDefined();
    expect(body.data.createdAt).toBeDefined();
  });

  it("rejects invalid submission with 400 and structured error details", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: {
        name: "",
        email: "not-an-email",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ApiErrorResponse>();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("The request contains invalid fields.");
    expect(body.error.correlationId).toBeDefined();
    expect(Array.isArray(body.error.details)).toBe(true);

    // Verify stack traces are never exposed
    expect((body as unknown as Record<string, unknown>).stack).toBeUndefined();
    expect(
      (body.error as unknown as Record<string, unknown>).stack,
    ).toBeUndefined();
  });

  it("rejects completely empty request payload with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ApiErrorResponse>();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("handles malformed JSON request bodies safely", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/leads",
      headers: {
        "content-type": "application/json",
      },
      payload: "{ malformed json ",
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ApiErrorResponse>();
    expect(body.error).toBeDefined();
    expect(body.error.correlationId).toBeDefined();
    expect((body as unknown as Record<string, unknown>).stack).toBeUndefined();
  });

  it("returns standardized 404 for unknown endpoints", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/unknown-endpoint",
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<ApiErrorResponse>();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.correlationId).toBeDefined();
  });
});
