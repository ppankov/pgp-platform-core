# PGP Core — Event System

## Overview

The Event Bus is a reserved internal architecture for platform-wide event propagation. It enables loose coupling between modules, audit correlation, webhook delivery, and workflow triggers.

## Architecture (Future)

```
Producers (platform services, backend functions)
        ↓
    Event Bus (internal dispatcher)
        ↓
Consumers (webhooks, workflows, plugins, audit ingestion)
```

### Producers
Platform services and backend functions emit events by topic. Only backend services emit events — the frontend never produces platform events directly.

### Bus
The internal dispatcher routes events to subscribed consumers. Implementation is Phase 2+.

### Consumers
- **Webhooks** — external endpoints registered via the Webhooks module
- **Workflows** — Base44 workflows triggered by event topics
- **Plugins** — installed plugins that subscribe to topics
- **Audit** — every emitted event writes an `AuditEvent` with `event_topic` set

## EventTopic Catalog

Events are cataloged in the `EventTopic` entity:

| Field | Description |
|---|---|
| `key` | Unique topic key (e.g. `application.installed`) |
| `description` | What this event represents |
| `payload_schema` | Expected payload shape |
| `is_system` | System topics are immutable |
| `status` | `reserved`, `active`, `deprecated` |

## Reserved Topics

- `application.installed`
- `application.enabled`
- `application.disabled`
- `application.updated`
- `plugin.enabled`
- `plugin.disabled`
- `connector.connected`
- `connector.disconnected`
- `user.created`
- `user.invited`
- `organization.created`
- `organization.suspended`
- `feature.enabled`
- `feature.disabled`
- `role.assigned`
- `role.revoked`

## Persistence

Every emitted event writes an `AuditEvent` with `event_topic` set to the topic key. This provides:
- Durable record of all platform events
- Correlation between events and audit entries
- Queryability for compliance and debugging

## Security

- Only backend services emit events — no frontend endpoint can produce platform events.
- Event payloads never contain secrets or sensitive data.
- Consumer subscriptions are validated before delivery.
- Webhook delivery includes signature verification (Phase 2+).

## Phase 1 Status

- `EventTopic` entity schema created.
- `AuditEvent.event_topic` field exists for future correlation.
- Topics are documented (reserved).
- No dispatch runtime, no consumer subscriptions, no webhook delivery.
- All deferred to Phase 2+.