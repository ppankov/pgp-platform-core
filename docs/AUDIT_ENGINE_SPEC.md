# PGP Architecture Intelligence — Audit Engine Specification

## Overview

The audit engine analyzes software systems using reusable audit profiles, independent audit categories, and a flexible rule engine. Each audit run produces category scores, rule evaluations, and concrete findings.

## Audit Flow (Future)

```
AuditProject
    ↓ [add sources]
AuditProjectSource (git, openapi, zip, etc.)
    ↓ [start run]
AuditRun
    ↓ [evaluate rules per category]
AuditRuleEvaluation (per rule)
    ↓ [aggregate per category]
AuditCategoryScore (per category — 8 dimensions)
    ↓ [generate findings]
AuditFinding (concrete, actionable)
    ↓ [generate reports]
AuditReport (8 report types)
```

## Audit Profiles

Reusable profiles define criteria, weights, and recommendations for specific system types:
- CRM, ERP, DMS, Social Network, Marketplace, CMS
- AI Platform, REST API, Mobile Backend
- Microservices, Monolith, Desktop Application
- Industrial Automation Software, Embedded Systems, IoT Platform, Cloud Platform

Each profile (`AuditProfileDefinition`) defines:
- `criteria` — evaluation criteria
- `default_weights` — category weight mapping
- `recommendation_templates` — templated recommendations
- `applicable_categories` — which of the 20 categories to evaluate

## Audit Categories (20)

Architecture Review, Security Review, Code Quality Review, Performance Review, Scalability Review, Database Review, API Review, UX Review, Accessibility Review, SEO Review, GDPR Review, Documentation Review, Deployment Review, DevOps Review, Cloud Readiness, AI Readiness, Plugin Architecture, Connector Architecture, Observability, Maintainability.

## Audit Run

An `AuditRun` captures:
- `project_id`, `profile_definition_id`
- `version` (project version at run time)
- `status` (pending, running, completed, failed)
- `config` (categories included, ruleset)
- `overall_score` (weighted aggregate)

## Entity Relationships

```
AuditProject (org-scoped)
    ├─ AuditProjectSource (multiple import sources)
    └─ AuditRun (multiple runs over time)
         ├─ AuditRuleEvaluation (per rule)
         ├─ AuditCategoryScore (per category)
         ├─ AuditFinding (concrete findings)
         └─ AuditReport (generated reports)
```

## Phase 1A Status

- Entity schemas created.
- Navigation placeholders exist.
- No execution engine, no rule evaluation, no scoring computation.
- All deferred to Phase 2.