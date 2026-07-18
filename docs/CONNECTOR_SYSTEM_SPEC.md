# PGP Core — Connector System Specification

## Overview

Connectors are adapters between PGP Core and external providers. Every external provider is accessed through a connector — the Core never depends on a specific provider directly.

## 3-Layer Connector Model

```
ConnectorDefinition  (catalog — e.g. "Google Drive")
        ↓
ConnectorProvider    (specific provider — e.g. "Google" via OAuth)
        ↓
ConnectorConnection  (org-scoped instance — e.g. Org XYZ's Google Drive connection)
```

A single connector definition may expose multiple providers. A single provider may have multiple org-scoped connections.

### Layer 1: ConnectorDefinition
The catalog entry for a connector type. Defines what the connector does, which provider types it supports, and which auth modes are available.

| Field | Description |
|---|---|
| `key` | Unique connector key (e.g. `google_drive`) |
| `supported_provider_types` | Provider keys supported (e.g. `google`, `microsoft`) |
| `auth_modes` | `oauth`, `shared`, `app_user`, `byo_shared` |
| `manifest` | Module dependency metadata |

### Layer 2: ConnectorProvider
A specific provider for a connector definition.

| Field | Description |
|---|---|
| `connector_definition_id` | Parent definition |
| `provider_key` | Provider identifier (e.g. `google`, `openai`, `ollama`) |
| `auth_mode` | Auth mode for this provider |
| `capabilities` | What this provider can do (read, write, sync) |

### Layer 3: ConnectorConnection
An org-scoped connection instance.

| Field | Description |
|---|---|
| `organization_id` | Owning org (tenant boundary) |
| `connector_provider_id` | Reference to provider |
| `status` | `connected`, `disconnected`, `error`, `expired` |
| `token_ref` | **Reference** to secret/token in platform store — NEVER the token itself |
| `connection_metadata` | Non-sensitive metadata only |

## Reserved Provider Keys

Future providers:
`google`, `microsoft`, `dropbox`, `supabase`, `postgresql`, `mysql`, `stripe`, `paypal`, `youtube`, `spotify`, `openai`, `gemini`, `claude`, `grok`, `openrouter`, `ollama`.

## Auth Modes

| Mode | Description |
|---|---|
| `oauth` | Standard OAuth flow — user connects their own account |
| `shared` | Builder connects their account; all org users share it |
| `app_user` | Each app user connects their own account via builder-provided OAuth app |
| `byo_shared` | Workspace admin registers their own OAuth app; token shared across users |

## Secrets Handling (Critical)

- **No secrets are ever stored in entity fields.**
- `ConnectorConnection.token_ref` is a **reference string** (e.g. `secret:connector:org_123:google_drive:conn_456`), never the token itself.
- Actual OAuth tokens / API keys live in Base44 environment variables or the platform connector token store.
- List/get APIs on `ConnectorConnection` never return `token_ref` to non-admin/developer roles.
- No secret is ever imported into frontend code.

## Security

- Connector management requires `platform.connectors.manage` permission.
- Org-scoped connections are isolated by `organization_id`.
- Audit events emitted on connect/disconnect (topics: `connector.connected`, `connector.disconnected`).

## Phase 1 Status

- 3-layer entity schemas created.
- Navigation placeholder exists.
- No live OAuth flows, no token exchange, no connection testing.
- All deferred to Phase 2+.