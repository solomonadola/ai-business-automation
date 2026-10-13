# ADR 0003: Provider-Agnostic LLM Interface with Runtime Schema Validation

## Status

Accepted

## Context

Integrating Large Language Models carries risks of vendor lock-in, non-deterministic output, prompt injection, and excessive token spend. Production workflows require structured, schema-validated classifications.

## Decision

1. **Interface Decoupling**: Defined a strict `LeadClassifier` domain interface:
   ```ts
   export interface LeadClassifier {
     classify(context: ClassificationContext): Promise<LeadClassification>;
   }
   ```
2. **Untrusted Model Guardrails**:
   - Model output is treated as untrusted input and validated via Zod schema (`ClassifierOutputSchema`).
   - Categories (`high_fit`, `medium_fit`, `low_fit`, `disqualified`) and actions (`schedule_follow_up`, `send_info_packet`, `route_to_partner`, `nurture_campaign`, `no_action`) are bounded enums.
   - Any schema mismatch rejects the model output immediately without triggering downstream actions.
3. **Prompt Versioning**: Classification prompts are centralized and versioned (`v1.0.0`).
4. **Safety & Cost Controls**:
   - Timeouts enforced via `AbortController` (10s max).
   - Token budget capped at `maxTokens: 300` per completion.
   - Temperature locked to `0.2` for deterministic scoring.
   - Deterministic `MockLeadClassifier` enables 100% offline, zero-cost CI testing.

## Consequences

- No paid LLM calls occur in the default test suite.
- Swapping LLM vendors (OpenAI, Anthropic, Ollama, LocalAI) requires only implementing the `LeadClassifier` interface.
