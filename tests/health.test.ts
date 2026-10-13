import { describe, it, expect, afterAll } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /health", () => {
  const app = buildApp({ logger: false });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with status ok and valid ISO timestamp", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{ status: string; timestamp: string }>();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it("returns HTML dashboard on GET / for browser clients", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("AI Business Automation Platform");
    expect(response.body).toContain("Submit Inbound Lead");
  });

  it("returns JSON API metadata on GET / when Accept: application/json is sent", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: {
        accept: "application/json",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe("ai-business-automation");
    expect(body.health).toBe("/health");
    expect(body.leads).toBe("/api/leads");
  });
});
