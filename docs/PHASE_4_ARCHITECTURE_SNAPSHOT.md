# PGP Core — Phase 4 Architecture Snapshot

**STATUS: FROZEN — Platform Reference Implementation**

**Snapshot date:** 2026-07-17 (UTC)

This document freezes the Phase 4 **Event Delivery Runtime** exactly as implemented and verified. It is the authoritative reference for future platform services. No functionality is described that is not present in the codebase at the time of snapshot.

---

## 1. Scope

Phase 4 adds the **delivery runtime** on top of the Phase 3 Event Bus. It does **not** add a new transport, queue, or broker. It adds the machinery that takes an already-published `PlatformEvent` and fans it out to registered `EventSubscription`s as per-subscriber `EventDelivery` records, then processes each delivery independently through a subscriber handler abstraction.

Phase 4 is strictly the **delivery** concern. Publishing and delivery remain separate operations.

---

## 2. Entity List

Phase 4 introduces one new entity and consumes two existing Phase 3 entities:

| Entity | Introduced | Role |
|---|---|---|
| `PlatformEvent` | Phase 3 | The published event record. Aggregate status is now derived from its deliveries. |
| `EventSubscription` | Phase 3 | A subscriber registration for an event type (exact or wildcard `*`). |
| `EventDelivery` | **Phase 4** | A per-subscriber delivery record. One per matching subscription per event. Authoritative per-subscriber delivery status. |

`EventDelivery` fields:
- `eventId` — reference to `PlatformEvent`
- `subscriptionId` — reference to `EventSubscription`
- `subscriber` — denormalized subscriber identifier
- `eventType` — denormalized event type
- `status` — `pending` | `processing` | `processed` | `failed` (authoritative)
- `attemptCount` — number of processing attempts
- `lastError` — safe error string from the most recent failure (`null` when no failure)
- `createdAt`, `startedAt`, `processedAt`, `failedAt` — lifecycle timestamps

Conceptually unique by `(eventId, subscriptionId)`. Store-level uniqueness is not enforced; idempotency is enforced in `dispatchEvent` (see §11).

---

## 3. Backend Function List

Phase 4 delivery runtime functions (Deno Deploy HTTP handlers in `base44/functions/`):

| Function | Purpose |
|---|---|
| `dispatchEvent` | Match a stored event against active subscriptions and create one `EventDelivery` per match. Idempotent. Does not execute subscriber logic. |
| `processEventDelivery` | Process a single delivery through the subscriber handler abstraction: `pending → processing → (processed | failed)`. |
| `getEventDeliveries` | Read-only: return the event, its deliveries, and an aggregate summary. |

Inherited Phase 3 functions (unchanged by Phase 4): `publishEvent`, `subscribe`, `unsubscribe`, `listSubscriptions`.

Inherited Phase 2 functions (unchanged by Phase 4): `attachLifecycle`, `getLifecycleState`, `executeTransition`, `decideApproval`.

---

## 4. Dispatch Flow

`dispatchEvent({ eventId })`:

1. Authenticate the caller; require a management role (`super_admin`, `admin`, `core_developer`). Otherwise `403`.
2. Resolve `eventId` (string, required). Empty → `400`; not found → `404`.
3. Load the `PlatformEvent`.
4. Find active subscriptions matching the event's `eventType` exactly **and** the wildcard `'*'`. Deduplicate by subscription id. Inactive subscriptions are excluded by the `{ active: true }` filter.
5. **No matching subscriptions:** create no deliveries, set the event status to `processed` (vacuous completion), return `{ status: 'no_subscribers', matched: 0, deliveries: [] }`.
6. **Matching subscriptions exist:** for each, create one `EventDelivery` (`status: pending`, `attemptCount: 0`) **unless** a delivery for the same `(eventId, subscriptionId)` already exists (idempotent skip).
7. Recompute the aggregate event status from all current deliveries and persist it on the event.
8. Return `{ status: 'dispatched', matched, created, deliveries }`.

Dispatching creates delivery records but executes **no publisher logic** and **no subscriber logic**.

---

## 5. Subscription Matching — Exact and Wildcard

A subscription matches an event when **either**:

- `subscription.eventType === event.eventType` (exact match), **or**
- `subscription.eventType === '*'` (wildcard — matches every event type).

Both queries are filtered by `{ active: true }`. Results are merged and deduplicated by subscription id, so a wildcard subscription never produces a second delivery for an event that also has an exact-match subscription.

Inactive subscriptions (`active: false`) are never matched, regardless of type.

---

## 6. Per-Subscriber Delivery Model

Every matching subscription gets its **own independent `EventDelivery`**. There is no batched, shared, or coalesced delivery. The runtime never knows who consumes an event beyond the subscriber identifier — it learns subscribers only through their registered `EventSubscription.subscriber` value.

Delivery fields are denormalized from the subscription and event (`subscriber`, `eventType`) so delivery records are queryable without joins.

---

## 7. Delivery Status Model

Per-subscriber lifecycle, driven by `processEventDelivery`:

```
pending → processing → processed
                     ↘ failed
```

- `pending` — created by `dispatchEvent`, not yet processed.
- `processing` — `processEventDelivery` moved it here; one attempt counted.
- `processed` — handler returned successfully.
- `failed` — handler threw, or the subscription/event could not be resolved cleanly.

`EventDelivery.status` is the **authoritative per-subscriber status**. The event's aggregate status is only a derived projection of its deliveries.

Already-terminal deliveries are non-destructive on re-processing:
- `processing` → `already_processing`
- `processed` → `already_processed`
- `failed` → `already_failed` (no automatic retry in Phase 4)

---

## 8. Aggregate PlatformEvent Status Rules

Derived from the event's full set of deliveries by `aggregateStatus`:

| Condition | Aggregate status |
|---|---|
| No deliveries exist | `processed` (vacuous — nothing to deliver) |
| Any delivery is `pending` or `processing` | `pending` |
| All terminal, at least one `failed` | `failed` |
| All `processed` | `processed` |

`PlatformEvent.status` is recomputed and persisted by `dispatchEvent` (after creating deliveries) and by `processEventDelivery` (after each delivery reaches a terminal state). It is never set by the publisher.

---

## 9. Subscriber Handler Contract

`processEventDelivery` invokes only the registered subscriber handler abstraction — an in-process registry keyed by subscriber identifier. The handler receives a read-only context object:

```ts
{
  deliveryId,
  eventId,
  eventType,
  sourceType,
  sourceId,
  actorId,
  organizationId,
  correlationId,
  payload          // transport data — never mutated by the runtime
}
```

The registry is **empty in Phase 4** — no business modules register handlers yet. A delivery for a subscriber with no registered handler fails with `"No handler registered for subscriber '<subscriber>'"`. This is a delivery failure, not a system crash, and is isolated to that one delivery.

Future platform services register handlers in this registry; the runtime's view of a subscriber never reaches into domain logic.

---

## 10. Idempotency Guararantees

- `dispatchEvent` is idempotent: it never creates a second `EventDelivery` for the same `(eventId, subscriptionId)`. Re-dispatching an already-dispatched event returns the existing deliveries with `created: 0`.
- `processEventDelivery` is idempotent for terminal deliveries: re-processing a `processed`/`failed`/`processing` delivery returns the existing state without side effects.
- Matching itself is idempotent against subscription state changes: a subscription deactivated between two dispatches simply stops matching on subsequent dispatches; it never invalidates deliveries already created.

---

## 11. Verified Guard Paths

The following were exercised against controlled test data and cleaned up afterward:

| Path | Input | Result |
|---|---|---|
| Unknown event id | `dispatchEvent({ eventId: '<unknown>' })` | `404 Event not found` |
| Unknown delivery id | `processEventDelivery({ deliveryId: '<unknown>' })` | `404 Delivery not found` |
| Already-processed delivery | `processEventDelivery` on a `processed` delivery | `200 already_processed` (no side effects) |
| No matching subscribers | `dispatchEvent` on an event with no active exact or wildcard subscription | `200 no_subscribers`, 0 deliveries, event → `processed` |
| Exact + wildcard match | event with one exact subscription and one `*` subscription, plus an inactive exact subscription | `dispatched`, `matched: 2`, `created: 2` (inactive excluded) |
| Duplicate dispatch | re-dispatch of an already-dispatched event | `created: 0` (idempotent) |
| Handler failure isolation | two subscribers on one event, both without handlers | each delivery independently `failed` with its own subscriber-specific error |
| Aggregate summary | `getEventDeliveries` on events with mixed delivery states | correct per-status counts and aggregate status |

**Cleanup verification:** all test events, subscriptions, and deliveries were deleted; `leftoverDeliveries: 0`, `cleanedUp: true`. No test data remains.

---

## 12. CorrelationId Propagation

`PlatformEvent.correlationId` is an open string tracing a chain of related events across services. The delivery runtime **reads** it and passes it through to the subscriber handler context unchanged. It is never generated, rewritten, or interpreted by the delivery runtime.

Verified: a test event created with `correlationId: 'phase4-test-corr-1'` retained that exact value through dispatch, processing, and `getEventDeliveries` (`correlationPreserved: true`), and every delivery for that event referenced it via `eventId` (`correlationReachable: true`).

---

## 13. Payload Preservation

`PlatformEvent.payload` is free-form transport data. The delivery runtime treats it as **opaque and read-only**:

- `dispatchEvent` never reads or mutates `payload`.
- `processEventDelivery` passes `payload` into the handler context by reference and never writes back to it.
- No copy, normalization, parsing, or redaction is performed.

Verified: a test event created with `payload: { test: 1, preserved: true }` was read back after dispatch and processing with both fields intact and unchanged (`payloadPreserved: true`).

**Payload is never interpreted or mutated by the delivery runtime.**

---

## 14. Failure Isolation

Each `EventDelivery` is processed in its own `processEventDelivery` call. A handler failure — or a missing/inactive subscription, or a missing event — is recorded on **that one delivery only** and never propagates to sibling deliveries. The aggregate event status reflects the independent outcomes of all deliveries, but one failed subscriber cannot cause another subscriber's delivery to fail or to be skipped.

Verified: two subscribers (`phase4-test-sub-isoA`, `phase4-test-sub-isoB`) on one event both had no handler; each delivery reached `failed` independently with its own `lastError` naming only itself (`isolationFailed: true`). Neither delivery blocked the other.

**One failed subscriber cannot block another.**

---

## 15. No-Subscriber Behavior

When an event is dispatched and no active subscription matches (no exact match and no active wildcard):

- No `EventDelivery` records are created.
- The event status is set to `processed` (vacuous completion — there was nothing to deliver).
- Response: `{ status: 'no_subscribers', matched: 0, deliveries: [] }`.

This is **not an error**. An event with zero subscribers is a legitimate terminal state, not a system failure.

---

## 16. Permission Model

| Function | Allowed roles | Denied |
|---|---|---|
| `dispatchEvent` | `super_admin`, `admin`, `core_developer` | `403` otherwise |
| `processEventDelivery` | `super_admin`, `admin`, `core_developer` | `403` otherwise |
| `getEventDeliveries` | `super_admin`, `admin`, `core_developer`, `developer`, `solution_architect` | `403` otherwise |

All functions require an authenticated user (`401` if absent). Dispatch and processing are management operations; reading deliveries is available to architecture/developer roles. These map to the platform capability keys `platform.eventbus.read`, `platform.eventbus.dispatch`, `platform.eventbus.process` defined in the frontend permission map.

---

## 17. Known Limitations

1. **No store-level uniqueness constraint** on `(eventId, subscriptionId)`. Idempotency is enforced in `dispatchEvent` logic via a pre-check against existing deliveries. Concurrent `dispatchEvent` calls for the same event may race and create duplicates; this is not addressed in Phase 4.
2. **Subscribe race conditions** (Phase 3, inherited): concurrent `subscribe` calls for the same `(subscriber, eventType)` pair may create duplicate subscriptions.
3. **Handler registry is empty** — no platform service registers a subscriber handler yet, so all `processEventDelivery` calls on real subscriptions fail with `No handler registered`. This is expected at the snapshot boundary.
4. **No automatic retry** — a `failed` delivery stays `failed`. `processEventDelivery` on a failed delivery returns `already_failed`.
5. **No scheduler** — deliveries are processed only when `processEventDelivery` is explicitly invoked. There is no background worker driving `pending` → `processing`.
6. **No dead-letter handling** — failed deliveries remain inline in the delivery log; there is no DLQ, quarantine, or escalation path.
7. **No replay** — an event cannot be re-dispatched to new subscriptions that were created after the original dispatch; `dispatchEvent` is idempotent and will not create deliveries for subscriptions that already have one, nor retroactively create for newly added ones beyond what the current match set covers (newly active subscriptions will get deliveries on the next dispatch, but past events are not backfilled).
8. **No workflow integration** — deliveries are not wired to platform workflows; transition/event-driven automation is deferred.
9. **Aggregate status recomputation** reads the full delivery set per event on each dispatch/process; no incremental counter is maintained. Adequate at Phase 4 scale; revisit if event fan-out grows large.

---

## 18. Deferred

The following are explicitly **not** part of Phase 4 and are reserved for future phases:

- **Retries** — automatic, scheduled, or exponential-backoff retry of failed deliveries.
- **Scheduling** — a worker/scheduler that drives `pending` deliveries through `processEventDelivery` without an explicit caller.
- **Dead-letter handling** — DLQ, quarantine, max-attempts exhaustion, manual replay-from-DLQ.
- **Replay** — re-dispatch of historical events to new subscriptions; backfill on subscription creation.
- **Workflow integration** — triggering platform workflows (lifecycle transitions, approvals) from delivery outcomes; event-driven automation.
- **Store-level uniqueness** — a real unique index on `(eventId, subscriptionId)`.
- **Subscription deduplication** — preventing duplicate `(subscriber, eventType)` subscriptions at subscribe time.
- **Handler registration surface** — the concrete mechanism for platform services to register subscriber handlers (the registry abstraction exists; the registration path is deferred).

---

## 19. Cross-Phase Integrity Statement

- **Publishing and delivery remain separate.** `publishEvent` (Phase 3) stores an event; `dispatchEvent` (Phase 4) creates deliveries. Neither calls the other. A published event can exist with zero deliveries until explicitly dispatched.
- **Dispatching creates delivery records but executes no publisher logic.** `dispatchEvent` does not invoke `publishEvent`, does not mutate the event payload, and does not interpret the event.
- **Every subscriber has an independent `EventDelivery`.** There is no shared/coalesced delivery; each subscription match produces its own record and its own status.
- **`EventDelivery.status` is authoritative per subscriber.** `PlatformEvent.status` is only a derived aggregate and is never the source of truth for an individual subscriber.
- **One failed subscriber cannot block another.** Failure isolation is structural, not configured.
- **`dispatchEvent` is idempotent.** Re-dispatch never duplicates deliveries.
- **Payload is never interpreted or mutated by the delivery runtime.** It is opaque transport data passed by reference to handlers.
- **Phase 2 Lifecycle Engine was not modified.** No Phase 2 entity, function, or contract (`LifecycleDefinition`, `LifecycleState`, `LifecycleTransition`, `LifecycleBinding`, `LifecycleApprovalRequest`, `LifecycleExecutionEvent`, `attachLifecycle`, `getLifecycleState`, `executeTransition`, `decideApproval`) was touched. Phase 4 adds no lifecycle coupling.
- **Phase 3 Event Bus contracts remain compatible.** `PlatformEvent`, `EventSubscription`, `publishEvent`, `subscribe`, `unsubscribe`, `listSubscriptions` are unchanged. Phase 4 only adds `EventDelivery` and the three delivery functions, and only *derives* `PlatformEvent.status` from deliveries (an additive, backward-compatible behavior).

---

**END OF FROZEN SNAPSHOT — Phase 4 Event Delivery Runtime.**