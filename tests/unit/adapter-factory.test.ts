import { describe, it, expect } from "vitest";
import { buildClassifier } from "../../src/adapters/llm/classifier.factory.js";
import { buildNotifier } from "../../src/adapters/notifications/notifier.factory.js";
import { MockLeadClassifier } from "../../src/adapters/llm/mock-classifier.js";
import { OpenAiCompatibleClassifier } from "../../src/adapters/llm/openai-classifier.js";
import { InMemoryNotificationSink } from "../../src/adapters/notifications/in-memory-sink.js";
import { WebhookNotifier } from "../../src/adapters/notifications/webhook-notifier.js";
import { config } from "../../src/config.js";

describe("Adapter factories (config-driven wiring)", () => {
  it("builds the deterministic mock classifier when LLM_PROVIDER=mock", () => {
    expect(buildClassifier({ ...config, LLM_PROVIDER: "mock" })).toBeInstanceOf(
      MockLeadClassifier,
    );
  });

  it("builds the OpenAI-compatible classifier when LLM_PROVIDER=openai", () => {
    expect(
      buildClassifier({
        ...config,
        LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-test",
      }),
    ).toBeInstanceOf(OpenAiCompatibleClassifier);
  });

  it("builds the in-memory sink when NOTIFICATION_PROVIDER=in-memory", () => {
    expect(
      buildNotifier({ ...config, NOTIFICATION_PROVIDER: "in-memory" }),
    ).toBeInstanceOf(InMemoryNotificationSink);
  });

  it("builds the webhook notifier when NOTIFICATION_PROVIDER=webhook", () => {
    expect(
      buildNotifier({ ...config, NOTIFICATION_PROVIDER: "webhook" }),
    ).toBeInstanceOf(WebhookNotifier);
  });
});
