export interface RawLeadInput {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  website?: unknown;
  message?: unknown;
}

export interface NormalizedLead {
  name: string;
  email: string;
  company?: string;
  website?: string;
  message: string;
}

export type LeadProcessingStatus =
  | "received"
  | "validated"
  | "classifying"
  | "classified"
  | "notification_pending"
  | "completed"
  | "failed";

export interface LeadRecord extends NormalizedLead {
  id: string;
  idempotencyKey: string;
  status: LeadProcessingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NewLeadRecord {
  idempotencyKey: string;
  name: string;
  email: string;
  company?: string;
  website?: string;
  message: string;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}
