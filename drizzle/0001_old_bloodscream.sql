ALTER TABLE "leads" ADD COLUMN "fit_score" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "category" varchar(32);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "recommended_action" varchar(32);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "reasoning_summary" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "classified_at" timestamp with time zone;