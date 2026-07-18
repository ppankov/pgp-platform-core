# PGP Core — Connector Engine Specification (Phase 6)

**Status:** Phase 6 — Connector Catalog and Connection Registry (foundation only).

This document specifies the Connector Engine exactly as implemented in Phase 6. Phase 6 creates a catalog and connection-registry foundation only. It does **not** authenticate against external providers, exchange OAuth codes, refresh tokens, call external APIs, synchronize external data, test real connectivity, execute provider adapters, deliver webhooks, or store credentials.

---

## 1. Overview

The Connector Engine provides a generic, three-layer integration catalog and connection registry:

- a **global connector catalog** (definitions)
- **provider definitions** with authentication-mode metadata
- **organization-scoped connection records** with non-sensitive configuration and opaque credential references
- **activate / disable / disconnect** operations
- **Event Bus integration** and **Lifecycle compatibility**

The engine separates three concerns:

1. **Connector identity** — `ConnectorDefinition` (global, organization-independent)
2. **Provider implementation** — `ConnectorProvider` (global, belongs to a definition)
3. **Connection instance** — `ConnectorConnection` (organization-scoped)

---

## 2. Definition / Provider / Connection Separation

- A **definition** describes an integration capability (e.g. repository, files, messages). It is global, carries declarative capabilities, and contains no credentials or executable code.
- A **provider** belongs to exactly one definition and describes a concrete provider implementation with supported authentication modes, a non-secret configuration schema, and declarative credential requirements. It is global and contains no tokens or executable code. No provider adapter is executed in Phase 6.
- A **connection** belongs to exactly one organization and references one provider. It carries non-sensitive configuration and an **opaque credential reference**. It is organization-scoped.

A single definition can have many providers; a single provider can be connected by many organizations; each connection is independent.

---

## 3. Global versus Organization Scope

- `ConnectorDefinition` and `ConnectorProvider` are platform-global (organization-independent).
- `ConnectorConnection` is organization-scoped (`organizationId` is the tenant boundary).
- Connections are scoped by the `organizationId` parameter in the read functions; functions operate under the service role (consistent with all platform functions), so the role check at each function entry is the access gate, and platform administrators may read across organizations by design. Direct frontend entity access (e.g. dashboard widgets) is additionally RLS-scoped per the entity schemas.

---

## 4. Provider Auth-Mode Metadata

`ConnectorProvider.authModes` is a declarative array drawn from: `oauth2`, `api_key`, `basic`, `service_account`, `none`. Auth modes are metadata only — no token exchange, no OAuth flow, and no adapter execution occurs in Phase 6. `credentialRequirements` is a declarative list of required secret references (e.g. `oauth2_access_token`); it describes what an external secrets manager would need to supply, never the secret itself.

---

## 5. Configuration Contract

- `ConnectorProvider.configurationSchema` describes non-secret configuration fields only. Secret-looking keys are rejected at registration.
- `ConnectorConnection.configuration` is a non-sensitive data object. Secret-looking keys are rejected at creation.
- Configuration is data only and never contains credentials, tokens, API keys, or secrets.

---

## 6. Credential-Reference Contract

`ConnectorConnection.credentialRef` is an **opaque reference string** only, e.g. `secret:connector:<organizationId>:<providerKey>:<connectionId>`. It identifies externally managed secret material. The Connector Engine must not resolve, display, log, publish, or return the underlying secret.

`ConnectorConnection` must **never** store: OAuth access tokens, OAuth refresh tokens, API keys, passwords, client secrets, private keys, session cookies, authorization headers, service-account JSON, or encrypted credential blobs.

### Secret-Storage Boundary

Phase 6 does **not** implement a secrets manager. The credential reference is the only secret-adjacent field, and it is a reference, not a secret. Actual credentials live outside `ConnectorConnection` in a future external secret store. `credentialRef` is redacted from ordinary frontend reads (see §13).

---

## 7. Connection Status Model

| Status | Meaning |
|---|---|
| `configured` | Metadata and references recorded; not yet enabled. |
| `active` | Administratively enabled for future adapter use. **Does not mean externally verified.** |
| `disabled` | Temporarily unavailable. |
| `disconnected` | Intentionally terminated (non-destructive). |
| `error` | Reserved for future adapter/runtime failures. |

Phase 6 does **not** verify connectivity with an external provider. `active` means administratively enabled, not authenticated or reachable. No fake `testConnection` result exists.

---

## 8. Administrative Activation Semantics

`activateConnectorConnection` moves a `configured` or `disabled` connection to `active`. It performs **no external API call**. It requires `credentialRef` when the provider's auth modes require credentials (any mode other than `none`). Activation is idempotent when already active and rejected for disconnected connections.

The UI must clearly communicate that `active` is an administrative state, not an externally verified connection.

---

## 9. Non-Destructive Disconnect

`disconnectConnectorConnection` sets `disconnectedAt` and `enabled=false`. It is non-destructive: the historical record is preserved, and the credential material is neither deleted nor resolved. Repeated disconnect is idempotent. Connection records are **never deleted** by runtime operations.

---

## 10. Backend Functions

All functions are Deno deploy handlers operating under the **service role**.

| Function | Purpose | Authorized roles |
|---|---|---|
| `registerConnectorDefinition` | Create a global definition | core_developer, super_admin |
| `registerConnectorProvider` | Create a provider for an active definition | core_developer, super_admin |
| `createConnectorConnection` | Create an organization connection (idempotent) | admin, super_admin |
| `activateConnectorConnection` | configured/disabled → active | admin, super_admin |
| `disableConnectorConnection` | active/configured → disabled (idempotent) | admin, super_admin |
| `disconnectConnectorConnection` | → disconnected (non-destructive, idempotent) | admin, super_admin |
| `getConnectorConnection` | Resolve a connection by id or (provider, org, name) | developer, solution_architect, core_developer, admin, super_admin |
| `listConnectors` | Catalog mode + optional organization connection view | developer, solution_architect, core_developer, admin, super_admin |

---

## 11. Installation / Connection Idempotency

`createConnectorConnection` is idempotent for equivalent active connection identity `(connectorDefinitionId, connectorProviderId, organizationId, name)`:
- Active (non-disconnected) connection with the same identity → `already_created`.
- Active connection with the same name but a different definition/provider → `409`.

`activateConnectorConnection`, `disableConnectorConnection`, and `disconnectConnectorConnection` are each idempotent for their target state.

---

## 12. Event Bus Integration

The Connector Engine uses the existing `publishEvent` service and never creates `PlatformEvent` records directly.

| Operation | Event type | sourceType | sourceId |
|---|---|---|---|
| registerConnectorDefinition | `connector.definition_registered` | `connector` | definition id |
| registerConnectorProvider | `connector.provider_registered` | `connector` | provider id |
| createConnectorConnection | `connector.connection_created` | `connector` | connection id |
| activateConnectorConnection | `connector.connection_activated` | `connector` | connection id |
| disableConnectorConnection | `connector.connection_disabled` | `connector` | connection id |
| disconnectConnectorConnection | `connector.connection_disconnected` | `connector` | connection id |

**Payloads** may contain: `connectorDefinitionId`, `connectorProviderId`, `connectionId`, `organizationId`, `providerKey`, `status`, `enabled`. Payloads **never** contain `credentialRef`, configuration values, authentication data, API keys, tokens, passwords, secrets, headers, or private keys.

Publication is **best-effort**: a publish failure or absence of subscribers never rolls back a successful connector operation. The Connector Engine does not dispatch or process deliveries.

---

## 13. UI Redaction Rules

- `credentialRef` is **redacted** from `getConnectorConnection` and `listConnectors` responses (replaced with `null` plus a boolean `hasCredential`).
- `credentialRef` may be revealed only when `revealCredentialRef=true` **and** the caller is `core_developer`/`super_admin` (backend management use).
- The UI never displays `credentialRef`, secrets, tokens, passwords, or authorization headers to ordinary users.
- The UI does not present buttons claiming "Authenticate", "OAuth Login", "Test Live Connection", or "Synchronize Now" — those belong to the future adapter runtime.

---

## 14. Lifecycle Compatibility

The Connector Engine does not modify the generic Lifecycle Engine and adds no connector-specific lifecycle logic. Connector resources participate through the existing resource contract `(resourceType, resourceId)` via the reserved resource-type values:

- `connector_definition`
- `connector_provider`
- `connector_connection`

No lifecycle definitions are automatically created; lifecycle attachment is deferred.

---

## 15. Plugin Engine Separation

Connector and Plugin remain separate platform concepts. The Connector Engine does **not**: make a connector a plugin, install connectors through `PluginInstallation`, add connector logic to the Plugin Engine, or add plugin logic to the Connector Engine. A future plugin or application may declare that it requires a connector, but dependency enforcement is not part of Phase 6.

---

## 16. Permission Model

| Capability | Roles |
|---|---|
| `platform.connectors.read` | developer, solution_architect, core_developer, admin, super_admin |
| `platform.connectors.manage` (definitions + providers) | core_developer, super_admin |
| `platform.connectors.connect` (create/activate/disable/disconnect) | admin, super_admin |

- **Developer** — read catalog, read visible connection metadata.
- **Solution Architect** — read definitions, providers, auth-mode and capability metadata; no connection mutation.
- **Core Developer** — register and manage definitions, register and manage providers, read connection metadata.
- **Admin** — create organization connections, activate, disable, disconnect; read catalog/providers.
- **Super Admin** — full access.

Backend functions run under the service role. Function-level role and organization checks are mandatory. Direct frontend entity access remains subject to backend RLS.

---

## 17. Management UI and Dashboard

- **Connector Catalog** (`/connectors`) — definitions table; "Register Definition" gated by `platform.connectors.manage`.
- **Connector Definition Detail** (`/connectors/:definitionId`) — definition overview + providers section; "Register Provider" gated by `platform.connectors.manage`.
- **Organization Connections** (`/connectors/connections`) — organization selector + connections table; "Create Connection" gated by `platform.connectors.connect`.
- **Connector Connection Detail** (`/connectors/connections/:connectionId`) — connection metadata (credentialRef redacted as a "Credential stored" badge); Activate/Disable/Disconnect gated by `platform.connectors.connect`; administrative-state note shown; no authenticate/test/sync buttons.
- **Dashboard widget** — four counters: definitions, active providers, organization connections, active connections; counters use the user-context SDK (RLS-scoped).

---

## 18. Entity Registry, Navigation, Routing and i18n

- **Entity registry** — `ConnectorDefinition`, `ConnectorProvider`, `ConnectorConnection` are in `CORE_ENTITIES`; `CONNECTOR_ENGINE_ENTITIES` groups them.
- **Navigation** — `connectors` (`/connectors`) and `connector_connections` (`/connectors/connections`) in the `extensibility` group.
- **Routing** — `/connectors`, `/connectors/connections`, `/connectors/connections/:connectionId`, `/connectors/:definitionId` are wired (ordered so `connections` is not captured as `definitionId`); the placeholder fallback excludes the `connector` prefix.
- **i18n** — `connector.*` keys present in EN, BG, DE, ES. Bulgarian uses: Система за интеграции, Каталог с интеграции, Дефиниция на интеграция, Доставчик на интеграция, Връзка към услуга, Връзки на организацията, Конфигурирана, Активна, Деактивирана, Прекъсната.

---

## 19. Known Limitations

1. No store-level uniqueness constraint on `(connectorDefinitionId, key)` for providers or on `(connectorProviderId, organizationId, name)` for active connections — enforced in function logic via pre-checks; concurrent calls may race.
2. `active` is an administrative label only; no external connectivity verification.
3. `error` status is reserved and not set by any Phase 6 operation.
4. `credentialRef` redaction is enforced in the read functions; direct entity SDK access from non-management contexts is additionally RLS-scoped.
5. No provider adapter execution, no dependency enforcement, no package distribution.

---

## 20. Deferred Functionality

- **OAuth / token exchange** — no OAuth flow, no code exchange, no token refresh.
- **Provider adapters** — no adapter runtime; providers are declarative only.
- **External API calls** — none.
- **Live connection testing** — no `testConnection`.
- **Synchronization** — no data sync, no background jobs.
- **Webhooks** — no webhook delivery.
- **Credential storage** — no secrets manager; `credentialRef` is a reference only.

---

## 21. Cross-Phase Integrity

- **Phase 2 Lifecycle Engine — unchanged.** No lifecycle entities were modified; only `connector_*` resource-type values are reserved.
- **Phase 3 Event Bus contract — unchanged.** `publishEvent` was not modified; the Connector Engine consumes it as a client.
- **Phase 4 Event Delivery Runtime — unchanged.** The Connector Engine publishes events but does not dispatch or process deliveries.
- **Phase 5 Plugin Engine — unchanged.** Connector and Plugin remain separate; no plugin entities, functions, or pages were modified.

**END OF PHASE 6 CONNECTOR ENGINE SPEC.**