# Getting Started — Connect, Use & Test

A single self-contained walkthrough for running the platform, wiring it to n8n, exercising every endpoint, and verifying the results end-to-end.

---

## 1. What the system is

The platform accepts inbound leads, validates and deduplicates them, classifies them with an LLM (or a deterministic mock), persists everything to PostgreSQL, and notifies a sales sink — with idempotency, retries, and a full audit trail.

```mermaid
flowchart LR
    UI["Web Dashboard<br/>(localhost:3000)"] -->|POST /api/leads| API
    CLI["curl"] -->|POST /webhook/leads| N8N["n8n<br/>(localhost:5678)"]
    N8N -->|"POST /api/webhooks/n8n/leads<br/>(X-Webhook-Secret)"| API["Fastify API<br/>(localhost:3000)"]
    API -->|Drizzle ORM| DB[("PostgreSQL 16<br/>(localhost:5432)")]
    API -->|classify| LLM["Classifier<br/>(mock | OpenAI)"]
    API -.->|notify| NOTIF["Notification sink<br/>(in-memory | webhook)"]
```

Two connection directions exist; only the **inbound** one (n8n → backend) is wired by default:

| Direction              | Path                                                   | Status                          |
| ---------------------- | ------------------------------------------------------ | ------------------------------- |
| n8n → backend          | `POST /webhook/leads` → `POST /api/webhooks/n8n/leads` | ✅ wired                        |
| backend → n8n (notify) | `WebhookNotifier` → `N8N_WEBHOOK_URL`                  | ⚠️ in-memory by default; see §9 |

---

## 2. Prerequisites

- Docker + Docker Compose
- Node.js ≥ 20 (only needed for local dev / running tests)
- Ports free: `3000`, `5432`, `5678`

---

## 3. Run the whole stack (one command)

```bash
docker compose up -d --build
docker compose ps        # all three should show "healthy" / running
```

This starts, in order:

| Service    | URL                   | Notes                                                   |
| ---------- | --------------------- | ------------------------------------------------------- |
| `api`      | http://localhost:3000 | Fastify backend; runs migrations on startup             |
| `n8n`      | http://localhost:5678 | workflow orchestrator                                   |
| `postgres` | localhost:5432        | database `ai_business_automation`, user/pass `postgres` |

Verify health (note the DB check now reports `database`):

```bash
curl -s http://localhost:3000/health
# {"status":"ok","database":"up","timestamp":"..."}
```

---

## 4. Local development (backend on host)

```bash
docker compose up postgres -d   # DB only
npm install
npm run db:migrate              # apply migrations
npm run dev                     # hot-reload server on :3000
```

Useful scripts:

```bash
npm run typecheck   # strict TS
npm run lint        # ESLint
npm run format:check
npm run build       # compile to dist/
npm test            # 60 unit + integration tests
npm run simulate    # real-world demo journey (submits leads, shows idempotency)
```

---

## 5. Environment variables

Defined in `.env.example` and validated at startup (`src/config.ts`). Defaults work out of the box.

| Variable                | Default                                                              | Purpose                                    |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| `PORT`                  | `3000`                                                               | HTTP port                                  |
| `HOST`                  | `0.0.0.0`                                                            | Bind interface                             |
| `NODE_ENV`              | `development`                                                        | `development` \| `test` \| `production`    |
| `DATABASE_URL`          | `postgres://postgres:postgres@localhost:5432/ai_business_automation` | Postgres connection                        |
| `WEBHOOK_SECRET`        | `dev-webhook-secret-change-in-production`                            | n8n↔backend shared secret                  |
| `N8N_WEBHOOK_URL`       | `http://localhost:5678/webhook/leads`                                | Outbound notify target                     |
| `LLM_PROVIDER`          | `mock`                                                               | `mock` (deterministic) \| `openai`         |
| `OPENAI_API_KEY`        | _(empty)_                                                            | required when `LLM_PROVIDER=openai`        |
| `OPENAI_BASE_URL`       | _(unset)_                                                            | custom OpenAI-compatible endpoint          |
| `OPENAI_MODEL`          | _(unset)_                                                            | e.g. `gpt-4o-mini`                         |
| `NOTIFICATION_PROVIDER` | `in-memory`                                                          | `in-memory` (no side effects) \| `webhook` |

> `docker-compose.yml` overrides `DATABASE_URL`, `N8N_WEBHOOK_URL`, and injects `WEBHOOK_SECRET` + `BACKEND_URL` into the n8n container.

---

## 6. Use the app (API + dashboard)

### Dashboard

Open **http://localhost:3000** — submit a lead (or click **1-Click Test Lead**), watch it appear in the pipeline, then **⚡ Process** and **📜 Audit** each row.

### API endpoints

| Method | Path                      | Purpose                                             |
| ------ | ------------------------- | --------------------------------------------------- |
| GET    | `/health`                 | liveness + DB check                                 |
| GET    | `/`                       | dashboard HTML (JSON if `Accept: application/json`) |
| POST   | `/api/leads`              | submit lead (`Idempotency-Key` header optional)     |
| GET    | `/api/leads`              | list recent leads                                   |
| GET    | `/api/leads/failed`       | inspect failed leads                                |
| GET    | `/api/leads/:id`          | fetch one lead                                      |
| POST   | `/api/leads/:id/classify` | run classification only                             |
| POST   | `/api/leads/:id/process`  | full workflow → completed                           |
| POST   | `/api/leads/:id/retry`    | retry a failed lead                                 |
| GET    | `/api/leads/:id/history`  | workflow audit trail                                |
| POST   | `/api/webhooks/n8n/leads` | authenticated inbound webhook                       |

### Submit a lead

```bash
curl -s -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-001" \
  -d '{"name":"Jordan Lee","email":"jordan@example.com","company":"Acme","website":"https://acme.com","message":"We need to automate our sales pipeline."}'
```

Resubmitting the same `Idempotency-Key` returns `isDuplicate: true` with **no** duplicate row.

### Process it

```bash
curl -s -X POST http://localhost:3000/api/leads/<LEAD_ID>/process
# → status "completed", fitScore, category, notificationSent:true
```

---

## 7. Connect n8n

### 7.1 Import the workflow

1. Open **http://localhost:5678** and finish the one-time owner setup.
2. Top-left menu → **Workflows → Import from File**.
3. Select `workflows/lead-automation-workflow.json`.

Seven nodes render:

```
Incoming Lead Webhook Trigger → Send to Backend Gateway → Route by Category
                                                          ├─ Dispatch Sales Alert
                                                          ├─ Enqueue Marketing Nurture
                                                          └─ Archive Unqualified
                                                          └─ Respond to Webhook Client
```

### 7.2 Verify the connection settings

- **Incoming Lead Webhook Trigger** — production URL should be `http://localhost:5678/webhook/leads`.
- **Send to Backend Gateway** — URL is `={{ $env.BACKEND_URL || 'http://api:3000/api/webhooks/n8n/leads' }}` (compose sets `BACKEND_URL=http://api:3000/...`), header `X-Webhook-Secret` = `{{ $env.WEBHOOK_SECRET }}`.

Both sides must use the same secret: `dev-webhook-secret-change-in-production`.

### 7.3 Activate

Toggle the **Active** switch (top-right).

### 7.4 Trigger n8n → backend

```bash
curl -i -X POST http://localhost:5678/webhook/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@enterprise.com","company":"Enterprise Corp","website":"https://enterprise.com","message":"Urgent: need automated lead classification"}'
```

### 7.5 Verify in three places

1. **n8n → Executions** (left nav): one green run; the active path is highlighted.
2. **Dashboard** http://localhost:3000 → Jane appears as `completed`.
3. **Postgres**:

```bash
docker compose exec postgres psql -U postgres -d ai_business_automation \
  -c "SELECT name,email,status,fit_score,category FROM leads ORDER BY created_at DESC LIMIT 5;"
```

---

## 8. Test everything

### Automated suite (deterministic, no paid API)

```bash
npm test            # 60 tests across 11 files
npm run typecheck
npm run lint
npm run format:check
```

### Manual failure & recovery walkthrough

```bash
# invalid input → 400 VALIDATION_ERROR
curl -s -X POST localhost:3000/api/leads -H 'Content-Type: application/json' \
  -d '{"name":"No Email","message":"hi"}'

# unauthorized webhook → 401
curl -s -X POST localhost:3000/api/webhooks/n8n/leads \
  -H 'Content-Type: application/json' -H 'X-Webhook-Secret: wrong' -d '{"name":"x","email":"x@x.com","message":"x"}'

# simulate an LLM failure → lead lands in "failed"
curl -s -X POST localhost:3000/api/leads -H 'Content-Type: application/json' \
  -d '{"name":"Fail","email":"fail@example.com","message":"[simulated_rate_limit] trigger"}'
curl -s -X POST localhost:3000/api/leads/<FAIL_LEAD_ID>/process   # → 502, status failed
curl -s localhost:3000/api/leads/failed                           # lists it
curl -s -X POST localhost:3000/api/leads/<FAIL_LEAD_ID>/retry     # recovery attempt
```

### Real LLM smoke test (optional)

```bash
# Free Google Gemini — create a key at https://aistudio.google.com/app/apikey
# then set in .env (or export) and run locally:
LLM_PROVIDER=openai \
OPENAI_API_KEY=AIza...your-gemini-key \
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai \
OPENAI_MODEL=gemini-flash-lite-latest \
npm run dev
```

Any OpenAI-compatible endpoint works the same way (Groq: `https://api.groq.com/openai/v1`; Ollama: `http://localhost:11434/v1`). Note that Gemini's heavier "thinking" models can exhaust the 300-token budget before emitting JSON — the `-lite` models (e.g. `gemini-flash-lite-latest`) are recommended for classification.

---

## 9. Known limitations / caveats

- **LLM default is a mock.** Classification uses a deterministic keyword heuristic unless `LLM_PROVIDER=openai` is set. Free providers (Gemini, Groq, Ollama) work via `OPENAI_BASE_URL`/`OPENAI_MODEL` — see §8.
- **Notification default is in-memory.** Notifications are dropped into an in-memory sink and vanish on restart. The `webhook` provider currently targets n8n's _intake_ webhook, so it would loop — leave `NOTIFICATION_PROVIDER=in-memory` until a real Slack/email endpoint is configured.
- **No pagination.** `GET /api/leads` returns the latest 25 leads only.
- **Audit label quirk.** The first classification attempt is recorded with status `retrying`.
- **Duplicate n8n delivery** routes to the "archive" branch (no `category` on an already-received lead).

---

## 10. Troubleshooting

| Symptom                             | Cause / Fix                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `/webhook/leads` returns **404**    | Workflow not imported or not Active in n8n.                                        |
| n8n execution shows **401**         | `WEBHOOK_SECRET` mismatch between n8n and backend.                                 |
| Gateway node "Request error"        | n8n can't reach `api:3000`; verify compose network.                                |
| `GET /api/leads` returns 500        | Tables missing — run `npm run db:migrate` (or restart `api`, which auto-migrates). |
| `/health` shows `"database":"down"` | Postgres not healthy; `docker compose ps` and `docker compose logs postgres`.      |
| No buttons work in the dashboard    | Stale build — rebuild with `docker compose up -d --build api`.                     |

---

## 11. Project layout (key paths)

```text
src/
  config.ts                      # env validation
  app.ts                         # Fastify app + security middleware
  routes/                        # health, leads, webhooks, ui
  services/                      # lead.service, lead-orchestrator.service
  domain/                        # validation, classification, workflows, notifications
  adapters/
    database/                    # drizzle schema, repository, migrate
    llm/                         # mock + OpenAI classifiers, factory
    notifications/               # in-memory + webhook notifiers, factory
  observability/logger.ts        # structured logging + redaction
workflows/lead-automation-workflow.json   # sanitized n8n workflow
docs/                            # architecture, runbook, security, troubleshooting, ADRs
tests/                           # unit + integration suites
```
