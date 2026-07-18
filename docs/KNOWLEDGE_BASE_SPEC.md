# PGP Architecture Intelligence — Knowledge Base Specification

## Overview

The knowledge base is a reusable catalog of best practices, standards, and guidelines. It links bidirectionally to audit findings and rules, providing authoritative references for every recommendation.

## Knowledge Categories

| Category | Description |
|---|---|
| `design_pattern` | Software design patterns |
| `clean_arch` | Clean Architecture principles |
| `ddd` | Domain-Driven Design |
| `hexagonal` | Hexagonal Architecture (Ports & Adapters) |
| `owasp` | OWASP security guidelines |
| `iso_27001` | ISO 27001 information security |
| `nist` | NIST cybersecurity framework |
| `gdpr` | GDPR compliance |
| `soc2` | SOC 2 compliance |
| `rest` | REST API best practices |
| `api_guidelines` | API design guidelines |
| `plugin_guideline` | Plugin development guidelines |
| `connector_guideline` | Connector development guidelines |
| `internal_pgp_standard` | Internal PGP Core standards |

## Knowledge Article Entity (`AuditKnowledgeArticle`)

| Field | Description |
|---|---|
| `key` | Unique article identifier |
| `title` | Article title |
| `category` | One of the knowledge categories above |
| `body_ref` | Reference/URL to markdown body in storage |
| `references` | External links (standards docs, specifications) |
| `tags` | Searchable tags |

## Bidirectional Linking

Knowledge articles link to:
- **Audit Findings** — `AuditFinding.knowledge_article_ids` references relevant articles
- **Audit Rules** — `AuditRuleDefinition.reference` points to relevant articles/standards
- **Assistant Citations** — `AuditAssistantMessage.citations` reference articles

This creates a web of evidence: every finding traces back to a rule, which traces back to a standard, which traces back to a knowledge article.

## Reference Architectures

The `internal_pgp_standard` category hosts reference architectures used by the benchmark system:
- PGP Core best practices reference
- Ideal scores per category
- Pattern catalogs

## Maintenance

- Knowledge articles are maintained by `solution_architect` and `core_developer` roles.
- Articles are versioned via the `body_ref` (storage URLs are immutable).
- Tags enable searchability across the knowledge base.

## Phase 1A Status

- Knowledge article entity schema created.
- All 14 knowledge categories defined.
- No article content, no linking engine, no search.
- All deferred to Phase 4.