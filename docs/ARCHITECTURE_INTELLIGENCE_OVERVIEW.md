# PGP Architecture Intelligence — Overview

## Mission

PGP Architecture Intelligence is an independent platform application running on top of PGP Core. It acts as an intelligent software architect and auditor — analyzing, reviewing, scoring, and documenting software systems, SaaS applications, CRM platforms, DMS systems, APIs, and software architectures.

## Boundaries

- **Read-only analysis**: The application never modifies customer projects. It only analyzes, scores, and generates reports.
- **No arbitrary code execution**: No code is executed against imported source.
- **No direct access to customer secrets**: Only references and metadata are stored.
- **Never just "Good" or "Bad"**: Every output explains Why · Evidence · Risk · Recommendation · Priority · Estimated Effort · Expected Improvement.

## Core Integration

PGP Architecture Intelligence consumes Core services rather than reimplementing them:
- **Identity & Tenancy** → Core `Organization` / `OrganizationMember`
- **Permissions** → Core `PlatformRole` / `Permission` (app defines its own permission keys)
- **Connectors** → Core 3-layer connector model (import sources are Core `ConnectorConnection`s)
- **AI Center** → Core AI providers/models/routing for Q&A assistant and auto-detection
- **Storage** → Core Storage for imported artifacts & generated reports
- **Communications** → Core Communications for report delivery
- **Audit & Events** → Core `AuditEvent` + `EventTopic`
- **Feature Flags** → Core `FeatureFlag` for app-gated capabilities

## Application Registration

Registered as an `ApplicationDefinition` in the Core catalog with key `pgp_architecture_intelligence`. Installable per-org via the Core application lifecycle.

## Primary Operators

- `solution_architect` — catalog, knowledge base, review governance
- `admin` / `user` — run audits on their org's projects
- `auditor` — read-only access to findings and reports

## Long-Term Goal

Become a professional software architecture review platform for consultants, software companies, and enterprise customers.

## Phase 1A Status

Architecture, entities, navigation placeholders, and documentation only. No audit engine, no scoring, no AI answers, no report generation, no source ingestion.