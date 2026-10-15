import type { Notifier } from "../../domain/notifications/notifier.interface.js";
import { config, type Config } from "../../config.js";
import { defaultNotificationSink } from "./in-memory-sink.js";
import { WebhookNotifier } from "./webhook-notifier.js";

/**
 * Builds the active Notifier based on configuration.
 * Defaults to the in-memory sink so tests and CI remain deterministic.
 */
export function buildNotifier(cfg: Config = config): Notifier {
  if (cfg.NOTIFICATION_PROVIDER === "webhook") {
    return new WebhookNotifier({
      webhookUrl: cfg.N8N_WEBHOOK_URL,
      secret: cfg.WEBHOOK_SECRET,
    });
  }

  return defaultNotificationSink;
}

export const defaultNotifier: Notifier = buildNotifier();
