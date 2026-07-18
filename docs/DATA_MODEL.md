# PGP Core — Data Model

## Overview

PGP Core's data model consists of 17 platform entities plus 15 application entities (for PGP Architecture Intelligence). All entities are created with full JSON schemas and documented RLS.

## Core Entities (17)

### Identity & Tenancy

#### Organization
Root tenant entity. Fields: `name`, `slug` (unique), `status` (active/suspended/archived), `plan_tier`, `owner_user_id`, `settings`. Not org-scoped.

#### OrganizationMember
User ↔ org membership. Fields: `organization_id`, `user_id`, `role`, `status`, `invited_by_id`, `joined_date`. Scoped by `organization_id`.

#### PlatformRole
System role definitions. Fields: `key` (unique), `name`, `description`, `scope`, `branch`, `is_system`. Platform-level.

#### Permission
Granular capability. Fields: `key` (unique), `description`, `category`, `scope`. Platform-level.

#### RolePermission
Role ↔ permission mapping. Fields: `role_id`, `permission_id`. Platform-level.

### Application Lifecycle

#### ApplicationDefinition
Catalog of installable apps. Fields: `key`, `name`, `description`, `version`, `latest_version`, `is_core`, `status`, `manifest`. Platform catalog.

#### ApplicationInstallation
Org-scoped app install. Fields: `organization_id`, `application_definition_id`, `installed_version`, `status`, `installed_by_id`, `config`. Scoped by `organization_id`.

### Extensibility

#### PluginDefinition
Plugin catalog. Fields: `key`, `name`, `version`, `entrypoint_type`, `status`, `manifest`. Platform catalog.

#### PluginInstallation
Org-scoped plugin install. Fields: `organization_id`, `plugin_definition_id`, `version`, `status`, `config`, `installed_by_id`. Scoped by `organization_id`.

#### ConnectorDefinition
Connector catalog (Layer 1). Fields: `key`, `name`, `version`, `supported_provider_types`, `auth_modes`, `manifest`. Platform catalog.

#### ConnectorProvider
Provider for a connector (Layer 2). Fields: `connector_definition_id`, `provider_key`, `display_name`, `auth_mode`, `capabilities`, `is_available`. Platform catalog.

#### ConnectorConnection
Org-scoped connection (Layer 3). Fields: `organization_id`, `connector_provider_id`, `auth_mode`, `status`, `display_name`, `connected_by_id`, `connection_metadata`, `token_ref`. Scoped by `organization_id`. Secrets never stored.

### Operations & Configuration

#### ServiceConfiguration
Abstracted service config. Fields: `organization_id`, `service_type` (ai/storage/communications/search), `provider`, `config`, `status`, `is_default`. Scoped by `organization_id`. Secrets never in config.

#### FeatureFlag
Org or platform flags. Fields: `key`, `organization_id` (nullable), `enabled`, `rollout_percentage`, `description`. Scoped by `organization_id` or platform.

#### AuditEvent
Append-only audit trail. Fields: `organization_id` (nullable), `actor_user_id`, `action`, `resource_type`, `resource_id`, `metadata`, `severity`, `ip_address`, `event_topic`. Scoped by `organization_id` + role-gated. Append-only.

#### SystemSetting
Platform key/value config. Fields: `key`, `value`, `category`, `is_sensitive`, `updated_by_id`. Platform-level. Sensitive values redacted on read.

#### EventTopic
Event Bus topic catalog. Fields: `key`, `description`, `payload_schema`, `is_system`, `status`. Platform-level. Architecture reservation only.

## Relationships

```
Organization ─┬─ OrganizationMember ─── User
              ├─ ApplicationInstallation ── ApplicationDefinition
              ├─ PluginInstallation ────── PluginDefinition
              ├─ ConnectorConnection ───── ConnectorProvider ── ConnectorDefinition
              ├─ ServiceConfiguration
              ├─ FeatureFlag (org-scoped)
              └─ AuditEvent (org-scoped)

PlatformRole ─── RolePermission ─── Permission
SystemSetting (platform-level)
EventTopic (platform-level)
FeatureFlag (platform-level when org_id is null)
```

## Built-in Fields (not declared in schemas)

Every entity has: `id`, `created_date`, `updated_date`, `created_by_id`.

## Phase 1 Status

All entity schemas are created with full JSON schemas and RLS documented in their `description` fields. No data is seeded. No mutation endpoints exist. RLS enforcement is Phase 2+.