# PGP Architecture Intelligence — Scoring Engine Specification

## Overview

Each audit category produces a score across 8 dimensions. The run-level overall score is a weighted aggregate of category scores using the profile's default weights.

## Per-Category Dimensions (8)

Each `AuditCategoryScore` captures:

| Dimension | Type | Description |
|---|---|---|
| `score` | 0–100 | Category score |
| `weight` | 0–100 | Category weight in the profile |
| `risk_level` | enum | low, medium, high, critical |
| `priority` | enum | low, medium, high, urgent |
| `estimated_improvement_impact` | enum | low, medium, high — expected improvement if addressed |
| `estimated_implementation_effort` | enum | low, medium, high — effort to address |
| `business_impact` | enum | low, medium, high |
| `technical_debt_indicator` | enum | none, low, medium, high, critical |

## Overall Score

The `AuditRun.overall_score` is a weighted aggregate:

```
overall_score = Σ(category_score × category_weight) / Σ(category_weight)
```

Weights come from the `AuditProfileDefinition.default_weights` mapping, overridable per run via `AuditRun.config`.

## Risk Levels

| Level | Score Range | Description |
|---|---|---|
| low | 80–100 | Minimal risk, well-handled |
| medium | 60–79 | Some concerns, manageable |
| high | 40–59 | Significant risk, should address |
| critical | 0–39 | Severe risk, urgent attention needed |

## Priority Calculation

Priority is derived from risk level, business impact, and improvement impact:
- Critical risk + high business impact → urgent
- High risk + medium+ business impact → high
- Medium risk → medium
- Low risk → low

## Technical Debt Indicator

Reflects accumulated debt in the category:
- `none` — no significant debt
- `low` — minor debt, easy to address
- `medium` — moderate debt, planned attention
- `high` — significant debt, affecting velocity
- `critical` — severe debt, blocking progress

## Output Contract

Every score includes a `summary` explaining the result — never just a number. The summary must reference evidence and recommendations.

## Phase 1A Status

- Scoring model stored in `AuditCategoryScore` entity schema.
- No scoring computation engine.
- All deferred to Phase 2.