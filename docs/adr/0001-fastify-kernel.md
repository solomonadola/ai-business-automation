# ADR 0001: Adoption of Fastify as Application HTTP Kernel

## Status

Accepted

## Context

The platform requires an HTTP framework that supports strict TypeScript (`NodeNext`), high throughput, centralized error handling, robust plugin lifecycle management, and built-in structured logging with sensitive field redaction.

## Decision

We adopted **Fastify (v5)** as the application kernel rather than Express or NestJS.

- **Fastify** natively integrates with Pino for high-performance structured JSON logging.
- Built-in `requestId` and `requestIdHeader` hooks support distributed tracing and correlation IDs out of the box.
- Encapsulated plugin architecture allows modular isolation of security headers, rate limiting, and domain route registrations.
- Fastify avoids the heavyweight dependency overhead and decorators of NestJS while providing significantly stronger async performance and schema handling than Express.

## Consequences

- Route registrations must handle asynchronous plugins using Fastify's lifecycle hooks.
- Consistent error formatting requires mapping Fastify's native HTTP errors (`FST_ERR_*`) to the platform's standardized error envelope.
