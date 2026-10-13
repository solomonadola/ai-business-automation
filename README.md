# AI Business Automation Platform

**A portfolio-grade project demonstrating reliable business automation, full-stack engineering, and practical AI integration.**

## 1. Project Overview

### The problem

Small businesses often process incoming leads manually. They receive inquiries, validate contact details, research potential customers, classify leads, update their CRM, and notify sales teams.

This process is repetitive, time-consuming, and prone to errors.

### Our solution

Build an AI-powered business automation platform that accepts incoming leads, validates their information, classifies them using an LLM, stores the results, and notifies the appropriate person.

The system must be reliable, secure, testable, and easy to extend.

**Core workflow:**

1. Receive a lead through an API or form.
2. Validate and normalize the submitted data.
3. Detect duplicate submissions.
4. Classify the lead using an LLM.
5. Validate the AI-generated output.
6. Store the lead and classification in a database.
7. Notify the sales team.
8. Record processing history and failures.
9. Retry eligible failures safely without creating duplicate records or notifications.

## 2. Project Goals

This project should demonstrate the ability to:

- Design and implement a maintainable TypeScript backend.
- Build reliable API integrations.
- Integrate LLMs into real business workflows.
- Use n8n for workflow orchestration.
- Design database schemas and enforce data integrity.
- Implement idempotency, retries, and error recovery.
- Write unit, integration, and end-to-end tests.
- Protect API keys and sensitive data.
- Implement CI/CD with GitHub Actions.
- Document architecture and technical trade-offs.
- Deploy and demonstrate a working application.

The goal is not simply to make an AI demo. It is to build a small but credible business system.

## 3. Proposed Technology Stack

Start with a minimal stack and add dependencies only when necessary.

| Area            | Technology                                      |
| --------------- | ----------------------------------------------- |
| Language        | TypeScript with strict mode                     |
| Runtime         | Supported Node.js LTS                           |
| Backend         | Fastify or another lightweight HTTP framework   |
| Validation      | Zod                                             |
| Database        | PostgreSQL                                      |
| Testing         | Vitest                                          |
| Formatting      | Prettier                                        |
| Linting         | ESLint                                          |
| AI              | LLM API behind a provider-independent interface |
| Automation      | n8n                                             |
| Version control | Git and GitHub                                  |
| CI/CD           | GitHub Actions                                  |
| Deployment      | Choose after the local application works        |

### Architectural Decisions Recorded

- **Backend Framework: Fastify (v5)**
  - _Decision:_ Fastify was chosen over Express and NestJS.
  - _Rationale:_ Lightweight, high-throughput, schema-driven, native TypeScript typings, and built-in Pino structured logging. Vitest tests can execute in-memory HTTP requests using `app.inject()` without binding to network ports, preventing port collision in CI.
- **Database Client: Drizzle ORM with PostgreSQL (Milestone 2+)**
  - _Decision:_ Drizzle ORM with `pg` was chosen over Prisma.
  - _Rationale:_ Zero runtime engine overhead (no heavy Rust binary), transparent SQL execution semantics, full control over transactional idempotency patterns (`ON CONFLICT DO NOTHING`, advisory locks), and reviewable `.sql` migrations via `drizzle-kit`.

Do not introduce Redis, Kafka, Kubernetes, microservices, or vector databases without a demonstrated requirement.

## 4. Milestone Roadmap

### Milestone 0 — Engineering Foundation

**Objective:** Establish a professional development environment.

Tasks:

- [x] Create the repository.
- [x] Initialize the TypeScript project.
- [x] Enable TypeScript strict mode.
- [x] Configure ESLint and Prettier.
- [x] Configure Vitest.
- [x] Create `.gitignore`.
- [x] Create `.env.example` containing placeholders only.
- [x] Add a health-check endpoint.
- [x] Add a basic automated test.
- [x] Configure GitHub Actions.
- [x] Document installation and development commands.

#### Quickstart & Development Commands

```bash
# 1. Install dependencies
npm install

# 2. Check code style and formatting
npm run format:check

# 3. Automatically format code
npm run format

# 4. Run linter
npm run lint

# 5. Type-check with strict TypeScript
npm run typecheck

# 6. Run automated tests (Vitest)
npm test

# 7. Build for production (outputs to dist/)
npm run build

# 8. Start local development server with hot reload
npm run dev

# 9. Start production server
npm start
```

**Acceptance criteria:**

- A fresh checkout can install dependencies.
- Formatting, linting, type-checking, tests, and build succeed.
- No secrets are committed.
- CI runs automatically on pushes and pull requests.

Do not implement AI, database integration, or n8n in this milestone.

### Milestone 1 — Lead Intake API

**Objective:** Receive and validate lead submissions.

Implement an endpoint:

`POST /api/leads`

Example request:

```json
{
  "name": "Jordan Lee",
  "email": "jordan@example.com",
  "company": "Example Co",
  "website": "https://example.com",
  "message": "We need help automating our sales process."
}
```

Tasks:

- [x] Define the lead data model.
- [x] Create request validation schemas.
- [x] Validate email format and required fields.
- [x] Enforce sensible field-length limits.
- [x] Normalize appropriate fields.
- [x] Return consistent success and error responses.
- [x] Add unit tests for validation.
- [x] Add API tests for valid and invalid requests.
- [x] Separate HTTP handling from business logic.

**Acceptance criteria:**

Valid requests are accepted. Invalid requests return predictable 4xx responses. Invalid submissions never trigger downstream processing.

### Milestone 2 — Database and Idempotency

**Objective:** Persist leads reliably.

Tasks:

- [x] Set up PostgreSQL.
- [x] Design the database schema.
- [x] Add database migrations.
- [x] Implement a repository layer.
- [x] Store leads and their processing status.
- [x] Add a durable deduplication or idempotency strategy.
- [x] Test repeated requests.
- [x] Test concurrent duplicate submissions.
- [x] Handle database failures safely.

**Acceptance criteria:**

Repeated requests do not create duplicate lead records. Database constraints enforce important invariants instead of relying solely on application code.

### Milestone 3 — AI Lead Classification

**Objective:** Integrate an LLM safely and predictably.

The AI should classify a lead using the supplied information.

Example output:

```json
{
  "category": "high_fit",
  "score": 85,
  "reasoning_summary": "The lead describes a clear business automation need.",
  "recommended_action": "schedule_follow_up"
}
```

Use controlled categories and actions rather than unrestricted model-generated commands.

Tasks:

- [x] Create a provider-independent `LeadClassifier` interface.
- [x] Define a structured output schema.
- [x] Implement the LLM provider adapter.
- [x] Write and version the classification prompt.
- [x] Validate the returned output at runtime.
- [x] Handle timeouts and rate limits.
- [x] Handle malformed or invalid model output.
- [x] Add configurable retry limits.
- [x] Add cost and token limits.
- [x] Create deterministic mock-based tests.
- [x] Keep API keys on the server.

**Acceptance criteria:**

The application accepts only schema-valid AI output. Failed classifications are recorded explicitly. Invalid output cannot bypass business rules.

### Milestone 4 — Workflow Orchestration and Notifications

**Objective:** Complete the lead-processing workflow.

Tasks:

- [ ] Define explicit processing states.
- [ ] Implement the lead-processing use case.
- [ ] Add a notification adapter.
- [ ] Start with a development notification sink or test provider.
- [ ] Implement bounded retries with backoff.
- [ ] Distinguish transient and permanent errors.
- [ ] Record processing attempts.
- [ ] Prevent duplicate notifications on retries.
- [ ] Add a way to inspect failed jobs.
- [ ] Add integration tests for failure recovery.

Possible states:

`received → validated → classifying → classified → notification_pending → completed`

Failed work should transition to an appropriate failure or review state.

Use a transactional outbox or equivalent durable pattern if needed to coordinate database changes and external notifications reliably.

**Acceptance criteria:**

A lead can complete the workflow. Transient failures can be retried safely, and permanent failures remain visible for investigation.

### Milestone 5 — n8n Integration

**Objective:** Introduce workflow automation without hiding business logic inside an untestable visual workflow.

Tasks:

- [ ] Run n8n locally.
- [ ] Design the workflow boundaries.
- [ ] Connect n8n to the backend using authenticated webhooks.
- [ ] Validate every incoming webhook payload.
- [ ] Handle duplicate deliveries.
- [ ] Store credentials securely.
- [ ] Export a sanitized workflow into `workflows/`.
- [ ] Document how to import and execute it.
- [ ] Test failures and retries.

Keep critical business rules in the backend. Use n8n for orchestration and integrations where it provides a clear benefit.

**Acceptance criteria:**

Another developer can reproduce the workflow from the documentation. Exported workflow files contain no secrets.

### Milestone 6 — Security and Observability

**Objective:** Make failures diagnosable and reduce security risks.

Tasks:

- [ ] Add structured logging.
- [ ] Add request or correlation IDs.
- [ ] Redact secrets and unnecessary personal information.
- [ ] Validate environment variables at startup.
- [ ] Add sensible request-size limits and timeouts.
- [ ] Add rate limiting where appropriate.
- [ ] Review webhook authentication.
- [ ] Review database access controls.
- [ ] Test provider outages and timeout behavior.
- [ ] Document data retention and deletion.
- [ ] Review dependencies and enable appropriate security scanning.

**Acceptance criteria:**

The system provides useful diagnostic information without exposing credentials or unnecessary sensitive data.

### Milestone 7 — Deployment and Portfolio Release

**Objective:** Make the project easy to run, evaluate, and understand.

Tasks:

- [ ] Select a suitable deployment target.
- [ ] Configure environment variables securely.
- [ ] Document database setup and migrations.
- [ ] Deploy a demo where practical.
- [ ] Add an architecture diagram.
- [ ] Add API examples.
- [ ] Add screenshots or a short demo video.
- [ ] Document trade-offs and known limitations.
- [ ] Add a troubleshooting guide.
- [ ] Tag a release after CI passes.

**Acceptance criteria:**

A reviewer can understand the architecture, reproduce the workflow, inspect the tests, and see how important failures are handled.

## 5. Proposed Project Structure

Start small and introduce folders when they are needed.

```text
ai-business-automation/
├── src/
│   ├── app/
│   ├── config/
│   ├── domain/
│   │   ├── leads/
│   │   ├── classification/
│   │   └── workflows/
│   ├── services/
│   ├── adapters/
│   │   ├── database/
│   │   ├── llm/
│   │   └── notifications/
│   ├── http/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── schemas/
│   └── observability/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── workflows/
├── docs/
│   ├── architecture.md
│   ├── threat-model.md
│   ├── runbook.md
│   └── adr/
├── .github/
│   └── workflows/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

This is a target structure, not a requirement to create empty files and folders immediately.

Keep domain logic testable without starting an HTTP server, calling a paid LLM, or contacting an external service.

## 6. API and Error Handling Principles

Use consistent response formats.

Example error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "correlationId": "request-id"
  }
}
```

Rules:

- Never expose stack traces to API clients.
- Never expose API keys, internal database errors, or sensitive prompts.
- Use appropriate HTTP status codes.
- Return a stable error code for programmatic handling.
- Distinguish synchronous processing from queued processing.
- Do not report completion until the persisted workflow state confirms completion.

## 7. Reliability Requirements

These are core requirements, not optional enhancements.

### Idempotency

Assume clients and workflow engines can deliver the same request multiple times.

Use durable database-backed idempotency or deduplication. An in-memory check is insufficient for a production service.

### Retries

Retry only eligible failures, with bounded attempts and backoff. Invalid input should not be retried indefinitely.

### LLM safety

Treat LLM output as untrusted input. Validate structured results and never execute arbitrary model-generated instructions.

### Cost controls

Configure timeouts, token limits, retry limits, and usage budgets. Avoid repeated paid calls when a previous result can safely be reused.

### Observability

Record state transitions, processing attempts, and failure reasons. Include correlation IDs, but do not log secrets.

### External side effects

A timeout does not always mean an external provider failed to process a request. Use provider-supported idempotency features where available and document any remaining uncertainty.

## 8. Testing Strategy

### Unit tests

Test:

- Input validation.
- Data normalization.
- Classification schema validation.
- Business rules.
- Workflow state transitions.
- Retry decisions.
- Error mapping.

### Integration tests

Test:

- API requests against a test database.
- Database constraints.
- Migrations.
- Duplicate requests.
- Failure recovery.

### End-to-end tests

Submit a lead and verify its persisted status and notification outcome using controlled test adapters.

### CI rules

The default CI suite must not depend on paid LLM calls, live email accounts, or real production credentials.

Use deterministic mocks and test fixtures. Add separately configured smoke tests for real integrations only when needed.

## 9. Security Checklist

- [ ] `.env` and secret files are ignored by Git.
- [ ] `.env.example` contains placeholders only.
- [ ] No credentials appear in source code or logs.
- [ ] Inputs have schema and length validation.
- [ ] Provider requests have timeouts and response-size limits.
- [ ] Webhooks are authenticated.
- [ ] Database queries use parameterized access through the chosen client.
- [ ] Administrative endpoints require appropriate authorization.
- [ ] Personal information is logged only when necessary.
- [ ] Dependencies and secrets are scanned where practical.

## 10. Git and Development Workflow

For each feature:

1. Write acceptance criteria.
2. Inspect the existing code.
3. Agree on a minimal design.
4. Implement one small, coherent change.
5. Add or update tests.
6. Run formatting, linting, type-checking, tests, and build.
7. Review the diff for accidental changes and secrets.
8. Update documentation.
9. Commit with a descriptive message.

Examples:

```text
chore: initialize TypeScript service
feat: validate incoming leads
test: cover invalid lead payloads
feat: persist leads with idempotency
feat: add structured lead classification
fix: prevent duplicate notifications on retry
```

## 11. Rules for the Coding Agent

Work on **one milestone at a time**. Never ask the agent to implement the entire roadmap in one operation.

For each task, the agent must:

- Inspect the repository before editing.
- Explain the existing architecture relevant to the task.
- State assumptions and acceptance criteria.
- Propose the smallest reasonable implementation.
- Explain major dependency or architecture choices.
- Write tests for success and failure cases.
- Run relevant checks and report actual results.
- List changed files and remaining risks.
- Avoid unrelated refactors.
- Never invent test results or claim a command passed unless it ran.
- Never commit secrets or use production credentials.
- Ask before introducing significant new infrastructure.

## 12. Definition of Done

A feature is complete only when:

- [ ] Its acceptance criteria are met.
- [ ] Important success and failure paths are tested.
- [ ] Relevant automated checks pass.
- [ ] Errors are handled intentionally.
- [ ] No secrets or unnecessary sensitive data are exposed.
- [ ] Documentation matches the actual behavior.
- [ ] The code diff contains no unrelated changes.
- [ ] The agent's report has been verified.

## 13. Final Portfolio Deliverables

At completion, the repository should contain:

- A clear README and reproducible setup instructions.
- An architecture diagram.
- Architecture Decision Records explaining significant choices.
- API examples and sanitized sample payloads.
- Automated tests and CI evidence.
- A demonstration of the complete workflow.
- A security and reliability overview.
- A troubleshooting and recovery guide.
- A short retrospective discussing limitations and future improvements.

## 14. Out of Scope for the Initial Release

Do not start with:

- Multiple microservices.
- Autonomous agents with unrestricted tool access.
- RAG or vector databases without a demonstrated need.
- Complex CRM integrations before the core workflow is reliable.
- Bulk email campaigns.
- Kubernetes or elaborate infrastructure.
- Real paid LLM calls in the default test suite.

First prove that one lead can move reliably through one complete workflow.

---

# First Task: Milestone 0 Only

Ask the coding agent to inspect the repository and environment, then propose the smallest TypeScript project setup.

It should configure:

- Strict TypeScript.
- Formatting and linting.
- Unit testing.
- `.gitignore` and `.env.example`.
- A health-check endpoint.
- A basic test.
- README setup commands.
- GitHub Actions for formatting, linting, type-checking, tests, and build.

**Do not implement lead processing, database integration, n8n, or LLM calls yet.**

The milestone is complete when a fresh checkout can install dependencies and pass all documented checks.

The objective is to understand and verify every meaningful change, not simply accept whatever code the agent generates.
