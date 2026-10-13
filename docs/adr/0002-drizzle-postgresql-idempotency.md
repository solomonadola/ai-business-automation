# ADR 0002: PostgreSQL, Drizzle ORM, and Atomic Idempotency Strategy

## Status

Accepted

## Context

Lead generation systems frequently encounter duplicate submissions due to user double-clicking, network retry storms, or upstream webhook replay. In-memory deduplication fails across distributed processes and restarts.

## Decision

We adopted **PostgreSQL 16** with **Drizzle ORM** for persistent storage and an atomic idempotency strategy:

1. **Schema-Level Constraints**: A unique index on `leads.idempotency_key` guarantees that no two records can share the same key.
2. **Two-Tier Deduplication Key Generation**:
   - If the client supplies an `Idempotency-Key` header, it is respected.
   - If omitted, a natural deduplication key is derived deterministically:
     $$\text{idempotency\_key} = \text{SHA-256}(\text{normalizedEmail} + \text{":"} + \text{normalizedMessage})$$
3. **Atomic Concurrency Handling**:
   ```sql
   INSERT INTO leads (...) VALUES (...)
   ON CONFLICT (idempotency_key) DO NOTHING;
   ```
   If a conflict occurs, the database query atomically returns empty, and the repository fetches and returns the existing record without throwing an unhandled exception or duplicating downstream jobs.
4. **Drizzle ORM**: Selected over Prisma for zero-runtime engine binaries, SQL transparency, and optimal performance under TypeScript `NodeNext`.

## Consequences

- Requires PostgreSQL running for integration testing. Vitest test runner disables file parallelism (`fileParallelism: false`) to avoid table truncation race conditions.
- Deduplication is durable across app crashes and container restarts.
