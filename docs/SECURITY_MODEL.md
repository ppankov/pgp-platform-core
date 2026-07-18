# PGP Core — Security Model

## Core Principle

**Frontend visibility is not security.** Every protected action has explicit backend authorization. The frontend `PermissionGate` and navigation role-filtering are UX conveniences only — they never constitute a security boundary.

## Row Level Security (RLS)

### General Principles
1. **Tenant-owned entities** are scoped by `organization_id`. A user may only read/write rows for organizations where they hold an active membership.
2. **Platform-level entities** are governed by role, not org.
3. **Append-only**: `AuditEvent` — no updates or deletes except by `super_admin`/`core_developer` under documented break-glass.
4. **Secrets**: `SystemSetting` (sensitive) and `ServiceConfiguration` secrets are never returned via list/get APIs.
5. **No service-role in user-facing flows**: `base44.asServiceRole` reserved for documented platform operations only.
6. **No "fetch all then filter"**: queries include org/role filters at the query level.

### Per-Entity RLS Matrix

| Entity | Read | Create | Update | Delete |
|---|---|---|---|---|
| Organization | admin/super_admin; members read own | super_admin | admin/super_admin | super_admin |
| OrganizationMember | org admins + self | admin/super_admin | org admin | admin/super_admin |
| PlatformRole | all platform roles (read) | super_admin | super_admin | super_admin (non-system only) |
| Permission | admin/super_admin | super_admin | super_admin | super_admin |
| RolePermission | admin/super_admin | super_admin | super_admin | super_admin |
| ApplicationDefinition | all authenticated | super_admin | super_admin | super_admin |
| ApplicationInstallation | org members | admin/super_admin | org admin | org admin |
| PluginDefinition | developer+ | super_admin/core_developer | core_developer | core_developer |
| PluginInstallation | org members | org admin/developer | org admin/developer | org admin/developer |
| ConnectorDefinition | developer+ | super_admin/core_developer | core_developer | core_developer |
| ConnectorProvider | developer+ | super_admin/core_developer | core_developer | core_developer |
| ConnectorConnection | org admin/developer (token_ref hidden) | org admin/developer | org admin/developer | org admin/developer |
| ServiceConfiguration | org admin/developer | org admin/developer | org admin/developer | org admin/developer |
| FeatureFlag | org admin/developer (org); admin (platform) | admin/developer | admin/developer | admin |
| AuditEvent | auditor/admin/super_admin (scoped) | system + any actor | break-glass only | none |
| SystemSetting | admin+ (redacted if sensitive) | super_admin | super_admin/core_developer | super_admin |
| EventTopic | developer+ | core_developer/super_admin | core_developer/super_admin | super_admin |

## Secrets Handling

- No entity field stores raw secrets (API keys, OAuth tokens, passwords).
- `ServiceConfiguration.config` stores only non-sensitive parameters (region, endpoint, sender name).
- `SystemSetting.value` with `is_sensitive=true` is write-only from the frontend perspective — redacted on read unless caller is `super_admin`/`core_developer`.
- `ConnectorConnection.token_ref` is a reference, never the token.
- Actual secrets live in Base44 environment variables or the platform connector token store.
- No secret is ever imported into frontend code.

## Access Rules

- Guests must not access platform administration.
- Users may access only their own authorized organization context.
- Organization admins may manage only their organization.
- Platform admins may manage platform-level resources according to explicit permissions.
- Audit records must be append-only for normal administrators.
- Only authorized roles may view logs containing technical or sensitive information.
- Secrets must never be returned through normal list APIs.

## Developer Access Restriction

Developer roles (`developer`, `core_developer`) do NOT automatically receive access to:
- Private user messages
- Personal files
- Sensitive business data

That access requires explicit, separate permission grants.

## Phase 1 Status

RLS is **designed and documented** per entity (in entity schema descriptions and this document). Actual enforcement for user-facing mutation flows will be implemented in Phase 2+ via backend functions with explicit authorization. Phase 1 creates no mutation endpoints, so no unsafe surface exists.