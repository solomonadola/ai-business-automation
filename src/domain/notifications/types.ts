import type {
  LeadCategory,
  RecommendedAction,
} from "../classification/types.js";

export interface NotificationPayload {
  leadId: string;
  recipient: string;
  subject: string;
  name: string;
  email: string;
  company?: string;
  category: LeadCategory;
  score: number;
  recommendedAction: RecommendedAction;
  summary: string;
  attemptNumber: number;
  idempotencyKey: string;
}

export interface NotificationResult {
  success: boolean;
  messageId: string;
  deliveredAt: string;
  provider: string;
}
