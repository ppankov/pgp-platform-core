# PGP Core — Phase 5 Architecture Snapshot

**STATUS: FROZEN — Platform Reference Implementation**

**Snapshot date:** 2026-07-17 (UTC)

---

## 1. Scope and Frozen Status

Phase 5 delivers the **Plugin Catalog and Installation Runtime** — a non-executable, declarative-only foundation for installable PGP Core extensions. This snapshot documents the implementation exactly as built and is frozen as the platform reference for Phase 5.

Phase 5 creates catalog and installation infrastructure **only**. It does **not** execute plugin code, dynamically load extensions, register subscriber handlers, resolve dependencies, distribute packages, or modify the Core at runtime.

From this point forward, the Phase 5 contracts (entity schemas, function signatures, permission boundaries, Event Bus integration, and immutability rules) are frozen. Subsequent phases may extend on top of Phase 5 but must not alter these contracts.

---

## 2. Reused and Normalized Existing Structures

- The two existing Phase 1 plugin entities (`PluginDefinition`, `PluginInstallation`) were **normalized** to the Phase 5 three-layer model. `PluginDefinition` was reshaped to a global, organization-independent identity carrying `currentVersionId`; `PluginInstallation` was reshaped to reference a released `PluginVersion` and track full install/disable/uninstall history. No duplicate entities were created.
- `PluginVersion` is new in Phase 5.
- The Plugin Engine reuses the existing `publishEvent` service (Phase 3) as a client. It adds no transport, no subscribers, and no delivery logic.
- The Plugin Engine reuses the existing Lifecycle Engine resource contract `(resourceType, resourceId)` via reserved resource-type values; no plugin-specific lifecycle logic was added to the Lifecycle Engine.
- The dashboard, navigation, routing, entity registry, and i18n scaffolding from earlier phases were extended (not replaced) to expose the Plugin Engine.

---

## 3. Entity List

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

`uninstalledAt == null` means the installation is active. Uninstall is non-destructive (record preserved). RLS: read by org members + developer/solution_architect/core_developer/admin/super_admin; create/update by admin/super_admin via the install/enable/disable/uninstall functions.

---

## 4. Definition / Version / Installation Separation

1. **Plugin identity** — `PluginDefinition` (global, organization-independent) describes what a plugin is. It carries no version and no executable code.
2. **Plugin version** — `PluginVersion` belongs to exactly one definition and carries a declarative manifest. Multiple versions can exist per definition; `currentVersionId` points to the latest released version.
3. **Plugin installation** — `PluginInstallation` belongs to exactly one organization and references one released version. It carries organization-specific configuration and enable/disable/uninstall state.

A single definition can have many versions; a single version can be installed into many organizations; each installation is independent. This three-layer separation is the core structural invariant of the Plugin Engine.

---

## 5. Backend Function List

All functions are Deno deploy handlers under `base44/functions/{name}/entry.ts` and operate under the **service role**.

| Function | Purpose | Authorized roles |
|---|---|---|
| `registerPluginDefinition` | Create a global plugin definition | core_developer, super_admin |
| `registerPluginVersion` | Create a draft version with a validated manifest | core_developer, super_admin |
| `releasePluginVersion` | Transition `draft → released` after completeness/compatibility validation | core_developer, super_admin |
| `installPlugin` | Install a released version into an organization (idempotent) | admin, super_admin |
| `enablePlugin` | Enable a disabled installation (idempotent) | admin, super_admin |
| `disablePlugin` | Disable an enabled installation (idempotent) | admin, super_admin |
| `uninstallPlugin` | Non-destructive uninstall (idempotent) | admin, super_admin |
| `getPluginInstallation` | Resolve an installation by id or by (pluginId, organizationId) | developer, solution_architect, core_developer, admin, super_admin |
| `listPlugins` | List definitions/versions and optionally an organization's installations | developer, solution_architect, core_developer, admin, super_admin |

---

## 6. Plugin Manifest Contract

A manifest MAY declare: `pluginKey`, `version`, `displayName`, `description`, `capabilities` (array), `requiredPermissions` (array), `providedEvents` (array), `subscribedEvents` (array), `configurationSchema` (object), `dependencies` (array), `minimumCoreVersion`, `maximumCoreVersion`.

Validation at registration:
- The manifest must be a plain JSON object (no functions, no non-JSON values).
- Only the allow-listed keys above are permitted; unknown keys are rejected.
- A recursive scan rejects any string value matching executable patterns (`eval(`, `new Function`, `Function(`, `import(`, `<script`, `javascript:`, `require(`, `process.env`, `__proto__`).

Release-time completeness requires: `manifest.pluginKey` matches the definition key, `manifest.version` matches the version string, `manifest.displayName` is non-empty, either `coreCompatibility` or `manifest.minimumCoreVersion` is present, and `checksum` is present.

---

## 7. Manifest Security Restrictions

- No arbitrary code execution. No dynamic imports. No npm package installation. No fetching plugin code from remote URLs. No invoking manifest-provided functions.
- The manifest is declarative data only; the engine stores and validates it but never executes it.
- Configuration is data only; secrets are never accepted or stored by the engine, and are never placed in event payloads.
- The manifest allow-list and executable-pattern scan are enforced at registration; release re-confirms plain-JSON safety and completeness.

---

## 8. Released-Version Immutability

- Versions are created as `draft`.
- `releasePluginVersion` transitions `draft → released` and sets `releasedAt` and `definition.currentVersionId`.
- A released version cannot be re-released (`409`) and cannot be edited — there is no update endpoint for `PluginVersion`. Immutability is structural.
- `deprecated` is a reserved status; the deprecation path is deferred (no deprecate endpoint in Phase 5).

---

## 9. Organization-Scoped Installation Model

- An installation is scoped to one `organizationId` (tenant boundary).
- At most one **active** (`uninstalledAt == null`) installation exists per `(pluginId, organizationId)` — enforced by function logic.
- `listPlugins({ organizationId })` returns only that organization's installations.
- `getPluginInstallation` resolves by `installationId`, or by `(pluginId, organizationId)`.
- Installations are scoped by the `organizationId` parameter in the read functions; functions operate under the service role (consistent with all platform functions), so the role check at each function entry is the access gate, and platform administrators may read across organizations by design.

---

## 10. Installation Idempotency

`installPlugin` is idempotent for the same `(pluginId, organizationId, pluginVersionId)`:
- Active installation with the **same** version → `already_installed` (no new record, no error).
- Active installation with a **different** version → `409` (uninstall first; history preserved).
- Only uninstalled (historical) installations exist → a **new** installation record is created (history preserved).

---

## 11. Enable / Disable / Uninstall Behavior

- **enablePlugin:** rejects uninstalled installations (`400`); idempotent when already enabled (`already_enabled`); clears `disabledAt`.
- **disablePlugin:** idempotent when already disabled or uninstalled (`already_disabled`); sets `enabled=false` and `disabledAt`.
- **uninstallPlugin:** sets `uninstalledAt`; disables first if the installation was enabled; non-destructive; repeated uninstall is idempotent (`already_uninstalled`).

State derivation: `uninstalledAt != null` → uninstalled; else `enabled == true` → enabled; else → disabled.

---

## 12. Non-Destructive Uninstall and History Preservation

Uninstall sets `uninstalledAt` (and `disabledAt` if it was enabled) but **never deletes** the installation record. The full install/disable/uninstall history is preserved. A subsequent install into the same organization creates a **new** active installation record rather than mutating the historical one.

---

## 13. Event Bus Integration

Plugin operations publish open-string event types via the existing `publishEvent` service. The engine never creates `PlatformEvent` records directly.

| Operation | Event type | sourceType | sourceId |
|---|---|---|---|
| registerPluginDefinition | `plugin.definition_registered` | `plugin` | definition id |
| registerPluginVersion | `plugin.version_registered` | `plugin` | version id |
| releasePluginVersion | `plugin.version_released` | `plugin` | version id |
| installPlugin | `plugin.installed` | `plugin` | installation id |
| enablePlugin | `plugin.enabled` | `plugin` | installation id |
| disablePlugin | `plugin.disabled` | `plugin` | installation id |
| uninstallPlugin | `plugin.uninstalled` | `plugin` | installation id |

- **sourceType/sourceId rules:** `sourceType` is always `plugin`; `sourceId` is the id of the relevant definition, version, or installation.
- **Safe identifier-only payloads:** payloads contain identifiers and safe metadata only (pluginId, pluginVersionId, organizationId, version, releaseStatus, enabled). Payloads never include `configuration`, the full `manifest`, credentials, secrets, access tokens, or binaries.
- **Best-effort publication:** a publish failure (or absence of subscribers) never rolls back a successful plugin operation. Publication is wrapped so exceptions never propagate to the caller.
- **Subscriber independence:** publication succeeds with zero subscribers; the Plugin Engine has no knowledge of subscribers and does not dispatch.

---

## 14. Lifecycle Compatibility

The Plugin Engine does not create a second lifecycle engine and adds no plugin-specific lifecycle logic. `PluginDefinition`, `PluginVersion`, and `PluginInstallation` are usable through the existing Lifecycle Engine resource contract `(resourceType, resourceId)` via the reserved resource-type values:

- `plugin_definition`
- `plugin_version`
- `plugin_installation`

`resourceType` and `resourceId` are opaque to the Lifecycle Engine — it makes no assumption about how or where the resource is stored. No lifecycle definitions are automatically created; lifecycle attachment may be added separately after real lifecycle definitions are configured (deferred).

---

## 15. Permission Model

| Capability | Roles |
|---|---|
| `platform.plugins.read` | developer, solution_architect, core_developer, admin, super_admin |
| `platform.plugins.manage` (definitions + versions) | core_developer, super_admin |
| `platform.plugins.release` | core_developer, super_admin |
| `platform.plugins.install` (install/enable/disable/uninstall) | admin, super_admin |

**Role boundaries (explicit):**
- **Developer** — read catalog, read visible installations and manifests.
- **Solution Architect** — read catalog, read manifests and compatibility metadata.
- **Core Developer** — manage definitions, manage versions, release versions, read.
- **Admin** — install, enable, disable, uninstall; read catalog and versions.
- **Super Admin** — full (all capabilities).

**Explicit statements:**
- Admin may manage plugin installations.
- Admin may not register plugin definitions or versions.
- Admin may not release versions.
- Core Developer and Super Admin manage definitions and versions.
- Backend functions run under the service role.
- Function-level role and organization checks enforce function access.
- Direct frontend entity access remains subject to backend RLS.

---

## 16. Management UI and Dashboard Integration

- **Plugin Catalog page** (`/plugins`) — lists definitions; "Register Definition" action gated by `platform.plugins.manage`; links to detail pages.
- **Plugin Detail page** (`/plugins/:pluginId`) — definition overview, version list with release status; "Register Version" gated by `platform.plugins.manage`; "Release" per draft version gated by `platform.plugins.release`; install panel gated by `platform.plugins.install`.
- **Installed Plugins page** (`/plugins/installed`) — organization selector + installations table with derived status.
- **Plugin Installation Detail page** (`/plugins/installed/:installationId`) — installation metadata; Enable/Disable/Uninstall actions gated by `platform.plugins.install`; uninstall is confirmed via a dialog.
- **Dashboard widget** (`PluginEngineWidget`) — four counters: definitions, released versions, installed (active), enabled; counters use the user-context SDK (RLS-scoped) consistent with the existing dashboard widgets.

---

## 17. Entity Registry, Navigation, Routing and i18n Integration

- **Entity registry** (`src/lib/entity-registry.js`) — `PluginDefinition`, `PluginVersion`, `PluginInstallation` are listed in `CORE_ENTITIES`; `PLUGIN_ENGINE_ENTITIES` groups them for the Plugin Engine module.
- **Navigation** (`src/lib/navigation.js`) — `plugins` (`/plugins`) and `plugin_installed` (`/plugins/installed`) items in the `extensibility` group, visible to `PLUGIN_ROLES` (super_admin, admin, core_developer, developer, solution_architect).
- **Routing** (`src/App.jsx`) — `/plugins`, `/plugins/installed`, `/plugins/installed/:installationId`, `/plugins/:pluginId` are wired as real routes (ordered so `installed` is not captured as `pluginId`); the generic placeholder fallback excludes the `plugin` prefix.
- **i18n** — `plugin.*` translation keys (catalog, installed, detail, versions, statuses, actions, fields, widget labels, confirm prompts) are present in EN, BG, DE, ES. Bulgarian uses the consistent terminology: Plugin → Разширение, Plugin Engine → Система за разширения, and "автобус" is not used (Platform Event Bus → Платформена шина за събития).

---

## 18. Verified Guard Paths

### Phase 5 implementation tests (prior round, with temporary role widening — reverted after)
- Duplicate plugin key → `409`
- Malformed manifest (non-object / non-JSON) → `400`
- Executable-looking manifest (`eval(`, `<script`, etc.) → `400`
- Mutation of a released version (re-release) → `409`

### Phase 5 stabilization tests (14 paths, this round)
| # | Path | Expected | Result |
|---|---|---|---|
| 1 | registerPluginDefinition (admin) | 403 | 403 ✓ |
| 2 | registerPluginVersion (admin) | 403 | 403 ✓ |
| 3 | releasePluginVersion (admin) | 403 | 403 ✓ |
| 4 | installPlugin missing fields | 400 | 400 ✓ |
| 5 | install inactive definition | 400 | 400 ✓ |
| 6 | install draft version | 400 | 400 ✓ |
| 7 | duplicate install (same org + version) | 200 already_installed | 200 ✓ |
| 8 | install (admin allowed) | 200 installed | 200 ✓ |
| 9 | org isolation (unknown org) | 404 | 404 ✓ |
| 10 | repeated enable | 200 already_enabled | 200 ✓ |
| 11 | repeated disable | 200 already_disabled | 200 ✓ |
| 12 | repeated uninstall | 200 already_uninstalled | 200 ✓ |
| 13 | enable after uninstall | 400 | 400 ✓ |
| 14 | listPlugins installed view | 200 | 200 ✓ |

### Permission-boundary verification
- Admin is denied definition/version management and release (`403` on `registerPluginDefinition`, `registerPluginVersion`, `releasePluginVersion`).
- Admin is allowed installation management (`200` on install/enable/disable/uninstall and `listPlugins`).
- Temporary test-role widening was fully reverted and confirmed (admin → 403 on all three management functions; no re-widening in the stabilization round).

### Event Bus payload verification
- The `plugin.installed` event published this round contained only identifier/safe-metadata keys; `payloadSafe: true` (no `configuration`, `manifest`, secrets, tokens, or credentials).
- Publication succeeded with zero subscribers (`subscriberIndependent: true`).

---

## 19. Test Cleanup Confirmation

All stabilization test data was removed after verification. Final state: `leftoverInst = 0`, `leftoverVer = 0`, `leftoverEv = 0`, `leftoverDef = 0`, `cleanedUp: true`. No test artifacts remain in `PluginDefinition`, `PluginVersion`, `PluginInstallation`, or the published `plugin.*` events.

---

## 20. Architectural Invariants

1. The Plugin Engine stores **declarative plugin metadata only**.
2. It **never executes, imports, or downloads** plugin code.
3. Plugin definitions are **global** (organization-independent).
4. Plugin versions are **immutable after release** (no update endpoint; structural immutability).
5. Plugin installations are **organization-scoped** (one active installation per plugin + organization).
6. **Uninstall preserves installation history** (non-destructive; record never deleted).
7. **Event publication cannot roll back** a successful plugin operation (best-effort, wrapped).
8. **Events contain no configuration, manifest, credentials, secrets, or tokens** (identifier-only payloads).
9. The Plugin Engine is a **client** of the Event Bus and Lifecycle Engine; it adds no transport, no subscribers, no delivery, and no lifecycle logic.
10. Access control is enforced by the **function-level role check**; organization scoping for reads is by the `organizationId` parameter; direct frontend SDK access is RLS-scoped.

---

## 21. Known Limitations

1. No store-level uniqueness constraint on `(pluginId, version)` or `(pluginId, organizationId)` for active installations — uniqueness is enforced in function logic via pre-checks; concurrent calls may race.
2. No deprecation endpoint (the `deprecated` status is reserved but not reachable in Phase 5).
3. No version upgrade path — changing an installed version requires uninstall then re-install (history preserved).
4. No handler registration surface — the Phase 4 Event Bus subscriber handler registry remains empty; plugin `subscribedEvents` are declarative only and not wired.
5. No automatic enablement — installations are created `enabled=false`.
6. Event publication is best-effort and not transactional with the operation.
7. RLS rules rely on the platform data layer; per-field RLS refinement is deferred.
8. Manifest validation helpers are duplicated across the standalone Deno functions (platform deployment constraint; not refactored to avoid cross-function import risk).

---

## 22. Deferred Functionality

- **Executable plugin runtime** (UI extensions, backend hooks) — not in Phase 5.
- **Dynamic loading** of plugin code — explicitly excluded.
- **Handler registration** for plugin-subscribed events — declarative only, not wired.
- **Dependency resolution** and enforcement (manifest `dependencies`) — declarative only.
- **Package distribution** — no package download, checksum verification, or artifact storage; `checksum` is metadata only.
- **Marketplace** / discovery / rating UI — out of scope.
- **Billing** for plugins — out of scope; no billing functionality exists.
- **Automatic lifecycle attachment** for plugin resources (reserved resource types only).
- **Store-level uniqueness** constraints where applicable (enforced in function logic for Phase 5).

---

## 23. Cross-Phase Integrity

- **Phase 2 Lifecycle Engine — unchanged.** No lifecycle definitions, states, transitions, bindings, approval requests, or execution events were modified. The Plugin Engine only reserves `plugin_*` resource-type values for future lifecycle attachment.
- **Phase 3 Event Bus contract — unchanged.** `publishEvent` was not modified. The Plugin Engine consumes it as a client; `PlatformEvent` shape, `sourceType`/`eventType` openness, and the publish-only (no business logic) contract are intact.
- **Phase 4 Event Delivery Runtime — unchanged.** `dispatchEvent`, `processEventDelivery`, `getEventDeliveries`, and the per-subscriber delivery model were not modified. The Plugin Engine publishes events but does not dispatch or process deliveries.

---

## Explicit Frozen Guarantees

- The Plugin Engine stores declarative plugin metadata only.
- It never executes, imports, or downloads plugin code.
- Plugin definitions are global.
- Plugin versions are immutable after release.
- Plugin installations are organization-scoped.
- Uninstall preserves installation history.
- Event publication cannot roll back a successful plugin operation.
- Events contain no configuration, manifest, credentials, secrets, or tokens.
- No business plugin was created in Phase 5.
- No marketplace or billing functionality exists.

**END OF PHASE 5 ARCHITECTURE SNAPSHOT.**