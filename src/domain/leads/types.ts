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

export type LeadProcessingStatus = "received" | "validated" | "failed";

export interface LeadRecord extends NormalizedLead {
  id: string;
  status: LeadProcessingStatus;
  createdAt: string;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}
