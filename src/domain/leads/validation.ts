import { z } from "zod";
import type { NormalizedLead, ValidationErrorDetail } from "./types.js";

export const leadIntakeSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must not exceed 100 characters"),

  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address format")
    .max(255, "Email must not exceed 255 characters"),

  company: z
    .string()
    .trim()
    .max(100, "Company name must not exceed 100 characters")
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),

  website: z
    .string()
    .trim()
    .max(255, "Website URL must not exceed 255 characters")
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined))
    .refine(
      (val) => {
        if (!val) return true;
        try {
          const parsed = new URL(val);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "Website must be a valid HTTP or HTTPS URL" },
    ),

  message: z
    .string({ required_error: "Message is required" })
    .trim()
    .min(1, "Message is required")
    .max(2000, "Message must not exceed 2000 characters"),
});

export type LeadIntakeInput = z.input<typeof leadIntakeSchema>;

export function validateAndNormalizeLead(
  input: unknown,
):
  | { success: true; data: NormalizedLead }
  | { success: false; errors: ValidationErrorDetail[] } {
  const result = leadIntakeSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  const errors: ValidationErrorDetail[] = result.error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));

  return {
    success: false,
    errors,
  };
}
