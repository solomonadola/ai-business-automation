import type {
  ClassificationContext,
  LeadClassification,
} from "../../domain/classification/types.js";
import type { LeadClassifier } from "../../domain/classification/classifier.interface.js";
import { CLASSIFICATION_PROMPT_VERSION } from "../../domain/classification/prompts.js";

export class MockLeadClassifier implements LeadClassifier {
  private shouldTimeout = false;
  private shouldFailWithRateLimit = false;
  private shouldReturnInvalidJson = false;
  private mockOverride: LeadClassification | null = null;

  public setSimulateTimeout(enable: boolean): void {
    this.shouldTimeout = enable;
  }

  public setSimulateRateLimit(enable: boolean): void {
    this.shouldFailWithRateLimit = enable;
  }

  public setSimulateInvalidJson(enable: boolean): void {
    this.shouldReturnInvalidJson = enable;
  }

  public setMockResponse(override: LeadClassification | null): void {
    this.mockOverride = override;
  }

  public async classify(
    context: ClassificationContext,
  ): Promise<LeadClassification> {
    // 1. Check simulated error modes
    if (this.shouldTimeout || context.message.includes("[simulated_timeout]")) {
      throw new Error("LLM request timed out after 10000ms");
    }

    if (
      this.shouldFailWithRateLimit ||
      context.message.includes("[simulated_rate_limit]")
    ) {
      throw new Error("LLM API rate limit exceeded (HTTP 429)");
    }

    if (
      this.shouldReturnInvalidJson ||
      context.message.includes("[simulated_invalid_json]")
    ) {
      throw new Error(
        "Classification output failed schema validation: malformed JSON from model",
      );
    }

    if (this.mockOverride) {
      return {
        ...this.mockOverride,
        promptVersion: CLASSIFICATION_PROMPT_VERSION,
        modelUsed: "mock-deterministic",
      };
    }

    // 2. Deterministic heuristic classification based on message signals
    const lowerMessage = context.message.toLowerCase();
    const hasCompany = Boolean(
      context.company && context.company.trim().length > 0,
    );
    const hasWebsite = Boolean(
      context.website && context.website.trim().length > 0,
    );

    const highFitKeywords = [
      "automation",
      "automate",
      "urgent",
      "budget",
      "enterprise",
      "scale",
      "crm",
      "pipeline",
    ];
    const lowFitKeywords = [
      "student",
      "internship",
      "free",
      "homework",
      "academic",
      "curious",
    ];

    const matchesHigh = highFitKeywords.some((kw) => lowerMessage.includes(kw));
    const matchesLow = lowFitKeywords.some((kw) => lowerMessage.includes(kw));

    if (matchesLow) {
      return {
        category: "low_fit",
        score: 30,
        reasoningSummary:
          "Inquiry appears to be non-commercial or academic research without budget signals.",
        recommendedAction: "archive",
        promptVersion: CLASSIFICATION_PROMPT_VERSION,
        modelUsed: "mock-deterministic",
        tokensUsed: 120,
      };
    }

    if (matchesHigh || (hasCompany && hasWebsite)) {
      const score = matchesHigh && hasCompany ? 88 : 78;
      return {
        category: "high_fit",
        score,
        reasoningSummary:
          "Clear commercial interest with defined business domain and automation need.",
        recommendedAction: "schedule_follow_up",
        promptVersion: CLASSIFICATION_PROMPT_VERSION,
        modelUsed: "mock-deterministic",
        tokensUsed: 145,
      };
    }

    return {
      category: "medium_fit",
      score: 60,
      reasoningSummary:
        "General inquiry with potential fit, but requires further scoping.",
      recommendedAction: "send_info_packet",
      promptVersion: CLASSIFICATION_PROMPT_VERSION,
      modelUsed: "mock-deterministic",
      tokensUsed: 130,
    };
  }
}

export const defaultMockClassifier = new MockLeadClassifier();
