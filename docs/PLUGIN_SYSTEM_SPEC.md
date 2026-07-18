# PGP Core — Plugin System Specification

## Overview

Plugins are installable, isolated units that extend platform capabilities without modifying the Core. They follow the platform implementation rule: if a feature cannot be solved by configuration, a plugin is the next option.

## Plugin Lifecycle

1. **Definition** — A `PluginDefinition` is registered in the platform catalog (by `core_developer`/`super_admin`).
2. **Installation** — An organization installs the plugin via `PluginInstallation` (by org admin/developer).
3. **Configuration** — The org configures the plugin via its `config` object (non-sensitive parameters only).
4. **Enable/Disable** — The org can enable or disable the plugin (`status: enabled | disabled | error`).
5. **Update** — When a new version is available, the org updates the installation.
6. **Removal** — The org removes the installation.

## Plugin Definition Entity

| Field | Description |
|---|---|
| `key` | Unique plugin identifier |
| `name` | Display name |
| `version` | Current version |
| `entrypoint_type` | `ui_extension`, `backend_hook`, `workflow`, `integration` |
| `status` | `available`, `deprecated`, `internal` |
| `manifest` | Module dependency metadata (see MODULE_DEPENDENCY_MODEL.md) |

## Plugin Installation Entity

| Field | Description |
|---|---|
| `organization_id` | Owning org (tenant boundary) |
| `plugin_definition_id` | Reference to definition |
| `version` | Installed version |
| `status` | `enabled`, `disabled`, `error` |
| `config` | Non-sensitive configuration |
| `installed_by_id` | User who installed |

## Isolation Rules

- Plugins run within their declared `entrypoint_type` — no arbitrary code execution.
- Plugins cannot directly access another plugin's private data.
- Plugins declare required connectors, services, and permissions in their `manifest`.
- The backend (Phase 2+) validates manifest dependencies before allowing enable.
- Plugins never receive secrets directly — they reference connector connections.

## Security

- Plugin installation requires `platform.plugins.manage` permission.
- Plugin config never stores secrets — only non-sensitive parameters.
- Plugin execution is sandboxed to its entrypoint type.
- Audit events are emitted on install, enable, disable, update, and removal (via Event Bus topics `plugin.enabled`, `plugin.disabled`).

## Phase 1 Status

- Entity schemas created.
- Navigation placeholder exists.
- No runtime, no execution engine, no builder UI.
- All deferred to Phase 3.