import { describe, it, expect } from "vitest";
import { MockLeadClassifier } from "../../src/adapters/llm/mock-classifier.js";

describe("Deterministic MockLeadClassifier", () => {
  const classifier = new MockLeadClassifier();

  it("classifies automation-heavy inquiries as high_fit", async () => {
    const result = await classifier.classify({
      id: "lead-1",
      name: "Sarah Connor",
      email: "sarah@skynet.com",
      company: "Defense Systems LLC",
      website: "https://defensesystems.com",
      message: "Need urgent sales pipeline automation to scale operations.",
    });

    expect(result.category).toBe("high_fit");
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.recommendedAction).toBe("schedule_follow_up");
    expect(result.modelUsed).toBe("mock-deterministic");
  });

  it("classifies academic inquiries as low_fit", async () => {
    const result = await classifier.classify({
      id: "lead-2",
      name: "Bob Student",
      email: "bob@college.edu",
      message:
        "I am a student doing homework on how CRMs work. Can I get free access?",
    });

    expect(result.category).toBe("low_fit");
    expect(result.score).toBeLessThan(50);
    expect(result.recommendedAction).toBe("archive");
  });

  it("simulates timeout when requested", async () => {
    await expect(
      classifier.classify({
        id: "lead-3",
        name: "Timeout User",
        email: "user@timeout.com",
        message: "This message has [simulated_timeout] tag.",
      }),
    ).rejects.toThrow("LLM request timed out");
  });

  it("simulates rate limit when requested", async () => {
    await expect(
      classifier.classify({
        id: "lead-4",
        name: "Rate Limit User",
        email: "user@ratelimit.com",
        message: "Triggering [simulated_rate_limit].",
      }),
    ).rejects.toThrow("rate limit exceeded");
  });

  it("simulates invalid json output when requested", async () => {
    await expect(
      classifier.classify({
        id: "lead-5",
        name: "Invalid Output User",
        email: "user@invalid.com",
        message: "Triggering [simulated_invalid_json].",
      }),
    ).rejects.toThrow("schema validation");
  });
});
