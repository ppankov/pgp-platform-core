# PGP Core — Connector Architecture

## Overview

The connector system uses a 3-layer model to abstract external providers from the platform. This enables provider flexibility, connection isolation, and secret safety.

## 3-Layer Model

```
Layer 1: ConnectorDefinition
    The catalog entry for a connector type.
    Example: "Google Drive" — defines what the connector does.

        ↓ (has many)

Layer 2: ConnectorProvider
    A specific provider for a connector definition.
    Example: "Google" (OAuth) — defines how to connect.

        ↓ (has many, org-scoped)

Layer 3: ConnectorConnection
    An organization's actual connection to a provider.
    Example: Org XYZ's Google Drive connection.
```

## Why 3 Layers?

1. **Definition** separates "what" from "how" — one connector type can support multiple providers.
2. **Provider** separates the provider identity from the connection — Google Drive via Google vs. via Microsoft.
3. **Connection** is org-scoped and isolated — each org has its own connections with their own tokens.

## Example: Google Drive

```
ConnectorDefinition: google_drive
    ├─ ConnectorProvider: google (OAuth)
    │   ├─ ConnectorConnection: Org A's Google Drive (connected)
    │   └─ ConnectorConnection: Org B's Google Drive (connected)
    └─ ConnectorProvider: microsoft (OAuth)  [future]
        └─ ConnectorConnection: Org C's OneDrive as "Google Drive" alternative
```

## Reserved Provider Keys

`google`, `microsoft`, `dropbox`, `supabase`, `postgresql`, `mysql`, `stripe`, `paypal`, `youtube`, `spotify`, `openai`, `gemini`, `claude`, `grok`, `openrouter`, `ollama`.

## Auth Modes

| Mode | Description | Use Case |
|---|---|---|
| `oauth` | Standard OAuth flow | User connects their own account |
| `shared` | Builder connects; all users share | Platform-level integrations |
| `app_user` | Each user connects via builder's OAuth app | Per-user external accounts |
| `byo_shared` | Workspace admin registers own OAuth app | Enterprise with custom OAuth apps |

## Secrets Handling

- **No secrets in entities.** `ConnectorConnection.token_ref` is a reference string, never the token.
- Tokens live in Base44 environment variables or the platform connector token store.
- List/get APIs never return `token_ref` to non-admin/developer roles.
- No secret is ever imported into frontend code.

## Security

- Connector management requires `platform.connectors.manage` permission.
- Org-scoped connections are isolated by `organization_id`.
- Cross-org access is forbidden.
- Audit events on connect/disconnect (`connector.connected`, `connector.disconnected`).

## Future: Connection Testing & Health

Phase 2+ will add:
- Connection test endpoints (validate token validity)
- Connection health monitoring
- Automatic token refresh for OAuth connections
- Connection metadata enrichment

## Phase 1 Status

- 3-layer entity schemas created (`ConnectorDefinition`, `ConnectorProvider`, `ConnectorConnection`).
- Navigation placeholder exists.
- No live OAuth flows, no token exchange, no connection testing.
- All deferred to Phase 2+.