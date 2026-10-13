import type { NotificationPayload, NotificationResult } from "./types.js";

export interface Notifier {
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
