# n8n Workflow Orchestration Guide

This directory contains the sanitized, exportable n8n workflow for the AI Business Automation Platform: [`lead-automation-workflow.json`](./lead-automation-workflow.json).

---

## 1. Architectural Boundaries

Per the project design principles, **business logic remains in the TypeScript backend**:

- **TypeScript Backend (`localhost:3000`):** Owns validation, data normalization, database transactions, idempotency deduplication, AI classification prompt logic, and audit logging.
- **n8n Orchestrator (`localhost:5678`):** Owns external trigger intake and visual fanout of sales alerts (Slack/Email/CRM).

---

## 2. Quickstart: Running n8n Locally

1. **Start the local n8n container via Docker Compose:**
   ```bash
   docker compose up -d n8n
   ```
2. **Access the n8n UI:**
   Open [http://localhost:5678](http://localhost:5678) in your browser.
3. **Follow the initial one-time owner setup** in the n8n web interface.

---

## 3. Importing the Sanitized Workflow

1. In the n8n dashboard, open the menu (top left) and click **Workflows** -> **Import from File**.
2. Select [`workflows/lead-automation-workflow.json`](./lead-automation-workflow.json).
3. The visual canvas will render the 7 pipeline nodes:
   - **Incoming Lead Webhook Trigger:** Listens for `POST /webhook/leads`.
   - **Send to Backend Gateway:** Authenticates with `X-Webhook-Secret` and forwards payload to backend `POST /api/webhooks/n8n/leads`.
   - **Route by Category:** Evaluates `$json.data.category` (`high_fit`, `medium_fit`, `low_fit`).
   - **Dispatch Sales Alert:** Routes high-fit leads to sales channels.
   - **Enqueue Marketing Nurture:** Routes medium-fit leads to nurture campaigns.
   - **Archive Unqualified:** Archives low-fit/spam inquiries.
   - **Respond to Webhook Client:** Returns confirmation to caller.

---

## 4. Configuring Credentials & Secrets

The workflow is **100% sanitized** and contains zero hardcoded secrets. Both the backend URL and the webhook secret are injected from n8n environment variables (set automatically by `docker-compose.yml`):

| n8n Env Variable | Purpose                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `WEBHOOK_SECRET` | Must match the backend's `WEBHOOK_SECRET` for the `X-Webhook-Secret` header.                               |
| `BACKEND_URL`    | Backend webhook endpoint. Defaults to `http://api:3000/api/webhooks/n8n/leads` (the compose service name). |

If you run n8n in Docker while the Node backend runs on your **host** machine (not in Docker), set `BACKEND_URL=http://host.docker.internal:3000/api/webhooks/n8n/leads`.

---

## 5. Testing the Workflow

Trigger the active n8n webhook using `curl`:

```bash
curl -X POST http://localhost:5678/webhook/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@enterprise.com",
    "company": "Enterprise Corp",
    "website": "https://enterprise.com",
    "message": "Urgent need for automated sales operations and lead classification."
  }'
```

### Expected Outcome:

1. n8n forwards the lead to the backend via `POST /api/webhooks/n8n/leads`.
2. Backend validates, saves, classifies using AI, marks notification sent, and persists to PostgreSQL.
3. n8n routes the lead to the `#sales-urgent-leads` alert branch.
4. Client receives `200 OK` confirmation.
