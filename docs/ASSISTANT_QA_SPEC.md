# PGP Architecture Intelligence — Assistant Q&A Specification

## Overview

The AI-powered architecture assistant answers questions about analyzed systems using audit findings, rule evaluations, and knowledge base articles. It is backed by the Core AI Center and never fabricates evidence.

## Conversation Model

```
AuditAssistantThread
    ├─ AuditAssistantMessage (role: user)
    ├─ AuditAssistantMessage (role: assistant, with citations)
    ├─ AuditAssistantMessage (role: user)
    └─ ...
```

## Citation Contract (Critical)

Every assistant response **must** include `citations` — references to findings, rules, or knowledge articles that support the answer. Responses without citations are invalid.

```json
{
  "role": "assistant",
  "content": "The authentication architecture scores 72/100. JWT is used but token rotation is missing...",
  "citations": [
    { "type": "finding", "id": "finding_123", "label": "Missing refresh token rotation" },
    { "type": "rule", "id": "rule_456", "label": "AUTH-007: Refresh token rotation" },
    { "type": "knowledge", "id": "article_789", "label": "Authentication Best Practices" }
  ]
}
```

## Example Questions

The assistant is designed to answer:
- "How good is the authentication architecture?"
- "What are the weakest modules?"
- "Where is the highest technical debt?"
- "Which security risks should be fixed first?"
- "Is the plugin system scalable?"
- "Would this architecture support one million users?"
- "How difficult would self-hosting be?"
- "Does this project suffer from vendor lock-in?"

## Grounding

The assistant is grounded in:
1. **Audit findings** — concrete issues found during runs
2. **Rule evaluations** — pass/fail status of specific rules
3. **Category scores** — quantitative scores per category
4. **Knowledge articles** — best practices and standards

No answer is based on general LLM knowledge alone — every claim traces to stored data.

## Hallucination Prevention

- Citations are required (enforced at schema level).
- The backend (Phase 3) validates that cited findings/rules/articles exist before returning the response.
- If the assistant cannot ground an answer, it says so explicitly.
- Sensitive data from findings is never exposed in responses to unauthorized roles.

## Core AI Center Integration

The assistant uses the Core AI Center for:
- **Provider abstraction** — no vendor lock-in to a specific LLM
- **Routing** — complex architecture questions may route to higher-capability models
- **Prompt library** — system prompts are managed via the AI Center
- **Usage tracking** — token usage is tracked per org
- **Cost tracking** — costs are attributed to the application

## Thread Context

- Threads can be project-scoped (`project_id` set) or general architecture questions (`project_id` null).
- Project-scoped threads have access to that project's findings and runs.
- General threads can only reference knowledge base articles and standards.

## Phase 1A Status

- Thread and message entity schemas created.
- Citation field is required at schema level.
- No AI runtime, no LLM integration, no grounding engine.
- All deferred to Phase 3.