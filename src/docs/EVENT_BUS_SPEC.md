# Platform Event Bus — Specification (Phase 3, Service 2)

> **STATUS: Phase 3 implementation. Awaiting approval.**
> The Lifecycle Engine (Phase 2) is frozen and is NOT modified by this work. The Event Bus is
> a separate, generic platform service.

## Purpose

The Platform Event Bus is the **communication backbone** between platform services. It lets
services communicate without direct coupling: **no service should directly depend on another
service if an event can be used instead.**

The Event Bus is **generic**. It knows nothing about:
- Applications
- Plugins
- Connectors
- Lifecycle
- Documents
- AI

It **transports events only.**

## Architecture Rules

1. **The Event Bus never knows who consumes an event.** Subscribers register themselves; the
   publisher never knows the subscribers.
2. **Publishing executes no business logic.** Publishing only *stores* the event. Subscribers
   consume events later.
3. **Open-typed.** `eventType` and `sourceType` are open strings, never enums. New event types
   require no schema change.
4. **No queues. No message brokers. No RabbitMQ. No Kafka.** This phase creates only the
   platform abstraction. Delivery/fan-out to subscribers is a future concern.
5. **Synchronous publishing, asynchronous processing (future).** `publishEvent` stores the
   event synchronously and returns. A future processor will deliver events to subscribers.

## Entities

### PlatformEvent
A record of something that happened on the platform.

| Field | Type | Notes |
|---|---|---|
| `eventType` | string (required) | Open event type, e.g. `lifecycle.transitioned`, `plugin.installed` |
| `sourceType` | string (required) | Open source kind, e.g. `lifecycle`, `plugin`, `connector` |
| `sourceId` | string (required) | Source identifier within its own storage; opaque to the bus |
| `actorId` | string | User/service that triggered the event; null for system events |
| `organizationId` | string | Tenant scope; null for platform-level events |
| `correlationId` | string | Traces a chain of related events across services |
| `payload` | object | Free-form event data; the bus does not interpret it |
| `status` | enum `pending`/`processed`/`failed` | `pending` on publish; set by a future processor |
| `createdAt` | date-time | When the event was published |
| `processedAt` | date-time | When processed by a future processor; null until then |

(`id`, `created_date`, `updated_date`, `created_by_id` are platform built-ins.)

### EventSubscription
A subscription registered by a service to consume events of a given type.

| Field | Type | Notes |
|---|---|---|
| `subscriber` | string (required) | Subscribing service identifier, e.g. `notification-service` |
| `eventType` | string (required) | Event type to consume; `*` means all event types |
| `active` | boolean (default true) | Inactive subscriptions are retained for history |

## Services (backend functions)

| Function | Input | Behavior | Authorization |
|---|---|---|---|
| `publishEvent` | `eventType, sourceType, sourceId, actorId?, organizationId?, correlationId?, payload?` | Stores a `PlatformEvent` with `status: pending`; `actorId` defaults to the authenticated publisher. Executes no logic. | Any authenticated member |
| `subscribe` | `subscriber, eventType` | Creates a subscription, or reactivates an existing one (idempotent). | admin / core_developer / super_admin |
| `unsubscribe` | `subscriptionId` \|\| `(subscriber, eventType)` | Deactivates a subscription (preserves history). | admin / core_developer / super_admin |
| `listSubscriptions` | `eventType?, active?` | Lists subscriptions, optionally filtered. Read-only. | Any authenticated member |

**Response shape:** every service returns a `status` string — `published`, `subscribed`,
`already_subscribed`, `reactivated`, `unsubscribed`, or `ok` — plus the relevant object(s)
(`event`, `subscription`, or `subscriptions`).

**Validation:**
- `publishEvent` — `eventType`, `sourceType`, `sourceId` are required non-empty strings;
  `payload` is optional but, if provided, must be a plain object (arrays and primitives are
  rejected with `400`); `status` is forced to `pending` and is **never** client-settable.
- `subscribe` — `subscriber` and `eventType` are required non-empty strings.
- `unsubscribe` — requires `subscriptionId` **or** `(subscriber, eventType)`; the resolved
  subscription is deactivated (preserved), not deleted; `404` if not found.

> Authorization here is engine-level. **Backend RLS remains the real security boundary**
> (deferred, consistent with the Lifecycle Engine).

## Event Lifecycle

```
service A ──publishEvent──▶ PlatformEvent { status: pending }   (stored, no logic runs)
                                    │
                                    ▼
                          (future processor)
                                    │
                                    ▼
                  match EventSubscription(eventType) ──▶ deliver to subscribers
                                    │
                                    ▼
                          PlatformEvent { status: processed, processedAt: … }
```

- **Publish** (now): `publishEvent` stores the event with `status: pending` and returns. No
  subscribers are notified.
- **Process** (future): a processor reads pending events, matches active subscriptions by
  `eventType` (with `*` matching all), delivers to subscribers, then sets `status: processed`
  and `processedAt`.
- **Failure** (future): a failed delivery sets `status: failed` for retry/inspection.

## Event Payload Philosophy

The payload is **free-form** (`object`). The Event Bus does **not** interpret, validate, or
transform payload shape — that is the **subscriber's** responsibility.

- The bus carries the payload; it does not understand it.
- Publishers and subscribers agree on payload shape **out of band** (by contract), not via the
  bus schema.
- This keeps the bus generic: any service can publish any event without a schema change.
- If provided, `payload` must be a plain object (arrays and primitives are rejected with `400`); an omitted payload is stored as `{}`.
- A future `EventTopic` catalog (already reserved in the platform) may document expected
  payload shapes per event type as metadata, without enforcing them at the bus layer.

## Correlation IDs

`correlationId` traces a chain of related events across services.

- When an action triggers downstream events, the originator assigns (or reuses) a
  `correlationId` and every event in the chain carries the same value.
- This lets an operator reconstruct a full cross-service trace from the event log without
  services knowing about each other.
- If absent, the bus stores `null`; it never generates one (the originator owns correlation).

## Future Asynchronous Processing

This phase implements **synchronous publishing only**. Asynchronous processing is explicitly
deferred:

- A future **processor** will poll or stream pending `PlatformEvent`s, match them against
  active `EventSubscription`s by `eventType`, and deliver.
- Delivery mechanisms (webhook dispatch, in-process handler invocation, retry/backoff,
  dead-letter) are future concerns and do **not** change this abstraction.
- The `status` / `processedAt` fields exist now so the processor can record outcomes later
  without a schema migration.

**No queues, brokers, RabbitMQ, or Kafka are introduced.** The platform abstraction is
storage-backed (`PlatformEvent` records); a processor can be added later behind the same API.

## Future Event Compatibility

The Event Bus supports future events **without change**, because `eventType` is an open string:

- `lifecycle.transitioned`
- `approval.requested`
- `approval.approved`
- `plugin.installed`
- `connector.connected`
- `application.published`
- `document.uploaded`
- `ai.request.completed`
- `workflow.finished`

(The recommended convention is `source.occurrence`, e.g. `lifecycle.transitioned`, but the
bus accepts any non-empty string — including the PascalCase forms above — without modification.)

## Architecture Decisions

1. **Generic by design.** The bus transports events only; it has no knowledge of any domain.
   This mirrors the Lifecycle Engine's storage-independence principle.
2. **Publish ≠ execute.** Storing an event never runs business logic. This guarantees the bus
   cannot accidentally couple services at publish time.
3. **Publisher/subscriber decoupling.** The publisher never knows subscribers; subscribers
   register themselves. Services can be added/removed without touching publishers.
4. **Storage-backed, not broker-backed.** Events are records in `PlatformEvent`, not messages
   in a broker. This keeps the abstraction minimal and inspectable, and lets a processor be
   added later without changing the API.
5. **Open-typed extensibility.** `eventType`/`sourceType` are open strings; new event types
   need no schema change.
6. **One reference implementation pattern.** Follows the Phase 2 principles: generic core,
   open strings over enums, separate services, backend RLS as the real boundary, append-style
   audit/log records.

## Known Limitations

- **No delivery yet.** Publishing stores the event; no subscriber is notified. Delivery is a
  future processor.
- **No async processing runtime.** `status` stays `pending` until a future processor runs.
- **No payload *semantic* validation.** The bus validates that `payload` is a plain object but does not interpret its contents; correctness is by contract.
- **No `*`-matching runtime.** `eventType: *` is stored on subscriptions but the matching
  processor is future.
- **Subscribe race condition.** Concurrent `subscribe` calls for the same `(subscriber,
  eventType)` pair can race past the existence check and create duplicates; a uniqueness
  constraint or post-create dedup is deferred (no store-level uniqueness in Phase 3).
- **Backend RLS not enforced.** Authorization is engine-level (function checks); real row-level
  security is deferred.
- **No management UI.** Event and subscription management pages are deferred (the dashboard
  shows counts only).

## Deferred Features

- Asynchronous processor / delivery runtime (poll or stream pending events → subscribers).
- Webhook dispatch and retry/backoff / dead-letter handling.
- Subscription management UI (events list, subscriptions, replay).
- Backend RLS enforcement.
- `EventTopic` catalog integration (document expected payload shapes per event type).
- Event replay and back-fill tooling.
- Organization-scoped subscription visibility.