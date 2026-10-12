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
});
