# ADR 0004: Two-Phase Workflow Orchestration, State Machine, and Audit Log

## Status

Accepted

## Context

When processing leads, failures can happen midway through (e.g. classification succeeds, but notification delivery fails). Retrying the entire job from the start without tracking prior completion risks duplicate sales alerts and redundant paid AI calls.

## Decision

1. **Explicit Finite State Machine**:
   The workflow progresses through discrete states:
   $$\text{received} \longrightarrow \text{validating} \longrightarrow \text{classifying} \longrightarrow \text{classified} \longrightarrow \text{notification\_pending} \longrightarrow \text{completed}$$
   Illegal transitions are rejected at runtime via `assertCanTransition`.
2. **Notification Guard Flag**:
   The `leads` table includes a durable `notification_sent: boolean` flag and `notification_message_id`. If a lead in `failed` status is retried after notification delivery has already succeeded, the notification phase is bypassed, guaranteeing zero duplicate alerts.
3. **Dedicated Audit Table (`workflow_attempts`)**:
   Every execution step, retry number, transition status, and failure reason is durably written to `workflow_attempts`, ensuring complete auditability and observability.
4. **Failure Inspection and Manual Retry**:
   Exposed dedicated triage endpoints:
   - `GET /api/leads/failed`: Lists all failed jobs with error reasons.
   - `POST /api/leads/:id/retry`: Resumes failed jobs safely from the point of failure.

## Consequences

- Requires a two-table relational structure in PostgreSQL.
- Eliminates duplicate notifications during transient network recovery.
