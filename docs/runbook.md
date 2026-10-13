# Operations Runbook

## 1. System Overview

The **AI Business Automation Platform** runs as a containerized or bare-metal Node.js service paired with PostgreSQL 16 and an optional n8n workflow engine.

---

## 2. Environment Configuration

Configuration is loaded via environment variables and strictly validated at startup using Zod:

| Variable          | Default Value                                                        | Description                                            |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| `PORT`            | `3000`                                                               | HTTP port the Fastify server listens on                |
| `HOST`            | `0.0.0.0`                                                            | Network binding interface                              |
| `NODE_ENV`        | `development`                                                        | Environment mode (`development`, `test`, `production`) |
| `DATABASE_URL`    | `postgres://postgres:postgres@localhost:5432/ai_business_automation` | PostgreSQL connection string                           |
| `WEBHOOK_SECRET`  | `dev-webhook-secret-change-in-production`                            | Secret used for HMAC and timing-safe webhook auth      |
| `N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/leads`                                | Outbound n8n notification webhook endpoint             |

---

## 3. Deployment Options

### Option A: Complete Docker Compose Stack (Recommended)

Starts PostgreSQL, n8n, and the containerized API service with automated health checks:

```bash
# 1. Build and start all services in the background
docker compose up -d --build

# 2. Check running container health
docker compose ps

# 3. View live logs
docker compose logs -f api
```

### Option B: Local Bare-Metal Development

Run the database in Docker while developing locally with hot reload:

```bash
# 1. Start database container
docker compose up postgres -d

# 2. Install dependencies
npm install

# 3. Apply database migrations
npm run db:migrate

# 4. Start local development server with tsx hot reload
npm run dev
```

---

## 4. Database Migrations

Migrations are managed via Drizzle ORM and stored in `drizzle/`.

```bash
# Generate new migration files from schema changes
npm run db:generate

# Execute pending migrations against the database
npm run db:migrate
```

---

## 5. Automated Verification Suite

Run all quality gates prior to deploying:

```bash
# Check code style with Prettier
npm run format:check

# Run ESLint rules
npm run lint

# Compile strict TypeScript without emitting files
npm run typecheck

# Run complete Vitest integration and unit test suite
npm test

# Build production bundle to dist/
npm run build
```

---

## 6. API Quick Reference

### 6.1 Service Health Check

```bash
curl -i http://localhost:3000/health
```

### 6.2 Submit a New Lead

```bash
curl -i -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: manual-test-001" \
  -d '{
    "name": "Jordan Lee",
    "email": "jordan@example.com",
    "company": "Acme Automations",
    "website": "https://acme.example.com",
    "message": "We need help automating our customer onboarding and lead routing pipeline."
  }'
```

### 6.3 Execute Lead Processing Workflow

```bash
curl -i -X POST http://localhost:3000/api/leads/<LEAD_ID>/process
```

### 6.4 Inspect Failed Leads

```bash
curl -i http://localhost:3000/api/leads/failed
```

### 6.5 Retry a Failed Lead

```bash
curl -i -X POST http://localhost:3000/api/leads/<LEAD_ID>/retry
```
