import { randomUUID } from "node:crypto";
import type { Notifier } from "../../domain/notifications/notifier.interface.js";
import type {
  NotificationPayload,
  NotificationResult,
} from "../../domain/notifications/types.js";

export class InMemoryNotificationSink implements Notifier {
  private readonly dispatched: NotificationPayload[] = [];
  private transientFailuresRemaining = 0;
  private shouldFailPermanently = false;

  public setSimulateTransientFailures(count: number): void {
    this.transientFailuresRemaining = count;
  }

  public setSimulatePermanentFailure(enable: boolean): void {
    this.shouldFailPermanently = enable;
  }

  public async send(payload: NotificationPayload): Promise<NotificationResult> {
    // 1. Check permanent error simulation
    if (this.shouldFailPermanently) {
      throw new Error(
        "Permanent notification error: Invalid recipient configuration (HTTP 400)",
      );
    }

    // 2. Check transient error simulation
    if (this.transientFailuresRemaining > 0) {
      this.transientFailuresRemaining--;
      throw new Error(
        "Transient notification delivery error: Service unavailable (HTTP 503)",
      );
    }

    // 3. Record dispatched payload
    this.dispatched.push(payload);

    return {
      success: true,
      messageId: `sink-${randomUUID()}`,
      deliveredAt: new Date().toISOString(),
      provider: "in-memory-sink",
    };
  }

  public getDispatched(): NotificationPayload[] {
    return [...this.dispatched];
  }

  public getDispatchedForLead(leadId: string): NotificationPayload[] {
    return this.dispatched.filter((item) => item.leadId === leadId);
  }

  public clear(): void {
    this.dispatched.length = 0;
    this.transientFailuresRemaining = 0;
    this.shouldFailPermanently = false;
  }
}

export const defaultNotificationSink = new InMemoryNotificationSink();
