# Data Retention and Deletion Policy

## 1. Overview and Objectives

The AI Business Automation platform collects, classifies, and routes prospective customer leads. Leads contain Personally Identifiable Information (PII) including prospective customer names, email addresses, company names, and project inquiries.

This policy defines the data lifecycle, retention schedules, and secure deletion/anonymization workflows required to satisfy data minimization principles (GDPR Article 5(1)(c), CCPA/CPRA).

---

## 2. Retention Schedules

| Data Classification                                                  | Storage Location               | Retention Window                           | Action at Expiration                                                     |
| -------------------------------------------------------------------- | ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| **Active Leads (`received`, `classifying`, `notification_pending`)** | PostgreSQL `leads`             | Active processing (typically < 10 minutes) | Retained until workflow terminal state (`completed` or `failed`).        |
| **Completed Leads (`completed`)**                                    | PostgreSQL `leads`             | **90 days** post-completion                | Anonymized or purged via automated retention job.                        |
| **Failed Leads (`failed`)**                                          | PostgreSQL `leads`             | **30 days** post-failure                   | Review window for ops triage; purged or archived after 30 days.          |
| **Workflow Audit History (`workflow_attempts`)**                     | PostgreSQL `workflow_attempts` | **90 days**                                | Cascade deleted or purged when associated lead record is purged.         |
| **Diagnostic Application Logs**                                      | Pino JSON log sink / stdout    | **14 days**                                | Rotated and deleted by log forwarder (FluentBit / Datadog / CloudWatch). |

---

## 3. Data Deletion and Anonymization Workflows

### 3.1 GDPR Right to Erasure ("Right to be Forgotten")

When a prospect or customer submits an erasure request:

1. Locate the lead record via email address (`SELECT id FROM leads WHERE email = 'prospect@example.com'`).
2. Execute an **in-place anonymization** or **hard deletion**.

#### In-Place Anonymization (Recommended for Analytical Integrity)

Anonymization scrubs all PII while preserving aggregate classification metrics for machine learning and reporting:

```sql
UPDATE leads
SET
  name = 'REDACTED',
  email = CONCAT('anonymized-', id, '@privacy.internal'),
  company = NULL,
  website = NULL,
  message = '[MESSAGE CONTENT PURGED UNDER PRIVACY POLICY]',
  updated_at = NOW()
WHERE id = :leadId;
```

#### Hard Deletion (Complete Erasure)

For complete data purging:

```sql
-- Associated workflow_attempts are removed via foreign key CASCADE
DELETE FROM leads WHERE id = :leadId;
```

---

## 4. Scheduled Cleanup Implementation

A daily cron or scheduled maintenance task purges expired records older than the 90-day threshold:

```sql
-- Daily automated retention purge for completed records older than 90 days
DELETE FROM leads
WHERE status = 'completed'
  AND updated_at < NOW() - INTERVAL '90 days';

-- Purge stale failed leads older than 30 days
DELETE FROM leads
WHERE status = 'failed'
  AND updated_at < NOW() - INTERVAL '30 days';
```

---

## 5. Security During Deletion

- **No Residual Backups Past SLA**: Database automated snapshots and WAL archives are retained for a maximum of 14 days before rolling expiration.
- **Log Sanitization**: PII fields (`message`, raw credentials) are never written to unredacted log sinks; correlation IDs (`request.id`, `leadId`) are used for diagnostics instead of personal identifiers.
