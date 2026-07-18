# PGP Core — Plugin Engine Specification (Phase 5)

**Status:** Phase 5 — Plugin Catalog and Installation Runtime (foundation only).

This document specifies the Plugin Engine exactly as implemented in Phase 5. Phase 5 creates catalog and installation infrastructure only. It does **not** execute plugin code, dynamically load extensions, register subscriber handlers, or modify the Core at runtime.

---

## 1. Overview

A plugin is an extension of PGP Core. It is not an application, a connector, or a business module. The Plugin Engine provides:

- a **plugin catalog** (global definitions)
- **versioned plugin manifests** (declarative, immutable after release)
- **organization-scoped installations**
- **enable / disable / uninstall** operations
- **declarative capabilities and configuration**
- compatibility with the Lifecycle Engine and the Platform Event Bus

The engine separates three concerns:

1. **Plugin identity** — `PluginDefinition` (global, organization-independent)
2. **Plugin version** — `PluginVersion` (immutable after release, declarative manifest)
3. **Plugin installation** — `PluginInstallation` (organization-scoped)

---

## 2. Entities

### PluginDefinition
Global plugin identity. Organization-independent. Contains no executable code.

| Field | Description |
|---|---|
| `key` | Stable, unique machine identifier. Immutable after creation. |
| `name` | Display name |
| `description` | Prose description (non-sensitive) |
| `vendor` | Author / owner |
| `category` | Logical grouping |
| `active` | Whether the definition can be installed |
| `currentVersionId` | Reference to the current released `PluginVersion` |

Built-in `created_date` serves as `createdAt`. RLS: read by developer/solution_architect/core_developer/admin/super_admin; create/update/delete by core_developer/super_admin.

### PluginVersion
A versioned, declarative manifest for a definition. Created as `draft`; `released` versions are immutable.

| Field | Description |
|---|---|
| `pluginId` | Reference to `PluginDefinition` |
| `version` | Semantic version string |
| `coreCompatibility` | Core compatibility expression e.g. `>=1.0.0 <2.0.0` |
| `manifest` | Declarative manifest object (validated, never executed) |
| `releaseStatus` | `draft` \| `released` \| `deprecated` |
| `checksum` | Metadata-only integrity checksum |
| `releasedAt` | Release timestamp (null while draft) |

Unique by `(pluginId, version)`. RLS: read by developer+; create by core_developer/super_admin; releaseStatus transition via `releasePluginVersion`.

### PluginInstallation
An organization-scoped installation of a released version.

| Field | Description |
|---|---|
| `pluginId` | Reference to `PluginDefinition` |
| `pluginVersionId` | Reference to the released `PluginVersion` |
| `organizationId` | Owning organization (tenant boundary) |
| `configuration` | Non-sensitive configuration data |
| `enabled` | Whether the installation is enabled |
| `installedById` | User who installed |
| `installedAt` / `disabledAt` / `uninstalledAt` | History timestamps |

`uninstalledAt == null` means the installation is active. Uninstall is non-destructive (record preserved). RLS: read by org members + developer/solution_architect/core_developer/admin/super_admin; create/update by admin/super_admin.

---

## 3. Definition / Version / Installation Separation

- A **definition** is global and describes what a plugin is. It carries no version and no executable code.
- A **version** belongs to exactly one definition and carries a declarative manifest. Multiple versions can exist per definition; exactly one is `currentVersionId` at a time (the latest released).
- An **installation** belongs to exactly one organization and references one released version. It carries organization-specific configuration and enable/disable/uninstall state.

This three-layer separation means: a single definition can have many versions; a single version can be installed into many organizations; each installation is independent.

---

## 4. Manifest Contract

A manifest MAY declare:

- `pluginKey`, `version`, `displayName`, `description`
- `capabilities` (array of strings)
- `requiredPermissions` (array of permission keys)
- `providedEvents` (array of event type strings)
- `subscribedEvents` (array of event type strings)
- `configurationSchema` (object)
- `dependencies` (array)
- `minimumCoreVersion`, `maximumCoreVersion`

A manifest MUST NEVER contain: executable JavaScript, `eval`/`Function`/`import()`/`require()` expressions, `<script>` tags, `javascript:` URIs, `process.env` references, `__proto__` payloads, arbitrary function-name keys, credentials, secrets, access tokens, or embedded binaries.

The Plugin Engine **stores and validates** manifest structure but **never executes** it. Validation:
- The manifest must be a plain JSON object (no functions, no non-JSON values).
- Only the allow-listed keys above are permitted; unknown keys are rejected.
- A recursive scan rejects any string value matching executable patterns (`eval(`, `new Function`, `Function(`, `import(`, `<script`, `javascript:`, `require(`, `process.env`, `__proto__`).

Release-time completeness requires: `manifest.pluginKey` matches the definition key, `manifest.version` matches the version string, `manifest.displayName` is non-empty, and either `coreCompatibility` or `manifest.minimumCoreVersion` is present, and `checksum` is present.

---

## 5. Immutable Released Versions

- Versions are created as `draft`.
- `releasePluginVersion` transitions `draft → released` after completeness/compatibility validation.
- A released version cannot be re-released (409) and cannot be edited — there is no update endpoint for `PluginVersion`. Immutability is structural.
- `deprecated` is a reserved status; the deprecation path is deferred (no deprecate endpoint in Phase 5).
- Releasing a version sets `definition.currentVersionId` to that version.

---

## 6. Organization Scoping

- An installation is scoped to one `organizationId` (tenant boundary).
- At most one **active** (`uninstalledAt == null`) installation exists per `(pluginId, organizationId)`.
- Installations are scoped by the `organizationId` parameter in the read functions (`listPlugins`, `getPluginInstallation`); a request returns only the installations of the requested organization. Functions operate under the service role (consistent with all platform functions), so the role check at each function entry is the access gate; platform administrators may read across organizations by design. Direct entity SDK access from the frontend (e.g. dashboard widgets) is additionally RLS-scoped per the entity schemas.
- `listPlugins({ organizationId })` returns only that org's installations.

---

## 7. Installation Idempotency

`installPlugin` is idempotent for the same `(pluginId, organizationId, pluginVersionId)`:
- If an active installation already exists with the **same** version → returns `already_installed` (no new record, no error).
- If an active installation exists with a **different** version → 409 (uninstall first to change version; history is preserved).
- If only uninstalled (historical) installations exist, a **new** installation record is created (history preserved).

---

## 8. Enable / Disable / Uninstall Behavior

- **enablePlugin:** rejects uninstalled installations (`400`); idempotent when already enabled (`already_enabled`); clears `disabledAt`.
- **disablePlugin:** idempotent when already disabled or uninstalled (`already_disabled`); sets `enabled=false` and `disabledAt`; preserves configuration and history.
- **uninstallPlugin:** sets `uninstalledAt`; disables first if the installation was enabled; non-destructive (record preserved); repeated uninstall is idempotent (`already_uninstalled`).

State derivation:
- `uninstalledAt != null` → **uninstalled**
- else `enabled == true` → **enabled**
- else → **disabled**

---

## 9. Event Bus Integration

Plugin operations publish open-string event types via the existing `publishEvent` service (the engine never creates `PlatformEvent` records directly):

| Operation | Event type | sourceType | sourceId |
|---|---|---|---|
| registerPluginDefinition | `plugin.definition_registered` | `plugin` | definition id |
| registerPluginVersion | `plugin.version_registered` | `plugin` | version id |
| releasePluginVersion | `plugin.version_released` | `plugin` | version id |
| installPlugin | `plugin.installed` | `plugin` | installation id |
| enablePlugin | `plugin.enabled` | `plugin` | installation id |
| disablePlugin | `plugin.disabled` | `plugin` | installation id |
| uninstallPlugin | `plugin.uninstalled` | `plugin` | installation id |

Payloads contain **identifiers and safe metadata only** (pluginId, pluginVersionId, organizationId, version, releaseStatus, enabled). Payloads **never** include secrets, credentials, full configuration values, access tokens, or the full manifest.

Publication is **best-effort**: a publish failure (or absence of subscribers) never rolls back a successful plugin operation. Publishing and delivery remain separate — the engine only publishes; it does not dispatch.

---

## 10. Lifecycle Compatibility

The Plugin Engine does **not** create a second lifecycle engine and does not hardcode plugin-specific lifecycle logic. `PluginDefinition`, `PluginVersion`, and `PluginInstallation` are usable through the existing lifecycle resource contract `(resourceType, resourceId)` via the reserved resource type values:

- `plugin_definition`
- `plugin_version`
- `plugin_installation`

No lifecycle definitions are automatically created. Lifecycle attachment may be added separately after real lifecycle definitions are configured (deferred).

---

## 11. Permission Model

| Capability | Roles |
|---|---|
| `platform.plugins.read` | developer, solution_architect, core_developer, admin, super_admin |
| `platform.plugins.manage` (definitions + versions) | core_developer, super_admin |
| `platform.plugins.release` | core_developer, super_admin |
| `platform.plugins.install` (install/enable/disable/uninstall) | admin, super_admin |

Backend functions enforce these; the frontend capability map mirrors them for visibility only.

---

## 12. Security Restrictions

- No arbitrary code execution. No dynamic imports. No npm package installation. No fetching plugin code from remote URLs. No invoking manifest-provided functions.
- The manifest is declarative data only; the engine stores and validates it but never executes it.
- Configuration is data only; secrets are never accepted or stored by the engine (callers must not include them; the engine does not place configuration in event payloads).
- Organization installations are not exposed across tenant boundaries.
- Access control is enforced by the function-level role check at the entry of each function (see §11). Functions operate under the service role, consistent with all platform functions; organization scoping for reads is by the `organizationId` parameter. Direct entity SDK access from the frontend (e.g. dashboard widgets) is RLS-scoped per the entity schemas.

---

## 13. Known Limitations

1. No store-level uniqueness constraint on `(pluginId, version)` or `(pluginId, organizationId)` for active installations — uniqueness is enforced in function logic via pre-checks. Concurrent calls may race.
2. No deprecation endpoint (the `deprecated` status is reserved but not reachable in Phase 5).
3. No version upgrade path — changing an installed version requires uninstall then re-install (history preserved).
4. No handler registration surface — the Phase 4 Event Bus subscriber handler registry remains empty; plugin `subscribedEvents` are declarative only and not wired.
5. No automatic enablement — installations are created `enabled=false`.
6. Event publication is best-effort and not transactional with the operation.
7. RLS rules rely on the platform data layer; per-field RLS refinement is deferred.

---

## 14. Deferred

- **Runtime execution** of plugin manifests (UI extensions, backend hooks) — not in Phase 5.
- **Dependencies** resolution and enforcement (manifest `dependencies`) — declarative only, not enforced.
- **Marketplace** / discovery / rating UI — explicitly out of scope.
- **Package distribution** — no package download, checksum verification, or artifact storage; `checksum` is metadata only.
- **Deprecation** workflow.
- **Version upgrade** in place.
- **Lifecycle attachment** for plugin resources (reserved resource types only).
- **Subscriber handler registration** and event-driven plugin automation.

---

## 15. Cross-Phase Integrity

- The Lifecycle Engine (Phase 2) and Lifecycle Execution Runtime were not modified.
- The Platform Event Bus (Phase 3) and Event Delivery Runtime (Phase 4) were not modified; the Plugin Engine consumes `publishEvent` as a client and adds no transport, no subscribers, and no delivery logic.
- The two existing Phase 1 plugin entities (`PluginDefinition`, `PluginInstallation`) were **normalized** to the Phase 5 model; `PluginVersion` is new. No duplicate entities were created.
- Publishing and delivery remain separate. A plugin operation publishes an event; it never depends on subscriber delivery.

**END OF PHASE 5 PLUGIN ENGINE SPEC.**