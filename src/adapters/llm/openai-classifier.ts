import type {
  ClassificationContext,
  LeadClassification,
} from "../../domain/classification/types.js";
import type { LeadClassifier } from "../../domain/classification/classifier.interface.js";
import {
  CLASSIFICATION_PROMPT_VERSION,
  getClassificationSystemPrompt,
  buildClassificationUserPrompt,
} from "../../domain/classification/prompts.js";
import { parseClassificationOutput } from "../../domain/classification/schema.js";

export interface OpenAiClassifierOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  maxTokens?: number;
  maxRetries?: number;
}

export class OpenAiCompatibleClassifier implements LeadClassifier {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly maxRetries: number;

  constructor(options: OpenAiClassifierOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/+$/,
      "",
    );
    this.model = options.model ?? "gpt-4o-mini";
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.maxTokens = options.maxTokens ?? 300;
    this.maxRetries = options.maxRetries ?? 2;
  }

  public async classify(
    context: ClassificationContext,
  ): Promise<LeadClassification> {
    const systemPrompt = getClassificationSystemPrompt();
    const userPrompt = buildClassificationUserPrompt(context);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.executeRequest(systemPrompt, userPrompt);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        const isTransient =
          lastError.message.includes("429") ||
          lastError.message.includes("500") ||
          lastError.message.includes("502") ||
          lastError.message.includes("503") ||
          lastError.message.includes("504") ||
          lastError.message.includes("timed out");

        if (!isTransient || attempt === this.maxRetries) {
          throw lastError;
        }

        // Bounded exponential backoff delay before retry
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError ?? new Error("Failed to classify lead after retries.");
  }

  private async executeRequest(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LeadClassification> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: this.maxTokens,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Redact any credential traces from error message
        throw new Error(
          `LLM provider returned HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        );
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };

      const rawContent = json.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error(
          "LLM provider returned an empty response choices payload.",
        );
      }

      const parsed = parseClassificationOutput(rawContent);
      if (!parsed.success) {
        throw new Error(parsed.error);
      }

      return {
        ...parsed.data,
        promptVersion: CLASSIFICATION_PROMPT_VERSION,
        modelUsed: this.model,
        tokensUsed: json.usage?.total_tokens,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `LLM provider request timed out after ${this.timeoutMs}ms.`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
