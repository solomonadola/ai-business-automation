import type { LeadClassifier } from "../../domain/classification/classifier.interface.js";
import { config, type Config } from "../../config.js";
import { defaultMockClassifier } from "./mock-classifier.js";
import { OpenAiCompatibleClassifier } from "./openai-classifier.js";

/**
 * Builds the active LeadClassifier based on configuration.
 * Defaults to the deterministic mock so tests and CI never require a paid API.
 */
export function buildClassifier(cfg: Config = config): LeadClassifier {
  if (cfg.LLM_PROVIDER === "openai") {
    return new OpenAiCompatibleClassifier({
      apiKey: cfg.OPENAI_API_KEY,
      baseUrl: cfg.OPENAI_BASE_URL,
      model: cfg.OPENAI_MODEL,
    });
  }

  return defaultMockClassifier;
}

export const defaultClassifier: LeadClassifier = buildClassifier();
