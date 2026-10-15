# Architecture Documentation

## 1. Executive Summary

The **AI Business Automation Platform** is a production-grade backend service designed to automate B2B lead intake, AI-powered fit classification, and workflow orchestration. The architecture prioritizes durability, deterministic idempotency, security hardening, and observability.

---

## 2. System Architecture Diagram

```mermaid
flowchart TD
    subgraph ClientLayer ["Clients & Channels"]
        WebForm["Web Form / CRM / API Client"]
    end

    subgraph ApiKernel ["Fastify HTTP Kernel"]
        Sec["Security & Rate Limiting<br/>(Helmet + Rate-Limit)"]
        ReqId["Correlation ID Hook<br/>(UUID / x-request-id)"]
        Val["Zod Input Validation<br/>(RFC 5322 Email + Sanitization)"]
        Err["Standard Error Envelope<br/>(Centralized Error Handler)"]
    end

    subgraph DomainService ["Domain & Application Services"]
        LeadSvc["Lead Service<br/>(Idempotency & Deduplication)"]
        OrchSvc["Lead Orchestrator Service<br/>(Two-Phase State Machine)"]
        SM["State Machine Rules<br/>(received -> validating -> ... -> completed)"]
        Retry["Bounded Retry Engine<br/>(Exponential Backoff)"]
    end

    subgraph DatabaseLayer ["PostgreSQL 16 (Drizzle ORM)"]
        LeadsTable[("leads<br/>• Idempotency Key (Unique)<br/>• Processing Status<br/>• Notification Guard")]
        AuditTable[("workflow_attempts<br/>• Step & Attempt #<br/>• Status & Metadata<br/>• Error Reasons")]
    end

    subgraph ExternalAdapters ["External Services & Adapters"]
        LLM["AI Classifier Adapter<br/>(OpenAI-compatible: OpenAI / Gemini / Groq / Ollama / Mock)<br/>Prompt v1.0.0 + Zod Validation"]
        n8n["n8n Workflow Engine<br/>Authenticated Webhook<br/>HMAC-SHA256 Signature"]
    end

    WebForm -->|"POST /api/leads"| Sec
    Sec --> ReqId --> Val --> Err
    Val --> LeadSvc
    LeadSvc -->|"Atomic ON CONFLICT DO NOTHING"| LeadsTable
    LeadSvc --> OrchSvc
    OrchSvc --> SM
    OrchSvc -->|"1. Classify"| LLM
    OrchSvc -->|"Record Attempt"| AuditTable
    OrchSvc --> Retry
    Retry -->|"2. Outbound Webhook"| n8n
    n8n -->|"POST /api/webhooks/n8n/leads"| Sec
```

---

## 3. End-to-End Processing Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client as API Client / Prospect
    participant Fastify as Fastify Kernel
    participant LeadService as Lead Service
    participant Repo as Postgres Repository
    participant Classifier as AI Classifier
    participant Notifier as Webhook / n8n Sink

    Client->>Fastify: POST /api/leads (Payload + optional Idempotency-Key)
    Fastify->>Fastify: Validate schema & field lengths via Zod
    Fastify->>LeadService: submitLead(payload, idempotencyKey)
    LeadService->>LeadService: Compute SHA-256 natural deduplication key if needed
    LeadService->>Repo: create(lead) [ON CONFLICT (idempotency_key) DO NOTHING]

    alt Duplicate Submission
        Repo-->>LeadService: Conflict detected (returns existing lead)
        LeadService-->>Fastify: Return existing lead (HTTP 200)
        Fastify-->>Client: { lead: ..., isDuplicate: true }
    else Fresh Submission
        Repo-->>LeadService: Inserted new lead in 'received' state
        LeadService-->>Fastify: Return created lead (HTTP 201)
        Fastify-->>Client: { lead: ..., isDuplicate: false }
    end

    Note over LeadService,Notifier: Background / Explicit Workflow Orchestration
    LeadService->>Repo: Transition state: received -> classifying
    LeadService->>Classifier: classify(context)
    Classifier-->>LeadService: Structured Output (FitScore, Category, Action)
    LeadService->>Repo: Record classification attempt & transition: classifying -> classified

    alt Already Notified Guard
        Note over LeadService,Repo: If notification_sent = true, skip delivery
    else Notification Pending
        LeadService->>Repo: Transition: classified -> notification_pending
        LeadService->>Notifier: send(NotificationPayload) [with bounded exponential retry]
        Notifier-->>LeadService: Delivery Confirmation (MessageId, DeliveredAt)
        LeadService->>Repo: Update notification_sent = true & Transition -> completed
        LeadService->>Repo: Record successful notification attempt
    end
```

---

## 4. Architectural Boundaries and Component Responsibilities

### 4.1 HTTP & API Kernel (`src/http/`, `src/routes/`, `src/app.ts`)

- **Fastify Kernel**: High-performance HTTP server running on strict `NodeNext` ESM.
- **Security Middleware**: `@fastify/helmet` injects defensive HTTP headers; `@fastify/rate-limit` enforces a 100 req/min per-IP ceiling; `bodyLimit: 104857` prevents memory exhaustion via 100 KB payload limits.
- **Correlation Tracking**: Injects `x-request-id` into all response headers and echoes correlation IDs in every success or error response envelope.
- **Centralized Error Handling**: Transforms domain exceptions (`AppError`, `NotFoundError`, `ConflictError`, `ValidationError`) into standardized `{ error: { code, message, correlationId } }` envelopes without leaking internal stack traces.

### 4.2 Domain & State Machine (`src/domain/`)

- **Finite State Machine (`src/domain/workflows/state-machine.ts`)**:
  Enforces deterministic state transitions:
  $$\text{received} \longrightarrow \text{validating} \longrightarrow \text{classifying} \longrightarrow \text{classified} \longrightarrow \text{notification\_pending} \longrightarrow \text{completed}$$
  Failed states transition strictly to `failed` and can only be resumed via explicit retry transitions.
- **Retry Policy (`src/domain/workflows/retry-policy.ts`)**:
  Distinguishes transient errors (HTTP 429, 500, 502, 503, 504, timeouts) from permanent errors (validation errors, invalid states). Implements bounded exponential backoff with jitter.

### 4.3 Persistence & Idempotency Layer (`src/adapters/database/`)

- **PostgreSQL 16 & Drizzle ORM**: Fully parameterized type-safe queries preventing SQL injection.
- **Deterministic Deduplication**: Client can provide an explicit `Idempotency-Key` HTTP header. If omitted, the platform computes a deterministic natural deduplication hash:
  $$\text{idempotency\_key} = \text{SHA-256}(\text{normalizedEmail} + \text{":"} + \text{normalizedMessage})$$
- **Atomic Concurrency Control**: Uses database-level unique constraints (`ON CONFLICT (idempotency_key) DO NOTHING`) to eliminate race conditions between concurrent requests.
- **Durable Audit Trail (`workflow_attempts`)**: Logs each execution step, retry number, status (`retrying`, `success`, `failed`), and error reasons for full post-incident traceability.

### 4.4 AI Classification Layer (`src/domain/classification/`, `src/adapters/llm/`)

- **Provider-Independent Interface (`LeadClassifier`)**: Decouples application logic from specific LLM providers.
- **Config-Driven Factory (`classifier.factory.ts`)**: Selects the active provider at startup via `LLM_PROVIDER`. `mock` (default) is deterministic for CI; `openai` targets any OpenAI-compatible endpoint (`OPENAI_BASE_URL` + `OPENAI_MODEL`), including free providers like Google Gemini, Groq, and local Ollama.
- **Strict Output Parsing (`ClassifierOutputSchema`)**: LLM output is treated as untrusted data. Responses are validated against strict Zod schemas with controlled category and action enums.
- **Safety Controls**: Prompt versioning (`v1.0.0`), token budgets (`maxTokens: 300`), temperature controls (`0.2`), and `AbortController` timeouts (10s max).

### 4.5 n8n Workflow Automation (`src/adapters/notifications/`, `workflows/`)

- **Authenticated Webhooks**: Inbound requests require timing-safe `X-Webhook-Secret` verification. Outbound webhooks include `X-Webhook-Signature` HMAC-SHA256 digests.
- **Business Rule Isolation**: Core lead state transitions and duplicate checks stay within the TypeScript backend; n8n handles routing, CRM sync, and external notifications.

---

## 5. Security & Observability Architecture

- **Pino Structured Redaction**: Secret tokens, passwords, cookies, and webhook secrets are automatically redacted to `[REDACTED]` before leaving memory.
- **Zero-Credential Workflow Exports**: Exported n8n workflows (`workflows/lead-automation-workflow.json`) use environment variable references and sanitized templates.
