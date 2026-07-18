# PGP Architecture Intelligence — Report System Specification

## Overview

The report system generates structured reports from audit runs. Multiple report types serve different audiences. PDF export is architecture-only in Phase 1.

## Report Types (8)

| Type | Audience | Content |
|---|---|---|
| `executive_summary` | Leadership | High-level scores, top risks, strategic recommendations |
| `technical` | Engineering team | Detailed findings, code references, technical recommendations |
| `architecture` | Architects | Architecture-specific findings, patterns, diagrams references |
| `security` | Security team | Security findings, vulnerabilities, compliance notes |
| `compliance` | Compliance officers | GDPR, ISO 27001, SOC2 alignment, gaps |
| `improvement_roadmap` | PM/Engineering | Prioritized action plan with effort estimates |
| `technical_debt` | Engineering leads | Debt inventory, severity, repayment plan |
| `management` | Management | Business impact, risk summary, resource needs |

## Report Entity (`AuditReport`)

| Field | Description |
|---|---|
| `run_id` | Source audit run |
| `report_type` | One of the 8 types |
| `status` | pending, generating, ready, failed |
| `content_ref` | Storage URL to generated artifact (non-sensitive) |
| `format` | json, html, pdf (pdf reserved) |
| `generated_by_id` | User who triggered generation |
| `generated_date` | When generated |

## PDF Export Architecture

- PDF generation is server-side only (Phase 4).
- Reports are generated as artifacts stored in Core Storage.
- `content_ref` points to the stored artifact.
- Delivery via Core Communications (email) or signed URLs.
- No client-side PDF generation to avoid inconsistency.

## Report Content

Every report section follows the output contract:
- **Why** — explanation of the finding
- **Evidence** — supporting data
- **Risk** — risk level and explanation
- **Recommendation** — actionable advice
- **Priority** — urgency level
- **Estimated Effort** — implementation effort
- **Expected Improvement** — impact of addressing

## Report Generation Flow (Future)

```
AuditRun (completed)
    ↓ [trigger report]
AuditReport (status: pending → generating)
    ↓ [server-side generation]
AuditReport (status: ready, content_ref set)
    ↓ [delivery]
Core Communications (email) or signed URL download
```

## Phase 1A Status

- Report entity schema created.
- 8 report types defined in the enum.
- PDF format reserved in the schema.
- No generation runtime, no PDF export, no delivery.
- All deferred to Phase 4.