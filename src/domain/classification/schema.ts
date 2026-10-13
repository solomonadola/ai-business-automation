import { z } from "zod";
import type { LeadClassification } from "./types.js";

export const leadClassificationSchema = z.object({
  category: z.enum(["high_fit", "medium_fit", "low_fit", "unqualified"], {
    errorMap: () => ({
      message:
        "Category must be one of: 'high_fit', 'medium_fit', 'low_fit', 'unqualified'",
    }),
  }),
  score: z
    .number()
    .int("Score must be an integer")
    .min(0, "Score must be at least 0")
    .max(100, "Score cannot exceed 100"),
  reasoning_summary: z
    .string()
    .trim()
    .min(1, "Reasoning summary is required")
    .max(500, "Reasoning summary cannot exceed 500 characters"),
  recommended_action: z.enum(
    ["schedule_follow_up", "send_info_packet", "route_to_sales", "archive"],
    {
      errorMap: () => ({
        message:
          "Recommended action must be one of: 'schedule_follow_up', 'send_info_packet', 'route_to_sales', 'archive'",
      }),
    },
  ),
});

export type RawClassificationOutput = z.infer<typeof leadClassificationSchema>;

export function parseClassificationOutput(
  raw: unknown,
):
  | { success: true; data: LeadClassification }
  | { success: false; error: string } {
  let payload = raw;
  if (typeof raw === "string") {
    try {
      // Strip potential markdown code fences: ```json ... ```
      const cleaned = raw
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "");
      payload = JSON.parse(cleaned);
    } catch (err) {
      return {
        success: false,
        error: `Malformed JSON response from model: ${String(err)}`,
      };
    }
  }

  const result = leadClassificationSchema.safeParse(payload);
  if (!result.success) {
    const errorMessages = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    return {
      success: false,
      error: `Classification output failed schema validation: ${errorMessages}`,
    };
  }

  return {
    success: true,
    data: {
      category: result.data.category,
      score: result.data.score,
      reasoningSummary: result.data.reasoning_summary,
      recommendedAction: result.data.recommended_action,
    },
  };
}
