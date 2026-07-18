# Event Delivery Runtime — Specification (Phase 4, Service 3)

> **STATUS: Phase 4 implementation. Awaiting approval.**
> Phase 3 (Platform Event Bus) is **frozen** and is NOT modified by this work. The Lifecycle
> Engine (Phase 2) is also **not modified**. No business modules are added.

## Purpose

The Event Delivery Runtime is the **storage-backed delivery layer** of the Platform Event Bus.
It matches stored `PlatformEvent` records with active `EventSubscription` records and creates an
independent `EventDelivery` record for every matched subscriber.

**Publishing and delivery are separate operations.** `publishEvent` (Phase 3) stores an event
and runs no logic. `dispatchEvent` (Phase 4) creates deliveries. `processEventDelivery`
(Phase 4) invokes the subscriber handler abstraction. Each is an independent, idempotent step.

No RabbitMQ, Kafka, external queues, webhooks, or cron scheduling are introduced. The runtime
is storage-backed (records in the platform store).

## Entities

### EventDelivery
The authoritative per-subscriber delivery record.

| Field | Type | Notes |
|---|---|---|
| `eventId` | string (required) | Reference to `PlatformEvent` |
| `subscriptionId` | string (required) | Reference to `EventSubscription` |
| `subscriber` | string (required) | Denormalized subscriber identifier |
| `eventType` | string (required) | Denormalized event type |
| `status` | enum `pending`/`processing`/`processed`/`failed` | Authoritative per-subscriber status |
| `attemptCount` | number (default 0) | Processing attempts made |
| `lastError` | string | Safe error detail from the most recent failure; null otherwise |
| `createdAt` | date-time | When the delivery was created by `dispatchEvent` |
| `startedAt` | date-time | When processing last started |
| `processedAt` | date-time | When the delivery reached `processed` |
| `failedAt` | date-time | When the delivery last reached `failed` |

**Uniqueness:** conceptually unique by `(eventId, subscriptionId)`. Idempotency is enforced in
`dispatchEvent` (an existence check). Store-level uniqueness is deferred.

## Backend Services

| Function | Input | Behavior | Authorization |
|---|---|---|---|
| `dispatchEvent` | `eventId` | Loads the event, finds active subscriptions matching exact `eventType` or `*`, creates one `EventDelivery` per match (idempotently), returns the delivery summary. Executes no subscriber logic. | core_developer / admin / super_admin |
| `processEventDelivery` | `deliveryId` | Loads delivery + subscription + event; rejects inactive/missing subscriptions cleanly; pending→processing→(processed\|failed); invokes the registered handler abstraction only; never mutates the event payload. | core_developer / admin / super_admin |
| `getEventDeliveries` | `eventId` | Returns the event, its matched deliveries, and an aggregate processing summary. Read-only. | developer / solution_architect / core_developer / admin / super_admin |

Authorization is engine-level. **Backend RLS remains the real security boundary and is
deferred**, consistent with the Event Bus and Lifecycle Engine.

## Dispatch Architecture

```
publishEvent (Phase 3) ──▶ PlatformEvent { status: pending }
                                    │
                          dispatchEvent(eventId)
                                    │
                                    ▼
        find active EventSubscription(eventType = event.eventType  OR  eventType = '*')
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
       no subscribers         match found            (idempotent)
       → no deliveries        → one EventDelivery    → existing delivery kept
       → event = processed    per subscription        (no duplicate)
       (vacuous)              (status: pending)
                                    │
                                    ▼
                          processEventDelivery(deliveryId)
                                    │
                                    ▼
                  pending → processing → processed | failed
```

`dispatchEvent` never executes subscriber business logic. It only creates delivery records.
`processEventDelivery` is the only operation that invokes a handler.

## Per-Subscriber Delivery Model

Every matched subscriber gets its **own** `EventDelivery` record with its **own** status,
attempt count, timestamps, and error. This is the authoritative per-subscriber state.

- A delivery is processed independently by `processEventDelivery(deliveryId)`.
- One delivery's success or failure does not influence another delivery's state.
- The handler is invoked once per delivery, per process call.

## Aggregate Event Status

`PlatformEvent.status` is an **aggregate** derived from its deliveries. `EventDelivery.status`
is the **authoritative** per-subscriber status. The aggregate is **never** used as a
replacement for per-subscriber delivery state.

Aggregate rules:

| Condition | Aggregate event status |
|---|---|
| No deliveries exist | `processed` (vacuous — nothing to deliver) |
| Any delivery is `pending` or `processing` | `pending` |
| All deliveries terminal, any `failed` | `failed` |
| All deliveries `processed` | `processed` |

The aggregate is recomputed by `dispatchEvent` and `processEventDelivery` after their
mutations. A single global event status is **not** used in place of per-subscriber delivery
state.

## Subscriber Handler Contract

`processEventDelivery` invokes the **registered subscriber handler abstraction** only. The
handler receives:

| Field | Source |
|---|---|
| `deliveryId` | the `EventDelivery` |
| `eventId` | the `PlatformEvent` |
| `eventType` | the `PlatformEvent` |
| `sourceType` | the `PlatformEvent` |
| `sourceId` | the `PlatformEvent` |
| `actorId` | the `PlatformEvent` |
| `organizationId` | the `PlatformEvent` |
| `correlationId` | the `PlatformEvent` |
| `payload` | the `PlatformEvent` (transport data; **never mutated** by the runtime) |

- The Event Bus does **not** interpret the payload. Subscriber handlers own their domain
  logic.
- The dispatcher knows subscribers **only** through their registered `subscriber`
  identifier.
- The handler registry is a code-level abstraction keyed by subscriber identifier. It is
  **empty in Phase 4** — no business modules register handlers yet. A process call with no
  registered handler results in a `failed` delivery with `lastError: "No handler registered
  for subscriber '<subscriber>'"`. Handler registration is a future concern (no business
  modules exist in Phase 4).

## Idempotency

- **`dispatchEvent` is idempotent.** Repeated dispatch of the same event never creates a
  duplicate `EventDelivery` for the same `(eventId, subscriptionId)`. The second call returns
  the existing deliveries.
- **Processing an already-terminal delivery is non-destructive.**
  - `processed` → `{ status: 'already_processed' }`
  - `processing` → `{ status: 'already_processing' }`
  - `failed` → `{ status: 'already_failed' }` (no automatic retry in Phase 4)
- No delivery state is overwritten destructively on a repeated call.

## Failure Isolation

- Failure of one subscriber **does not** prevent another subscriber from processing the same
  event. Each delivery is processed by an independent `processEventDelivery` call with its
  own status and error.
- A failed delivery records `lastError` (safe string), `failedAt`, and increments
  `attemptCount`. It does not block other deliveries.
- **No automatic retry** of failed deliveries in Phase 4.

## No-Subscriber Behavior

If an event has **no matching active subscriptions**:

- No `EventDelivery` records are created.
- `dispatchEvent` returns `{ status: 'no_subscribers', deliveries: [], matched: 0 }`.
- This is **not** a system error.
- **Aggregate decision:** with zero deliveries, the event is considered `processed` (vacuous
  completion — there was nothing to deliver). The event's `processedAt` is set. This prevents
  no-subscriber events from remaining `pending` forever.

## Audit and Correlation

- The original `correlationId` is **preserved through every delivery by reference**: each
  `EventDelivery` references its `eventId`, and the handler context receives the event's
  `correlationId`. The delivery does not duplicate `correlationId` (it is reachable via the
  event).
- No domain-specific audit logic is created. Delivery history is append-safe and observable:
  deliveries are created (never deleted by the runtime), and terminal states are recorded with
  timestamps and safe error strings.

## Permission Model

| Capability | Roles |
|---|---|
| `platform.eventbus.read` | developer, solution_architect, core_developer, admin, super_admin |
| `platform.eventbus.dispatch` | core_developer, admin, super_admin |
| `platform.eventbus.process` | core_developer, admin, super_admin |

- Developer & Solution Architect: read only.
- Core Developer / Admin / Super Admin: full runtime management (dispatch + process + read).
- Backend RLS is the real security boundary and is **deferred** (documented).

## Management UI

Read-focused pages (no manual retries in Phase 4):

- **Event Deliveries** (`/event-bus/deliveries`) — lists deliveries, link to detail.
- **Failed Deliveries** (`/event-bus/deliveries/failed`) — lists `failed` deliveries with
  `lastError`.
- **Event Delivery Detail** (`/event-bus/delivery/:deliveryId`) — a single delivery + its
  event and subscription.

Dashboard counters: **Pending Deliveries**, **Processed Deliveries**, **Failed Deliveries**.

## Known Limitations

- **No handler registry content.** No business modules register handlers in Phase 4, so
  `processEventDelivery` results in `failed` (`No handler registered`) until handlers are
  registered by future services.
- **No automatic retry.** Failed deliveries are not retried in Phase 4.
- **No scheduler / no async dispatch loop.** Dispatch and processing are explicit calls; no
  cron or background loop drives them.
- **No store-level uniqueness** for `(eventId, subscriptionId)`; idempotency is enforced by an
  existence check (a concurrent-dispatch race can create duplicates; deferred).
- **Backend RLS not enforced.** Authorization is engine-level; real row-level security is
  deferred.
- **No delivery deletion by the runtime.** Delivery history is append-safe; cleanup/replay is
  a future concern.
- **Unauthorized paths not testable in harness.** `401`/`403` are implemented but the test
  runner is authenticated and authorized.

## Deferred Features

- Automatic retry of failed deliveries (with backoff, attempt caps, dead-letter).
- Scheduler / background dispatch-and-process loop (no cron in Phase 4).
- Workflow integration (driving dispatch/processing from workflows).
- Subscriber handler registry populated by future platform services / business modules.
- Store-level uniqueness for `(eventId, subscriptionId)`.
- Backend RLS enforcement.
- Manual retry UI (intentionally omitted in Phase 4).
- Event replay and back-fill tooling.
- Delivery observability metrics / dashboards beyond counters.

## Architecture Decisions

1. **Publish and deliver are separate.** Storing an event never creates deliveries;
   delivering never publishes. This preserves the Phase 3 invariant that publishing executes
   no logic.
2. **Per-subscriber authoritative status.** `EventDelivery.status` is the source of truth;
   `PlatformEvent.status` is a derived aggregate. A single global status never replaces
   per-subscriber state.
3. **Failure isolation by construction.** Each delivery is an independent record processed by
   an independent call; one failure cannot block another.
4. **Handler abstraction, not handler logic.** The runtime invokes a registered handler
   abstraction and owns no domain logic. The registry is the extension point; empty in Phase 4.
5. **Idempotent dispatch and processing.** Repeated dispatch does not duplicate; repeated
   processing of terminal deliveries is non-destructive.
6. **Storage-backed, no brokers.** Deliveries are records in the platform store; no external
   queues/brokers/webhooks/cron.
7. **No-subscriber is not an error.** Documented aggregate decision: zero deliveries → event
   `processed` (vacuous).
8. **Correlation preserved by reference.** `correlationId` flows via the event into the
   handler context; no duplication on the delivery.
9. **Phase 3 untouched.** The Event Bus entities and functions are unchanged; Phase 4 only
   *adds* the delivery runtime and management UI.

**End of Event Delivery Runtime Specification — Phase 4, awaiting approval.**