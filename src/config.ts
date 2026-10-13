import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file if present
dotenv.config();

const envSchema = z.object({
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
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration:", parsedEnv.error.format());
  process.exit(1);
}

export const config = parsedEnv.data;
export type Config = z.infer<typeof envSchema>;
