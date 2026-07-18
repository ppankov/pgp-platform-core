# PGP Core — Architecture Decision Records

## ADR-001: Core as Operating System for SaaS

**Decision**: PGP Core is an operating system for SaaS applications, not a single application.
**Rationale**: Multiple business applications (MyFeed, DocFlowTools, CRM, etc.) need shared auth, organizations, permissions, services, and administration. Building these per-app is wasteful and inconsistent.
**Consequence**: The Core must remain stable and small. All business logic lives in installable applications.

## ADR-002: Platform Implementation Rule

**Decision**: Features are evaluated in order: Configuration → Plugin → Connector → Application → Core modification.
**Rationale**: The Core must remain as stable and as small as possible. Most capabilities belong in plugins, connectors, or applications.
**Consequence**: Core modifications are the last resort, requiring strong justification.

## ADR-003: 9-Role Model with Separated Branches

**Decision**: 9 system roles across 7 branches (admin, developer, architecture, oversight, operations, end_user, limited).
**Rationale**: Admin and Developer are different permission branches with different concerns. `solution_architect` provides design governance without runtime mutation rights. Developer access must not automatically grant access to private user data.
**Consequence**: Role checks are explicit per capability. The built-in `User.role` field carries the platform role.

## ADR-004: Organization-Based Multi-Tenancy

**Decision**: Organizations are the primary tenant boundary. All tenant-owned entities carry `organization_id`.
**Rationale**: Clean tenant isolation is essential for a multi-app platform. Users may belong to multiple orgs.
**Consequence**: Every org-scoped query includes `organization_id` at the query level. No "fetch all then filter."

## ADR-005: 3-Layer Connector Model

**Decision**: Connectors are split into Definition → Provider → Connection.
**Rationale**: One connector type (e.g. Google Drive) may have multiple providers (Google, Microsoft). One provider may have many org connections. This avoids duplication and enables provider abstraction.
**Consequence**: Three entities instead of one. List queries filter at the Connection level by `organization_id`.

## ADR-006: Secrets Never in Entities

**Decision**: No entity field stores raw secrets. `token_ref` and `is_sensitive` patterns use references only.
**Rationale**: Secrets in database fields are a security risk. List APIs must never leak secrets.
**Consequence**: Secrets live in environment variables / token stores. Entities store references only.

## ADR-007: Frontend Visibility Is Not Security

**Decision**: `PermissionGate` and navigation role-filtering are UX only. All authorization is backend-enforced.
**Rationale**: Frontend checks can be bypassed. Security must be at the backend.
**Consequence**: Phase 2+ backend functions enforce authorization before every mutation.

## ADR-008: API-First Design

**Decision**: Every platform capability is accessible via REST. GraphQL is a future facade.
**Rationale**: API-first enables third-party integrations, mobile clients, and automation.
**Consequence**: Resources map to entities. Standard envelope. Scoped API keys. See `API_DESIGN_GUIDE.md`.

## ADR-009: Event Bus Reservation

**Decision**: Reserve Event Bus architecture via `EventTopic` catalog. No dispatch runtime in Phase 1.
**Rationale**: Platform events (app installed, plugin enabled, connector connected) are needed for audit and automation, but the dispatch runtime is complex.
**Consequence**: `EventTopic` catalog exists. `AuditEvent.event_topic` links audit entries for future correlation. Dispatch is Phase 2+.

## ADR-010: Module Dependency Model

**Decision**: Every definition (Application, Plugin, Connector) carries a `manifest` with dependencies, required connectors, services, permissions, and platform version.
**Rationale**: Prevents broken installations where dependencies aren't met.
**Consequence**: Manifest is metadata in Phase 1. Runtime validation is Phase 2+.

## ADR-011: PGP Architecture Intelligence as Installable App

**Decision**: PGP Architecture Intelligence is an installable application, not part of the Core.
**Rationale**: It is a specialized tool that consumes Core services. Following the implementation rule, it belongs at the application layer.
**Consequence**: It has its own entities, navigation, and documentation. It never modifies customer projects.

## ADR-012: Append-Only Audit

**Decision**: `AuditEvent` is append-only. Normal admins cannot update or delete.
**Rationale**: Audit trails must be tamper-resistant for compliance.
**Consequence**: Only `super_admin`/`core_developer` can mutate under documented break-glass.