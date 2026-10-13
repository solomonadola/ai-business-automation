export type LeadCategory =
  "high_fit" | "medium_fit" | "low_fit" | "unqualified";

export type RecommendedAction =
  "schedule_follow_up" | "send_info_packet" | "route_to_sales" | "archive";

export interface LeadClassification {
  category: LeadCategory;
  score: number;
  reasoningSummary: string;
  recommendedAction: RecommendedAction;
  promptVersion?: string;
  modelUsed?: string;
  tokensUsed?: number;
}

export interface ClassificationContext {
  id: string;
  name: string;
  email: string;
  company?: string;
  website?: string;
  message: string;
}
