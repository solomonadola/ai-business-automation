import { describe, it, expect } from "vitest";
import { parseClassificationOutput } from "../../src/domain/classification/schema.js";

describe("AI Classification Output Schema Validation", () => {
  const validOutput = {
    category: "high_fit",
    score: 85,
    reasoning_summary:
      "Clear B2B sales automation need with active budget signals.",
    recommended_action: "schedule_follow_up",
  };

  it("accepts valid schema object", () => {
    const result = parseClassificationOutput(validOutput);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.category).toBe("high_fit");
    expect(result.data.score).toBe(85);
    expect(result.data.reasoningSummary).toBe(
      "Clear B2B sales automation need with active budget signals.",
    );
    expect(result.data.recommendedAction).toBe("schedule_follow_up");
  });

  it("parses valid JSON string with markdown code fences", () => {
    const rawMarkdownJson = "```json\n" + JSON.stringify(validOutput) + "\n```";
    const result = parseClassificationOutput(rawMarkdownJson);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.category).toBe("high_fit");
    expect(result.data.score).toBe(85);
  });

  it("rejects score exceeding 100", () => {
    const result = parseClassificationOutput({
      ...validOutput,
      score: 105,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error).toContain("score: Score cannot exceed 100");
  });

  it("rejects negative score", () => {
    const result = parseClassificationOutput({
      ...validOutput,
      score: -5,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error).toContain("score: Score must be at least 0");
  });

  it("rejects non-integer score", () => {
    const result = parseClassificationOutput({
      ...validOutput,
      score: 84.7,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error).toContain("score: Score must be an integer");
  });

  it("rejects hallucinated or invalid categories", () => {
    const result = parseClassificationOutput({
      ...validOutput,
      category: "super_ultra_fit",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error).toContain("Category must be one of: 'high_fit'");
  });

  it("rejects arbitrary or hallucinated actions", () => {
    const result = parseClassificationOutput({
      ...validOutput,
      recommended_action: "send_free_iphone_to_client",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error).toContain(
      "Recommended action must be one of: 'schedule_follow_up'",
    );
  });

  it("rejects empty reasoning summary", () => {
    const result = parseClassificationOutput({
      ...validOutput,
      reasoning_summary: "   ",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error).toContain(
      "reasoning_summary: Reasoning summary is required",
    );
  });

  it("handles malformed non-JSON strings safely", () => {
    const result = parseClassificationOutput(
      "{ this is definitely not valid json ",
    );

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error).toContain("Malformed JSON response from model");
  });
});
