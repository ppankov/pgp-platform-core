# PGP Core — AI Center Architecture

## Overview

The AI Center is a comprehensive architecture for managing AI providers, models, routing, prompts, usage, costs, and logs. It abstracts AI providers so the platform never depends on a specific LLM.

## Modules

### Providers
Manages AI provider connections (OpenAI, Gemini, Claude, Grok, OpenRouter, Ollama). Uses the Core connector model — providers are accessed via `ConnectorConnection`.

### Models
Catalog of available AI models per provider. Each model has capabilities, context window, cost per token, and metadata.

### Routing
Routes requests to the appropriate model based on task type, cost, capability, and availability. Enables fallback chains (e.g. try Claude, fall back to Gemini).

### Prompt Library
Reusable prompt templates with variables. Versioned and shareable across applications.

### Agents (Future)
Architecture placeholder for AI agent management. Agents are autonomous AI entities that use tools, access entities, and execute workflows. No implementation in Phase 1.

### Usage Statistics
Tracks AI usage per org, per application, per model. Includes token counts, request counts, and success rates.

### Costs
Tracks AI costs per org, per application, per model. Enables budget limits and cost alerts.

### Logs
AI request/response logs for debugging and audit. Sensitive data is redacted.

## Architecture Principles

- **Provider abstraction**: The platform never depends on a specific LLM. All providers accessed via connectors.
- **Routing flexibility**: Different tasks can use different models via routing rules.
- **Cost transparency**: Usage and costs are tracked per org and per application.
- **Audit readiness**: AI logs are available for compliance and debugging.

## Integration with Core

- Providers are `ConnectorConnection`s (Core connector model).
- AI configurations are `ServiceConfiguration` entries with `service_type = 'ai'`.
- Usage and costs flow into the Operations layer (Monitoring, Audit).
- The AI Center serves all installed applications (e.g. PGP Architecture Intelligence's Q&A assistant).

## Entities (Future)

Phase 2+ will introduce:
- `AIModel` — model catalog per provider
- `AIRoutingRule` — routing rules
- `AIPromptTemplate` — prompt library entries
- `AIUsageRecord` — usage tracking
- `AICostRecord` — cost tracking

These are not created in Phase 1 to avoid speculative schemas.

## Phase 1 Status

- Navigation placeholders exist for all 8 sub-modules.
- No entity schemas for AI-specific entities (deferred to Phase 2).
- No routing engine, no model registry, no prompt library runtime.
- All deferred to Phase 2+.