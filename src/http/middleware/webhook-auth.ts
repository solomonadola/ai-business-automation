import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { config } from "../../config.js";
import { AppError } from "../errors.js";

export function verifyWebhookSecret(
  providedSecret: string,
  expectedSecret: string = config.WEBHOOK_SECRET,
): boolean {
  if (!providedSecret || !expectedSecret) return false;

  const providedHash = createHash("sha256").update(providedSecret).digest();
  const expectedHash = createHash("sha256").update(expectedSecret).digest();

  return timingSafeEqual(providedHash, expectedHash);
}

export async function webhookAuthHook(request: FastifyRequest): Promise<void> {
  const headerSecret = request.headers["x-webhook-secret"];

  if (!headerSecret || typeof headerSecret !== "string") {
    throw new AppError(
      "Unauthorized: Missing X-Webhook-Secret header",
      401,
      "UNAUTHORIZED",
    );
  }

  if (!verifyWebhookSecret(headerSecret)) {
    throw new AppError(
      "Unauthorized: Invalid webhook secret token",
      401,
      "UNAUTHORIZED",
    );
  }
}
