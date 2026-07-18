# PGP Core — Phase 6 Architecture Snapshot

**STATUS: FROZEN — Platform Reference Implementation**

**Snapshot date:** 2026-07-17 (UTC)

This is a documentation-only snapshot of the Connector Engine as implemented and verified in Phase 6. It is a record of the implementation exactly as built. It does not modify entities, functions, permissions, pages, or behavior.

---

## 1. Scope and Frozen Status

Phase 6 implements the **Connector Engine** — a generic, three-layer integration catalog and connection registry. It is the foundation only: it stores declarative connector metadata, provider auth-mode metadata, and organization-scoped connection records with opaque credential references. It does **not** authenticate, exchange tokens, call external APIs, execute adapters, test live connectivity, synchronize data, deliver webhooks, or store credentials.

Phase 6 is now **frozen**. The implementation is verified against 24 guard paths, all test data is removed, and the temporary role-widening used during verification is reverted. No further structural changes are expected under Phase 6.

---

## 2. Reused and Normalized Existing Structures

Phase 6 reuses existing platform infrastructure without modification:

- **Event Bus** (`publishEvent` service) — consumed as a client; no modification.
- **Event Delivery Runtime** (`dispatchEvent`, `processEventDelivery`) — unchanged; the Connector Engine publishes events but does not dispatch or process deliveries.
- **Lifecycle Engine** — unchanged; connector resources participate through the existing `(resourceType, resourceId)` abstraction only.
- **Plugin Engine** — unchanged; connectors and plugins remain separate.

New structures introduced in Phase 6 were **normalized** to the platform contract at creation time:

- `ConnectorDefinition`, `ConnectorProvider`, `ConnectorConnection` — three new entities, normalized to the declarative-only, credential-free, organization-scoped contract from the start.
- 8 new backend functions — all Deno deploy handlers under the service role, all consuming `publishEvent` rather than creating events directly.
- 4 new pages + 1 dashboard widget + 3 form components — normalized to the existing `ModuleHeader`, `RoleRoute`, `useToast`, and i18n conventions.
- Navigation, routing, permissions, entity registry, and i18n (EN/BG/DE/ES) extended consistently.

---

## 3. Three-Layer Architecture

The Connector Engine separates three concerns:

1. **ConnectorDefinition** (Layer 1) — global catalog entry describing an integration capability. Organization-independent. Contains no credentials, no executable code.
2. **ConnectorProvider** (Layer 2) — a concrete provider implementation for a definition, with supported authentication modes, a non-secret configuration schema, and declarative credential requirements. Global. Contains no tokens or executable code. No adapter is executed in Phase 6.
3. **ConnectorConnection** (Layer 3) — an organization-scoped connection to a provider. Stores non-sensitive configuration and an opaque credential reference. Tenant boundary is `organizationId`.

A single definition can have many providers; a single provider can be connected by many organizations; each connection is independent.

---

## 4. Entity List and Exact Field Responsibilities

### ConnectorDefinition
| Field | Responsibility |
|---|---|
| `key` | Stable, unique machine identifier. Immutable after creation. |
| `name` | Human-readable display name. |
| `description` | What the connector does (non-sensitive prose). |
| `category` | Logical grouping (e.g. repository, files, messages, issues). |
| `active` | Whether this definition can be used by providers and connections. |
| `capabilities` | Declarative open-string capability values (e.g. `repository.read`, `files.write`). |

### ConnectorProvider
| Field | Responsibility |
|---|---|
| `connectorDefinitionId` | Reference to the parent ConnectorDefinition. |
| `key` | Provider key (e.g. google, microsoft, openai). Unique per definition. |
| `name` | Human-readable provider name. |
| `description` | Non-sensitive prose. |
| `authModes` | Declarative array of supported auth modes: `oauth2`, `api_key`, `basic`, `service_account`, `none`. Metadata only. |
| `configurationSchema` | Non-secret configuration field descriptors. Never secret-looking keys. |
| `credentialRequirements` | Declarative list of required secret references (e.g. `oauth2_access_token`). Metadata only. |
| `active` | Whether this provider can be used by connections. |

### ConnectorConnection
| Field | Responsibility |
|---|---|
| `connectorDefinitionId` | Reference to ConnectorDefinition. |
| `connectorProviderId` | Reference to ConnectorProvider. |
| `organizationId` | Owning organization (tenant boundary). |
| `name` | Human-readable connection name. Unique among active (non-disconnected) connections per provider + organization. |
| `configuration` | Non-sensitive configuration data only. Never credentials, tokens, or secrets. |
| `credentialRef` | Opaque reference to externally managed secret material. Never the secret itself. Redacted from ordinary reads. |
| `status` | Administrative status: `configured`, `active`, `disabled`, `disconnected`, `error`. |
| `enabled` | Boolean administrative enable flag. |
| `createdById` | User who created the connection. |
| `enabledAt` | When the connection was last activated. |
| `disabledAt` | When the connection was last disabled. |
| `disconnectedAt` | When the connection was disconnected. Null while active. |
| `lastError` | Reserved for future adapter-runtime failures. Null when no failure. |

Built-in fields (`id`, `created_date`, `updated_date`, `created_by_id`) are present on all records and are not declared in the schemas.

---

## 5. Global versus Organization Scope

- **Definitions are global** — `ConnectorDefinition` has no `organizationId`; it is platform-global and organization-independent.
- **Providers are global** — `ConnectorProvider` has no `organizationId`; it belongs to a definition and is platform-global.
- **Connections are organization-scoped** — `ConnectorConnection` carries `organizationId` as the tenant boundary. Connections are scoped by the `organizationId` parameter in the read functions. Functions operate under the service role (consistent with all platform functions), so the role check at each function entry is the access gate, and platform administrators may read across organizations by design. Direct frontend entity access (e.g. dashboard widgets) is additionally RLS-scoped per the entity schemas.

---

## 6. Backend Function List

All functions are Deno deploy handlers operating under the **service role**.

| Function | Purpose | Authorized roles |
|---|---|---|
| `registerConnectorDefinition` | Create a global connector definition | core_developer, super_admin |
| `registerConnectorProvider` | Create a provider for an active definition | core_developer, super_admin |
| `createConnectorConnection` | Create an organization connection (idempotent) | admin, super_admin |
| `activateConnectorConnection` | configured/disabled → active | admin, super_admin |
| `disableConnectorConnection` | → disabled (idempotent) | admin, super_admin |
| `disconnectConnectorConnection` | → disconnected (non-destructive, idempotent) | admin, super_admin |
| `getConnectorConnection` | Resolve a connection by id or (provider, org, name) | developer, solution_architect, core_developer, admin, super_admin |
| `listConnectors` | Catalog mode + optional organization connection view | developer, solution_architect, core_developer, admin, super_admin |

---

## 7. Connector Definition Contract

- A definition is identified by a stable, immutable `key`.
- `capabilities` is a declarative open-string array (e.g. `repository.read`); new capability values require no schema change.
- `active=false` definitions cannot be used by new providers or connections.
- Definitions contain no credentials, no tokens, and no executable code.
- Duplicate `key` registration is rejected with 409.

---

## 8. Provider Contract

### Supported Auth-Mode Metadata
`authModes` is a declarative array drawn from `oauth2`, `api_key`, `basic`, `service_account`, `none`. Auth modes are metadata only — no token exchange, no OAuth flow, and no adapter execution occurs in Phase 6. Unsupported auth modes are rejected with 400.

### configurationSchema
Describes non-secret configuration field descriptors only. Secret-looking keys (e.g. `api_key`, `secret`, `token`, `password`, `credential`, `client_secret`, `private_key`, `authorization`) are rejected at registration with 400.

### credentialRequirements
A declarative list of required secret references (e.g. `oauth2_access_token`). It describes what an external secrets manager would need to supply — never the secret itself.

### Declarative-Only Behavior
The Plugin Engine stores and validates provider metadata structure but never executes any provider adapter. No external API is called. No real authentication occurs.

---

## 9. Connection Contract

### Non-Sensitive Configuration
`configuration` is a non-sensitive data object. Secret-looking keys are rejected at creation with 400. Configuration never contains credentials, tokens, API keys, or secrets.

### Opaque credentialRef
`credentialRef` is an opaque reference string (e.g. `secret:connector:<organizationId>:<providerKey>:<connectionId>`) identifying externally managed secret material. It is never the secret itself, never resolved by the Connector Engine, and redacted from ordinary reads.

### Status
Administrative status: `configured`, `active`, `disabled`, `disconnected`, `error`. See §12.

### Enabled State
`enabled` is a boolean administrative flag, distinct from `status`. Activation sets `enabled=true` and `status=active`; disabling sets `enabled=false` and `status=disabled`; disconnect sets `enabled=false` and `status=disconnected`.

### History Timestamps
- `enabledAt` — set on activation.
- `disabledAt` — set on disable.
- `disconnectedAt` — set on disconnect; null while active.

These preserve the full lifecycle history of the connection.

### lastError Reservation
`lastError` is reserved for a future adapter runtime to record safe error detail. It is null in Phase 6 — no Phase 6 operation sets it.

---

## 10. Credential and Secret Boundary

`ConnectorConnection` must **never** store:

- OAuth access tokens
- OAuth refresh tokens
- API keys
- passwords
- client secrets
- private keys
- service-account JSON
- session cookies
- authorization headers
- encrypted credential blobs

### Secret-Storage Boundary
Phase 6 does **not** implement a secrets manager. The credential reference is the only secret-adjacent field, and it is a reference, not a secret. Actual credentials live outside `ConnectorConnection` in a future external secret store.

---

## 11. credentialRef Semantics

- **Opaque reference only** — `credentialRef` is a string identifying externally managed secret material. It is never the secret.
- **Never resolved by the Connector Engine** — no function reads, decrypts, or follows the reference.
- **Redacted from ordinary reads** — `getConnectorConnection` and `listConnectors` return `credentialRef: null` to ordinary callers.
- **`hasCredential` indicates presence without exposing the reference** — a boolean `hasCredential` is returned alongside the redacted `credentialRef`, so the UI can show "Credential stored" without revealing the reference.
- **`revealCredentialRef=true`** may reveal the reference only when the caller is `core_developer`/`super_admin` (backend management use).
- **Actual secret storage is external and deferred** — the secrets manager is a future concern; Phase 6 stores only the opaque reference.

---

## 12. Connection Status Model

| Status | Meaning |
|---|---|
| `configured` | Metadata and references recorded; not yet enabled. |
| `active` | Administratively enabled for future adapter use. |
| `disabled` | Temporarily unavailable. |
| `disconnected` | Intentionally terminated (non-destructive). |
| `error` | Reserved for future adapter/runtime failures. |

**`active` means administratively enabled and does not prove external authentication or connectivity.** Phase 6 does not verify connectivity with an external provider. No fake `testConnection` result exists. The UI communicates that `active` is an administrative state, not an externally verified connection.

---

## 13. Idempotency Behavior

- **Duplicate connection creation** — `createConnectorConnection` for an equivalent active `(connectorDefinitionId, connectorProviderId, organizationId, name)` returns `already_created` with the existing connection. An active connection with the same name but a different definition/provider returns 409.
- **Repeated activation** — `activateConnectorConnection` on an already-active connection returns `already_active` with the unchanged connection.
- **Repeated disable** — `disableConnectorConnection` on an already-disabled connection returns `already_disabled`.
- **Repeated disconnect** — `disconnectConnectorConnection` on an already-disconnected connection returns `already_disconnected`.
- **Activation after disconnect** — activating a disconnected connection is rejected with 400 ("Cannot activate a disconnected connection").

---

## 14. Non-Destructive Disconnect and History Preservation

`disconnectConnectorConnection` sets `disconnectedAt` and `enabled=false`. It is **non-destructive**:

- The connection record is preserved for history.
- The credential material is neither deleted nor resolved.
- Repeated disconnect is idempotent.
- Connection records are **never deleted** by runtime operations.

---

## 15. Organization Isolation Model

- Connections are scoped by `organizationId`. A connection in organization A is not visible to organization B through the connection view.
- `getConnectorConnection` resolves by `connectionId` or by `(connectorProviderId, organizationId, name)`. A lookup in the wrong organization returns 404 (organization isolation).
- `listConnectors` with `organizationId` returns only that organization's connections alongside the global catalog.
- Functions run under the service role; the role check at each function entry is the access gate, and platform administrators may read across organizations by design. Direct frontend entity access is additionally RLS-scoped.

---

## 16. Event Bus Integration

The Connector Engine uses the existing `publishEvent` service and never creates `PlatformEvent` records directly.

### Exact connector.* Event Types

| Operation | Event type | sourceType | sourceId |
|---|---|---|---|
| registerConnectorDefinition | `connector.definition_registered` | `connector` | definition id |
| registerConnectorProvider | `connector.provider_registered` | `connector` | provider id |
| createConnectorConnection | `connector.connection_created` | `connector` | connection id |
| activateConnectorConnection | `connector.connection_activated` | `connector` | connection id |
| disableConnectorConnection | `connector.connection_disabled` | `connector` | connection id |
| disconnectConnectorConnection | `connector.connection_disconnected` | `connector` | connection id |

### sourceType/sourceId Rules
- `sourceType` is always `connector`.
- `sourceId` is the id of the definition, provider, or connection that the event concerns.

### Safe Payload Fields
Payloads may contain: `connectorDefinitionId`, `connectorProviderId`, `connectionId`, `organizationId`, `providerKey`, `status`, `enabled`.

Payloads **never** contain: `credentialRef`, configuration values, tokens, credentials, passwords, secrets, private keys, or authorization headers.

### Best-Effort Publication
Publication is **best-effort**: a publish failure or absence of subscribers never rolls back a successful connector operation. The Connector Engine does not dispatch or process deliveries.

### Zero-Subscriber Independence
Events are published regardless of whether any `EventSubscription` exists. Verification confirmed one `connector.connection_created` event was published with zero subscribers present (subscriber-independent).

---

## 17. Lifecycle Compatibility

The Connector Engine does not modify the generic Lifecycle Engine and adds no connector-specific lifecycle logic. Connector resources participate through the existing resource contract `(resourceType, resourceId)` via the reserved resource-type values:

- `connector_definition`
- `connector_provider`
- `connector_connection`

`resourceType` is an open string; these reserved values require no Lifecycle Engine schema change. No lifecycle definitions are automatically created; lifecycle attachment is deferred.

---

## 18. Separation from the Plugin Engine

Connector and Plugin remain separate platform concepts:

- A connector is **not** a plugin.
- Connector installation does **not** use `PluginInstallation`.
- The Connector Engine does **not** add connector logic to the Plugin Engine.
- The Plugin Engine does **not** add plugin logic to the Connector Engine.
- A future plugin or application may declare that it requires a connector, but dependency enforcement is not part of Phase 6.

---

## 19. Permission Model

| Capability | Roles |
|---|---|
| `platform.connectors.read` | developer, solution_architect, core_developer, admin, super_admin |
| `platform.connectors.manage` (definitions + providers) | core_developer, super_admin |
| `platform.connectors.connect` (create/activate/disable/disconnect) | admin, super_admin |

### Role Responsibilities
- **Developer** — read catalog, read visible connection metadata.
- **Solution Architect** — read definitions, providers, auth-mode and capability metadata; no connection mutation.
- **Core Developer** — register and manage definitions, register and manage providers, read connection metadata.
- **Admin** — create organization connections, activate, disable, disconnect; read catalog/providers.
- **Super Admin** — full access.

### Explicit Boundary
- **Core Developer and Super Admin manage definitions and providers.**
- **Admin may create, activate, disable and disconnect organization connections.**
- **Admin may not register definitions or providers.** (Verified: admin → 403 on both management functions after reversion.)
- **Backend functions run under the service role.**
- **Function-level role and organization checks are mandatory.**
- **Direct frontend entity access remains subject to backend RLS.**

---

## 20. Management UI and Dashboard Integration

- **Connector Catalog** (`/connectors`) — definitions table; "Register Definition" gated by `platform.connectors.manage`.
- **Connector Definition Detail** (`/connectors/:definitionId`) — definition overview + providers section; "Register Provider" gated by `platform.connectors.manage`.
- **Organization Connections** (`/connectors/connections`) — organization selector + connections table; "Create Connection" gated by `platform.connectors.connect`.
- **Connector Connection Detail** (`/connectors/connections/:connectionId`) — connection metadata (credentialRef redacted as a "Credential stored" badge); Activate/Disable/Disconnect gated by `platform.connectors.connect`; administrative-state note shown; no authenticate/test/sync buttons.
- **Dashboard widget** — four counters: definitions, active providers, organization connections, active connections; counters use the user-context SDK (RLS-scoped).

---

## 21. Routing, Navigation, Entity Registry and i18n Integration

- **Routing** — `/connectors`, `/connectors/connections`, `/connectors/connections/:connectionId`, `/connectors/:definitionId` are wired in `src/App.jsx`, ordered so `connections` is not captured as `definitionId`. The placeholder fallback excludes the `connector` prefix.
- **Navigation** — `connectors` (`/connectors`) and `connector_connections` (`/connectors/connections`) in the `extensibility` group, visible to developer+ and admin+ roles.
- **Entity registry** — `ConnectorDefinition`, `ConnectorProvider`, `ConnectorConnection` are grouped under `CONNECTOR_ENGINE_ENTITIES` (and counted within `CORE_ENTITIES`).
- **Permissions** — `platform.connectors.read` granted to developer, solution_architect, core_developer, admin; `platform.connectors.manage` to core_developer; `platform.connectors.connect` to admin. (Developer's earlier `platform.connectors.manage` was corrected to `platform.connectors.read` in Phase 6.)
- **i18n** — `connector.*` keys present in EN, BG, DE, ES.

---

## 22. Bulgarian Terminology

The Bulgarian localization uses the following established terminology for the Connector Engine:

- **Система за интеграции** — Connector Engine
- **Каталог с интеграции** — Connector Catalog
- **Дефиниция на интеграция** — Connector Definition
- **Доставчик на интеграция** — Connector Provider
- **Връзка към услуга** — Connector Connection
- **Връзки на организацията** — Organization Connections

Status terminology: Конфигурирана (configured), Активна (active), Деактивирана (disabled), Прекъсната (disconnected).

---

## 23. Verified Guard Paths

All 24 Phase 6 checks pass:

**Management validation (6):**
1. Missing definition key → 400 ("key is required")
2. Duplicate definition key → 409 ("Connector definition key already exists")
3. Missing provider key → 400 ("connectorDefinitionId is required")
4. Duplicate provider key → 409 ("Provider key already exists for this definition")
5. Unsupported auth mode → 400 ("Unsupported auth mode: totally_invalid")
6. Secret-looking provider configuration value → 400 ("configurationSchema must not contain secret-looking field: api_key")

**Connection creation (6):**
7. Unknown definition → 404 ("Connector definition not found")
8. Inactive definition → 400 ("Connector definition is not active")
9. Unknown provider → 404 ("Connector provider not found")
10. Inactive provider → 400 ("Connector provider is not active")
11. Missing organization → 400 ("connectorDefinitionId, connectorProviderId, organizationId and name are required")
12. Missing connection name → 400 (same)

**Idempotency & lifecycle (6):**
13. Duplicate active connection identity → 200 `already_created`
14. credentialRef required but missing → 400 ("credentialRef is required to activate this connection")
15. Credential-like value in configuration → 400 ("configuration must not contain secret-looking field: api_key")
16. Repeated activation → 200 `already_active`
17. Repeated disable → 200 `already_disabled`
18. Repeated disconnect → 200 `already_disconnected`

**Lifecycle edge (1):**
19. Activation after disconnect → 400 ("Cannot activate a disconnected connection")

**Isolation & redaction (2):**
20. Organization isolation → 404 ("Connector connection not found")
21. credentialRef redaction → 200 with `credentialRef: null` and `hasCredential: true`

**Event Bus (2):**
22. Safe Event Bus payload → payload contains no credential/secret keys (`payloadSafe: true`)
23. Publication with zero subscribers → 1 event published with 0 subscribers present (`subscriberIndependent: true`)

**Permission boundary (2):**
24. Admin denied definition/provider management → 403 on `registerConnectorDefinition` and `registerConnectorProvider` ("Not permitted to manage connector definitions" / "Not permitted to manage connector providers")

### Redaction Verification
`getConnectorConnection` on an active connection with a stored `credentialRef` returned `credentialRef: null` and `hasCredential: true` — confirming the reference is redacted from ordinary reads while presence is indicated.

### Event Bus Payload Verification
The single published `connector.connection_created` event's payload keys were checked against an unsafe-key set (`credentialRef`, `configuration`, `config`, `secret`, `secrets`, `token`, `tokens`, `credential`, `credentials`, `password`, `apiKey`, `authorization`, `privateKey`) — none present (`payloadSafe: true`).

### Subscriber-Independence Verification
One `connector.connection_created` event was published with zero `EventSubscription` records present — confirming publication is independent of subscribers (`subscriberIndependent: true`).

---

## 24. Test-Data Cleanup Confirmation

All test data created during verification was removed:

- **10 connections removed** (conn1, active1, dis1, disc1 in stab-co orgs A–D, plus the fresh create in org Z, and any other stab-co connections)
- **4 providers removed** (prov1, provNone, provInactive, provDefInactive)
- **2 definitions removed** (phase6.stab.def1, phase6.stab.inactive)
- **1 connector event removed** (the published `connector.connection_created`)
- **Zero leftovers** — `leftoverConn: 0`, `leftoverProv: 0`, `leftoverEv: 0`, `leftoverDef: 0` (`cleanedUp: true`)

---

## 25. Temporary Role-Widening Reversion Confirmation

During verification, the two management functions (`registerConnectorDefinition`, `registerConnectorProvider`) were temporarily widened to also accept the `admin` role so the management-validation guard paths (§23 paths 1–6) could be exercised with the admin verification identity.

The widening was **fully reverted** after testing:

- `registerConnectorDefinition` role check restored to `core_developer` / `super_admin` only.
- `registerConnectorProvider` role check restored to `core_developer` / `super_admin` only.

**Reversion confirmed:** post-revert, the admin identity receives 403 on both functions ("Not permitted to manage connector definitions" / "Not permitted to manage connector providers"). The permission boundary is intact.

---

## 26. Architectural Invariants

1. Connector metadata is declarative only — the engine stores and validates structure, never executes it.
2. Definitions and providers are platform-global; connections are organization-scoped.
3. `ConnectorConnection` never stores credentials, tokens, or secrets — only an opaque `credentialRef`.
4. `credentialRef` is opaque, never resolved by the engine, and redacted from ordinary reads.
5. `active` is an administrative label, not externally verified connectivity.
6. Disconnect is non-destructive; connection records are never deleted by runtime operations.
7. Event publication is best-effort and never rolls back a successful connector operation.
8. The Connector Engine consumes the Event Bus as a client; it does not dispatch or process deliveries.
9. The Connector Engine adds no connector-specific logic to the Lifecycle Engine or the Plugin Engine.
10. Backend functions run under the service role; function-level role and organization checks are mandatory; direct frontend entity access remains subject to backend RLS.

---

## 27. Known Limitations

1. No store-level uniqueness constraint on `(connectorDefinitionId, key)` for providers or on `(connectorProviderId, organizationId, name)` for active connections — enforced in function logic via pre-checks; concurrent calls may race.
2. `active` is an administrative label only; no external connectivity verification.
3. `error` status is reserved and not set by any Phase 6 operation.
4. `credentialRef` redaction is enforced in the read functions; direct entity SDK access from non-management contexts is additionally RLS-scoped.
5. No provider adapter execution, no dependency enforcement, no package distribution.

---

## 28. Deferred Functionality

- Real OAuth authorization
- OAuth callback handling
- Token exchange
- Token refresh
- External secret manager implementation
- Provider adapters
- External API calls
- Live connectivity testing
- Synchronization
- Webhooks
- Background jobs
- Connection-health monitoring
- Dependency enforcement between plugins/apps and connectors
- Store-level uniqueness where applicable

---

## 29. Cross-Phase Integrity Statement

Phase 6 was additive only. No prior-phase structures were modified:

- **Phase 2 Lifecycle Engine — unchanged.** No lifecycle entities were modified; only `connector_definition`, `connector_provider`, `connector_connection` resource-type values are reserved.
- **Phase 3 Event Bus contract — unchanged.** `publishEvent` was not modified; the Connector Engine consumes it as a client.
- **Phase 4 Event Delivery Runtime — unchanged.** The Connector Engine publishes events but does not dispatch or process deliveries.
- **Phase 5 Plugin Engine — unchanged.** Connector and Plugin remain separate; no plugin entities, functions, or pages were modified.

---

## Explicit Frozen Guarantees

- Connector metadata is declarative only.
- No external authentication occurs in Phase 6.
- No external API is called.
- No provider adapter is executed.
- No credentials are stored in connector entities.
- `credentialRef` is opaque and redacted.
- Definitions and providers are platform-global.
- Connections are organization-scoped.
- Disconnect is non-destructive.
- Event publication cannot roll back a successful connector operation.
- No real GitHub, Google, Slack, Zoho or other provider connector was created.
- No synchronization, webhook or background runtime exists.

**END OF PHASE 6 ARCHITECTURE SNAPSHOT.**