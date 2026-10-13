import type { LeadProcessingStatus } from "../leads/types.js";

export const VALID_TRANSITIONS: Record<
  LeadProcessingStatus,
  LeadProcessingStatus[]
> = {
  received: ["validated", "classifying", "failed"],
  validated: ["classifying", "failed"],
  classifying: ["classified", "failed"],
  classified: ["notification_pending", "completed", "failed"],
  notification_pending: ["completed", "failed"],
  completed: [], // Terminal success state
  failed: ["received", "classifying", "notification_pending"], // Allowed on manual/automated retry
};

export function canTransition(
  from: LeadProcessingStatus,
  to: LeadProcessingStatus,
): boolean {
  if (from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertCanTransition(
  from: LeadProcessingStatus,
  to: LeadProcessingStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid workflow state transition: cannot transition from '${from}' to '${to}'`,
    );
  }
}
