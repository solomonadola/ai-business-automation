import { createHmac, randomUUID } from "node:crypto";
import type { Notifier } from "../../domain/notifications/notifier.interface.js";
import type {
  NotificationPayload,
  NotificationResult,
} from "../../domain/notifications/types.js";
import { config } from "../../config.js";

export interface WebhookNotifierOptions {
  webhookUrl?: string;
  secret?: string;
  timeoutMs?: number;
}

export class WebhookNotifier implements Notifier {
  private readonly webhookUrl: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(options: WebhookNotifierOptions = {}) {
    this.webhookUrl = options.webhookUrl ?? config.N8N_WEBHOOK_URL;
    this.secret = options.secret ?? config.WEBHOOK_SECRET;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  public async send(payload: NotificationPayload): Promise<NotificationResult> {
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", this.secret)
      .update(body)
      .digest("hex");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": this.secret,
          "X-Webhook-Signature": signature,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Outbound webhook notification failed with HTTP ${response.status}: ${errorText.slice(0, 150)}`,
        );
      }

      return {
        success: true,
        messageId: `n8n-${randomUUID()}`,
        deliveredAt: new Date().toISOString(),
        provider: "n8n-webhook",
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `Outbound webhook notification timed out after ${this.timeoutMs}ms.`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
