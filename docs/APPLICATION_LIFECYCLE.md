# PGP Core — Application Lifecycle

## Overview

Applications are installable units running on top of PGP Core. They are managed through a full lifecycle: marketplace discovery, installation, enable/disable, updates, dependency management, and removal.

## Lifecycle States

```
Available (in marketplace)
    ↓ [install]
Installed
    ↓ [enable]
Enabled
    ↓ [disable]
Disabled
    ↓ [enable]
Enabled
    ↓ [update available]
Update Available
    ↓ [update]
Enabled (new version)
    ↓ [remove]
Removed
```

## Application Definition (Catalog)

Stored as `ApplicationDefinition`:
- `key` — unique identifier
- `name`, `description`
- `version`, `latest_version`
- `is_core` — whether bundled with Core
- `status` — `available`, `deprecated`, `internal`
- `manifest` — module dependency metadata

## Application Installation (Org-Scoped)

Stored as `ApplicationInstallation`:
- `organization_id` — owning org
- `application_definition_id` — reference to catalog
- `installed_version`
- `status` — `installed`, `enabled`, `disabled`, `update_available`, `error`
- `config` — non-sensitive installation config
- `installed_by_id`

## Marketplace

The marketplace lists all `ApplicationDefinition` entries with `status = 'available'`. Organizations browse, compare, and install applications. Dependencies are shown before installation.

## Dependency Management

Before installation, the backend (Phase 2+) validates:
- `manifest.dependencies` — required applications must be installed
- `manifest.required_connectors` — required connector connections must exist
- `manifest.required_services` — required service configurations must be active
- `manifest.required_permissions` — the installing org must have the required permissions
- `manifest.min_platform_version` — the Core version must be sufficient

If validation fails, installation is blocked with a clear explanation.

## Enable / Disable

- An installed application can be enabled or disabled without removal.
- Disabling hides the app's navigation and suspends its functionality.
- Enabling re-activates the app within the org.

## Version Management

- `installed_version` tracks what's currently installed.
- `latest_version` on the definition tracks what's available.
- When `latest_version > installed_version`, the installation status becomes `update_available`.
- Updates are applied by the org admin, with dependency re-validation.

## Independence

Applications are installable and removable independently. Removing one application does not affect others, unless a dependency relationship exists (documented in manifests).

## Event Bus Integration

Lifecycle events emit topics (Phase 2+):
- `application.installed`
- `application.enabled`
- `application.disabled`
- `application.updated`

## Phase 1 Status

- Entity schemas created.
- Navigation placeholders exist (Marketplace, Installed, Updates).
- No installation engine, no dependency validation, no marketplace backend.
- All deferred to Phase 2.