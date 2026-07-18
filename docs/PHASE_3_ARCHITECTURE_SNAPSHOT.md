# Phase 3 Architecture Snapshot — Platform Event Bus

> **STATUS: FROZEN — Platform Reference Implementation**
> **Snapshot date: 2026-07-17 (UTC)**
> **Phase: 3 — Platform Event Bus (Service 2)**

This snapshot documents the **frozen** Platform Event Bus reference implementation. It is the
authoritative description of the Event Bus as built and verified in Phase 3. It is a
**documentation-only** artifact — no functionality is defined or changed here.

---

## 1. Frozen Status

Phase 3 is **frozen**. The Platform Event Bus is the verified, generic event-transport
backbone of the platform. It is recorded here as the reference implementation for future
platform services, alongside the Phase 2 Lifecycle Engine snapshot.

**Explicit guarantees of the frozen state:**

- **Publishing stores an event only.** `publishEvent` writes a single `PlatformEvent` record.
- **Publishing executes no subscriber or business logic.** No subscriber is notified, no
  handler runs, no side effect is triggered at publish time.
- **Publishers never know subscribers.** A publishing service has no knowledge of who, if
  anyone, will consume the event.
- **Subscribers register themselves.** A consuming service registers its own
  `EventSubscription`; no publisher or central component registers it.
- **`eventType` and `sourceType` are open strings.** They are never enums; new event/source
  types require no schema change.
- **`payload` is transport data and is not interpreted** by the Event Bus.
- **No consumers, dispatcher, queues, brokers, or retry runtime exist in Phase 3.**
- **The Lifecycle Engine (Phase 2) was not modified** by this work.

---

## 2. Entity List

Two platform-level entities form the Event Bus. Both are generic and contain no domain logic.

### PlatformEvent
A record of something that happened on the platform, transported by the bus.

| Field | Type | Required | Notes |
|---|---|---|---|
| `eventType` | string | yes | Open event type, e.g. `lifecycle.transitioned`, `plugin.installed` |
| `sourceType` | string | yes | Open source kind, e.g. `lifecycle`, `plugin`, `connector` |
| `sourceId` | string | yes | Source identifier within its own storage; opaque to the bus |
| `actorId` | string | no | User/service that triggered the event; null for system events |
| `organizationId` | string | no | Tenant scope; null for platform-level events |
| `correlationId` | string | no | Traces a chain of related events across services |
| `payload` | object | no | Free-form event data; the bus does not interpret it |
| `status` | enum `pending` / `processed` / `failed` | yes | `pending` on publish; set only by a future processor |
| `createdAt` | date-time | no | When the event was published |
| `processedAt` | date-time | no | When processed by a future processor; null until then |

Platform built-ins (`id`, `created_date`, `updated_date`, `created_by_id`) are present but not
declared in the schema.

### EventSubscription
A subscription registered by a service to consume events of a given type.

| Field | Type | Required | Notes |
|---|---|---|---|
| `subscriber` | string | yes | Subscribing service identifier, e.g. `notification-service` |
| `eventType` | string | yes | Event type to consume; `*` means all event types |
| `active` | boolean (default `true`) | yes | Inactive subscriptions are retained for history |

**Registry:** both entities are listed in `EVENT_BUS_ENTITIES` (`src/lib/entity-registry.js`),
alongside `CORE_ENTITIES`, `LIFECYCLE_ENTITIES`, and `ARCHITECTURE_INTELLIGENCE_ENTITIES`.

---

## 3. Backend Service List

| Function | Input | Behavior | Authorization |
|---|---|---|---|
| `publishEvent` | `eventType, sourceType, sourceId, actorId?, organizationId?, correlationId?, payload?` | Stores a `PlatformEvent` with `status: pending`; `actorId` defaults to the authenticated publisher. Executes no logic. | Any authenticated member |
| `subscribe` | `subscriber, eventType` | Creates a subscription, or reactivates an existing one (idempotent). | admin / core_developer / super_admin |
| `unsubscribe` | `subscriptionId` ∥ `(subscriber, eventType)` | Deactivates a subscription (preserves history). | admin / core_developer / super_admin |
| `listSubscriptions` | `eventType?, active?` | Lists subscriptions, optionally filtered. Read-only. | Any authenticated member |

All four return a `status` string — `published`, `subscribed`, `already_subscribed`,
`reactivated`, `unsubscribed`, or `ok` — plus the relevant object(s).

Authorization is engine-level (function checks). **Backend row-level security remains the real
security boundary** and is deferred, consistent with the Lifecycle Engine.

---

## 4. Event Publishing Flow

```
service A ──publishEvent──▶ PlatformEvent { status: pending }   (stored, no logic runs)
                                    │
                                    ▼
                          (future processor — NOT in Phase 3)
                                    │
                                    ▼
                  match EventSubscription(eventType) ──▶ deliver to subscribers
                                    │
                                    ▼
                          PlatformEvent { status: processed, processedAt: … }
```

1. A service calls `publishEvent` with `eventType`, `sourceType`, `sourceId`, and optional
   `actorId`, `organizationId`, `correlationId`, `payload`.
2. The bus validates required fields and payload shape, then **stores a single
   `PlatformEvent` record** with `status: pending` and `processedAt: null`.
3. The call returns `{ status: 'published', event }`. **No subscriber is notified. No business
   logic runs.**
4. Delivery to subscribers is a **future** concern (no processor exists in Phase 3).

---

## 5. Subscription Flow

1. A consuming service calls `subscribe` with `subscriber` and `eventType`.
2. The bus checks for an existing `EventSubscription` for `(subscriber, eventType)`:
   - **Active match** → returns `{ status: 'already_subscribed' }` (no new record).
   - **Inactive match** → reactivates it (`active: true`) and returns
     `{ status: 'reactivated' }` (no duplicate).
   - **No match** → creates a new `EventSubscription` and returns
     `{ status: 'subscribed' }`.
3. `unsubscribe` deactivates a subscription (`active: false`), preserving the record and
   history. It never deletes the subscription.
4. `listSubscriptions` reads subscriptions, optionally filtered by `eventType` and/or `active`.

**Idempotency:** `subscribe` is idempotent for the same `(subscriber, eventType)` pair in the
normal case. A concurrent-call race past the existence check can create duplicates; no
store-level uniqueness constraint exists in Phase 3 (see Known Limitations).

---

## 6. Event Status Model

| Status | Meaning | Who sets it |
|---|---|---|
| `pending` | Event stored, awaiting processing | `publishEvent` (always, on store) |
| `processed` | Event delivered to matched subscribers | future processor only |
| `failed` | Delivery failed | future processor only |

**Invariant:** `publishEvent` **forces** `status: pending` and never accepts a client-supplied
`status`. The `processed` and `failed` states can **only** be assigned by a future processor,
never by an ordinary publisher. In Phase 3, events remain `pending` indefinitely.

---

## 7. Payload Contract

- `payload` is **transport data**. The Event Bus **does not interpret, validate semantically,
  or transform** its contents.
- `payload` is optional. If omitted, it is stored as `{}`.
- If provided, it **must be a plain object**. Arrays and primitives are rejected with `400`.
- Publishers and subscribers agree on payload shape **out of band** (by contract), not via the
  bus schema.
- A future `EventTopic` catalog (already reserved in the platform) may document expected
  payload shapes per event type as metadata, **without enforcing** them at the bus layer.

---

## 8. Correlation ID Contract

- `correlationId` traces a **chain of related events** across services.
- When an action triggers downstream events, the originator assigns (or reuses) a
  `correlationId`, and every event in the chain carries the same value.
- This lets an operator reconstruct a full cross-service trace from the event log **without
  services knowing about each other**.
- If absent, the bus stores `null`. **The bus never generates a `correlationId`** — the
  originator owns correlation.
- `correlationId` is stored as-is (opaque to the bus).

---

## 9. Wildcard Subscription Behavior

- An `EventSubscription` with `eventType: "*"` subscribes to **all** event types.
- The wildcard is **transport-level only**. It contains **no domain logic** — the bus does not
  enumerate event types, does not filter by source, and does not special-case any event.
- Matching a wildcard subscription to events is a **future processor** concern. In Phase 3,
  `"*"` is simply stored on the subscription record.

---

## 10. Permission Model

Engine-level authorization (function checks). Backend RLS is the real boundary and is deferred.

| Service | Permitted callers |
|---|---|
| `publishEvent` | Any authenticated member |
| `subscribe` | admin / core_developer / super_admin |
| `unsubscribe` | admin / core_developer / super_admin |
| `listSubscriptions` | Any authenticated member |

`actorId` on a published event defaults to the authenticated publisher.

---

## 11. Verified Guard Paths

Verified non-destructively during the Phase 3 stabilization pass (no fake data remained
after testing):

| Guard path | Service | Result |
|---|---|---|
| Missing `eventType` | `publishEvent` | `400` — `eventType, sourceType and sourceId are required` |
| Missing `sourceType` | `publishEvent` | `400` — same |
| Missing `sourceId` | `publishEvent` | `400` — same |
| Malformed payload (string) | `publishEvent` | `400` — `payload must be an object` |
| Malformed payload (array) | `publishEvent` | `400` — `payload must be an object` |
| Missing `subscriber` / `eventType` | `subscribe` | `400` — `subscriber and eventType are required` |
| Unsubscribe of a missing subscription | `unsubscribe` | `404` — `Subscription not found` |
| Empty read | `listSubscriptions` | `200` — `{ status: 'ok', subscriptions: [] }` |
| Subscription idempotency (duplicate `subscribe`) | data layer | exactly one record; no duplicate |
| Subscription reactivation (inactive → active) | data layer | existing record reactivated; no duplicate |
| Unsubscribe preserves record | data layer | record retained, `active: false` |

**Not exercisable in the test harness:** the `401` (unauthenticated) and `403` (unauthorized
subscription management) paths are implemented in code but could not be triggered because the
harness runs as an authenticated, authorized user.

---

## 12. Architectural Invariants

1. **Publishing stores an event only** — `publishEvent` writes one `PlatformEvent` record and
   nothing more.
2. **Publishing executes no subscriber or business logic** — no handler runs at publish time.
3. **Publishers never know subscribers** — the publishing service has no subscriber awareness.
4. **Subscribers register themselves** — no central component registers consumers.
5. **`eventType` and `sourceType` are open strings** — never enums; no schema change for new
   types.
6. **`payload` is transport data and is not interpreted** — shape is by out-of-band contract.
7. **`status` is forced to `pending` on publish** — `processed`/`failed` are future-processor
   only; never client-settable.
8. **`unsubscribe` preserves the record** — subscriptions are deactivated, not deleted.
9. **The bus is generic** — it knows nothing about applications, plugins, connectors,
   lifecycle, documents, or AI.
10. **No domain coupling** — the bus contains no references to any platform domain.

---

## 13. Known Limitations

- **No delivery yet.** Publishing stores the event; no subscriber is notified. Delivery is a
  future processor.
- **No async processing runtime.** `status` stays `pending` until a future processor runs.
- **No payload *semantic* validation.** The bus validates that `payload` is a plain object
  but does not interpret its contents; correctness is by contract.
- **No `*`-matching runtime.** `eventType: "*"` is stored on subscriptions but the matching
  processor is future.
- **Subscribe race condition.** Concurrent `subscribe` calls for the same `(subscriber,
  eventType)` pair can race past the existence check and create duplicates; a uniqueness
  constraint or post-create dedup is deferred (no store-level uniqueness in Phase 3).
- **Backend RLS not enforced.** Authorization is engine-level (function checks); real
  row-level security is deferred.
- **No management UI.** Event and subscription management pages are deferred (the dashboard
  shows counts only).
- **Unauthorized paths not testable in harness.** `401`/`403` are implemented but not
  exercisable via the authenticated test runner.

---

## 14. Deferred Features

- Asynchronous processor / delivery runtime (poll or stream pending events → subscribers).
- Subscriber matching against `eventType` (including `"*"` wildcard).
- Webhook dispatch, retry/backoff, and dead-letter handling.
- Subscription management UI (events list, subscriptions, replay).
- Backend RLS enforcement.
- `EventTopic` catalog integration (document expected payload shapes per event type).
- Event replay and back-fill tooling.
- Organization-scoped subscription visibility.
- Store-level uniqueness for `(subscriber, eventType)`.

---

## 15. Reference Principles for Future Platform Services

The Event Bus establishes the following principles as the reference pattern for future
platform services, consistent with the Phase 2 Lifecycle Engine:

1. **Generic core.** A platform service knows nothing about the domains it serves. It
   operates on open-typed identifiers, not domain-specific enums.
2. **Open strings over enums.** Extensibility is data-driven; new types require no schema
   change.
3. **Separation of concerns.** Storage, execution, approval, and audit are separate services;
   publishing is separate from processing.
4. **Publish ≠ execute.** Recording an event never runs business logic. Side effects belong
   to a separate, later consumer.
5. **Decoupling by design.** Producers never know consumers; consumers register themselves.
   Services communicate via the bus rather than direct dependencies.
6. **Backend RLS is the real boundary.** Frontend/engine checks are convenience, not
   security.
7. **Storage-backed, not broker-backed.** Platform abstractions are records in the platform
   store; external brokers are not introduced.
8. **Append-style records.** Events and subscriptions are retained (deactivated, not
   deleted) to preserve history and auditability.
9. **Minimal, inspectable abstraction.** The smallest surface that future phases can extend
   without breaking the API.

---

## 16. Cross-Phase Integrity

- **Phase 2 (Lifecycle Engine):** **not modified.** Its entities, functions, and runtime are
  unchanged.
- **Phase 1 (Architecture Foundation):** the dashboard and entity registry were extended
  (counts widget + `EVENT_BUS_ENTITIES`) but no existing functionality was altered.
- **Future phases** may add a processor behind the same `publishEvent` / subscription API
  without changing the Event Bus abstraction.

---

**End of Phase 3 Architecture Snapshot — STATUS: FROZEN.**