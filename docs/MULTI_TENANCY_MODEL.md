# PGP Core — Multi-Tenancy Model

## Overview

PGP Core is designed around **organizations** as the primary tenant boundary. Every tenant-owned entity includes `organization_id` as its ownership field.

## Tenant Boundary

An organization is the root tenant. Users interact with the platform through their organization membership. A user may belong to multiple organizations (via `OrganizationMember`), but operates in one active organization context at a time (selected via the Org Switcher).

## Entity Scoping

### Org-Scoped Entities (tenant-owned)
These entities carry `organization_id` and are isolated per tenant:
- `OrganizationMember`
- `ApplicationInstallation`
- `PluginInstallation`
- `ConnectorConnection`
- `ServiceConfiguration`
- `FeatureFlag` (when `organization_id` is not null)
- `AuditEvent` (when `organization_id` is not null)

### Platform-Level Entities (not org-scoped)
These entities are governed by role, not organization:
- `Organization`
- `PlatformRole`
- `Permission`
- `RolePermission`
- `ApplicationDefinition`
- `PluginDefinition`
- `ConnectorDefinition`
- `ConnectorProvider`
- `SystemSetting`
- `EventTopic`
- `FeatureFlag` (when `organization_id` is null — platform flags)
- `AuditEvent` (when `organization_id` is null — platform events)

## Access Rules

- A user may only read/write rows for organizations where they hold an **active** membership (`OrganizationMember.status = 'active'`).
- Platform-level entities are accessible based on the user's platform role, not their org membership.
- Cross-org queries are forbidden for org-scoped entities — a user in Org A cannot read Org B's installations, connections, or configurations.
- `support` role users see read-only org context for the org they're assisting — no secrets, no destructive actions.

## Org Switcher

The topbar includes an Org Switcher that sets the active organization context. In Phase 1, this is a static placeholder. In Phase 2, it will:
1. Query `OrganizationMember` for the current user's active memberships.
2. Let the user select an active org.
3. Scope all subsequent entity queries to the selected `organization_id`.

## No "Fetch All Then Filter"

Queries always include the `organization_id` filter at the query level. No endpoint fetches all records and filters afterward — this prevents data leakage and ensures performance.

## Future: Sub-Organizations & Teams

The model reserves space for future sub-organization or team scoping, but this is not implemented in Phase 1.