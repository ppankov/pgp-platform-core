# PGP Architecture Intelligence — Rule Engine Specification

## Overview

The rule engine is flexible — rules are data, not hardcoded logic. Each rule defines what to check, how to detect it, how to verify it manually, what evidence to collect, and what recommendation to make.

## Rule Definition (`AuditRuleDefinition`)

| Field | Description |
|---|---|
| `key` | Unique rule identifier |
| `name` | Rule name |
| `description` | What the rule checks |
| `category` | Reference to `AuditCategoryDefinition` |
| `weight` | 0–100 — rule's weight within its category |
| `severity` | info, low, medium, high, critical |
| `recommendation` | Recommended action when the rule fails |
| `automatic_detection` | Method and hints for automated detection (future engine) |
| `manual_verification` | Steps for manual verification |
| `evidence_type` | Expected evidence type (code_sample, config, doc, metric) |
| `reference` | Standards/document links (OWASP, ISO 27001, etc.) |

## Rule Evaluation (`AuditRuleEvaluation`)

| Field | Description |
|---|---|
| `run_id` | Reference to the audit run |
| `rule_definition_id` | Reference to the rule |
| `status` | pass, fail, warning, not_applicable, manual |
| `evidence` | Array of evidence items supporting the evaluation |
| `auto_detection_result` | Result from automatic detection (future) |
| `manual_verification_result` | Result from manual verification |
| `notes` | Evaluator notes |

## Evaluation Status

| Status | Meaning |
|---|---|
| `pass` | Rule satisfied, no issues |
| `fail` | Rule violated, issue found |
| `warning` | Rule partially satisfied, attention recommended |
| `not_applicable` | Rule doesn't apply to this system |
| `manual` | Requires manual verification (default in Phase 1) |

## Automatic Detection (Future)

The `automatic_detection` object describes how the future engine should detect the rule:
```json
{
  "method": "pattern_match",
  "patterns": ["TODO", "FIXME", "HACK"],
  "file_types": [".js", ".ts", ".py"]
}
```

The future engine reads this and produces `auto_detection_result`.

## Manual Verification

The `manual_verification` object describes steps for a human evaluator:
```json
{
  "steps": [
    "Check if authentication uses JWT",
    "Verify token expiration is enforced",
    "Confirm refresh token rotation is implemented"
  ]
}
```

## Evidence

Evidence items support the evaluation:
```json
{
  "type": "code_sample",
  "location": "src/auth.js:42",
  "content": "..."
}
```

## References

Rules link to standards and documentation:
```json
{
  "standards": ["OWASP A07:2021", "ISO 27001 A.9"],
  "documentation": ["knowledge_base/authentication_best_practices"]
}
```

## Phase 1A Status

- Rule definition and evaluation entity schemas created.
- No evaluation engine, no automatic detection runtime.
- All rules default to `manual` status.
- All deferred to Phase 2+.