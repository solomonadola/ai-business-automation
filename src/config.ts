import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file if present.
// Skipped in tests so a developer's local .env (e.g. real LLM keys) never
// leaks into the deterministic CI/test suite.
if (process.env.NODE_ENV !== "test") {
  dotenv.config();
}

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().min(1).default("0.0.0.0"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z
      .string()
      .min(1)
      .default(
        "postgres://postgres:postgres@localhost:5432/ai_business_automation",
      ),
    WEBHOOK_SECRET: z
      .string()
      .min(1)
      .default("dev-webhook-secret-change-in-production"),
    N8N_WEBHOOK_URL: z
      .string()
      .url()
      .default("http://localhost:5678/webhook/leads"),
    LLM_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
    OPENAI_API_KEY: z.string().default(""),
    OPENAI_BASE_URL: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().url().optional(),
    ),
    OPENAI_MODEL: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().min(1).optional(),
    ),
    NOTIFICATION_PROVIDER: z
      .enum(["in-memory", "webhook"])
      .default("in-memory"),
  })
  .superRefine((env, ctx) => {
    if (env.LLM_PROVIDER === "openai" && env.OPENAI_API_KEY.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when LLM_PROVIDER is 'openai'.",
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration:", parsedEnv.error.format());
  process.exit(1);
}

export const config = parsedEnv.data;
export type Config = z.infer<typeof envSchema>;
