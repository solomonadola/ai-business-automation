# ADR 0005: Boundary-Enforced n8n Workflow Integration

## Status

Accepted

## Context

Visual automation platforms (like n8n, Make, or Zapier) excel at routing notifications and syncing third-party SaaS services, but storing critical business validation or state tracking inside visual workflows creates "shadow code" that cannot be unit-tested or tracked cleanly in Git.

## Decision

1. **Strict Separation of Concerns**:
   - The TypeScript backend retains ownership of all data validation, schema enforcement, state transitions, idempotency checks, and audit logging.
   - n8n is utilized purely as an integration and notification router.
2. **Authenticated Webhook Boundaries**:
   - Outbound notifications from backend to n8n carry HMAC-SHA256 signatures (`X-Webhook-Signature`) and shared secret tokens (`X-Webhook-Secret`).
   - Inbound webhook endpoints on the backend (`POST /api/webhooks/n8n/leads`) verify `X-Webhook-Secret` using timing-safe comparisons (`crypto.timingSafeEqual`).
3. **Zero-Secret Export**:
   - All n8n workflow templates exported to `workflows/lead-automation-workflow.json` contain no hardcoded API keys or secrets, utilizing sanitized environment expressions.

## Consequences

- The platform remains fully functional and testable with mock or in-memory notification sinks even if n8n is offline or omitted.
- Visual workflow changes cannot silently compromise business logic or validation rules.
