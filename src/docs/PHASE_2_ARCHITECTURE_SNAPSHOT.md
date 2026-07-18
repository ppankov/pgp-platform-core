# Phase 2 Architecture Snapshot — Lifecycle Engine & Execution Runtime

> **STATUS: FROZEN — Platform Reference Implementation**
>
> This snapshot captures the Lifecycle Engine and Execution Runtime as approved at the close
> of Phase 2. It is the **reference implementation** for all future platform services on PGP
> Core. Do not redesign or extend it unless a real architectural issue is discovered later.
> New capabilities are built as separate services that *consume* this engine, not by
> modifying it.

Snapshot date: 2026-07-17.

---

## 1. Entity List

Six entities form the engine. Catalog entities define *structure*; runtime entities are the
*persistence, approval, and audit* services.

| Entity | Layer | Purpose | Key fields |
|---|---|---|---|
| `LifecycleDefinition` | Catalog | A reusable lifecycle for a resource kind | `name`, `targetType` (open string), `active` |
| `LifecycleState` | Catalog | A state within a lifecycle | `lifecycleId`, `key`, `title`, `order`, `isInitial`, `isFinal` |
| `LifecycleTransition` | Catalog | An allowed state change | `lifecycleId`, `fromState`, `toState`, `allowedRoles`, `requiresApproval` |
| `LifecycleBinding` | Persistence service | Binds a resource to a lifecycle + current state | `resourceType`, `resourceId`, `lifecycleId`, `currentLifecycleStateId` |
| `LifecycleApprovalRequest` | Approval service | A pending approval-gated transition | `bindingId`, `lifecycleId`, `transitionId`, `fromState`, `toState`, `status`, `requestedById`, `decidedById` |
| `LifecycleExecutionEvent` | Audit service | Append-only runtime audit record | `bindingId`, `resourceType`, `resourceId`, `lifecycleId`, `outcome`, `actorId` |

**Reference-naming convention:** every reference to a lifecycle definition uses the field
`lifecycleId`, across catalog and runtime.

---

## 2. Service List

Execution, approval, audit, and persistence are **separate platform services**, each with its
own entity. The runtime functions orchestrate them but never merge them.

| Service | Backed by | Responsibility |
|---|---|---|
| **Catalog** | `LifecycleDefinition`, `LifecycleState`, `LifecycleTransition` | Defines lifecycles, states, and transitions. No execution logic. |
| **Persistence** | `LifecycleBinding` | Stores the abstraction triple `(resourceType, resourceId, currentLifecycleStateId)`. The only state the engine mutates. |
| **Approval** | `LifecycleApprovalRequest` + `decideApproval` | Holds pending approval-gated transitions; resolved by approvers. |
| **Audit** | `LifecycleExecutionEvent` | Append-only record of every runtime action. Never updated or deleted. |
| **Execution** | Backend functions | `attachLifecycle`, `getLifecycleState`, `executeTransition`, `decideApproval` — orchestrate the above. |

The execution layer operates **only** on the abstraction triple; it never touches resource
storage.

---

## 3. Runtime Flow

### Attach
1. Caller invokes `attachLifecycle { resourceType, resourceId, lifecycleId }`.
2. Persistence: reject if a binding for `(resourceType, resourceId)` already exists (one
   lifecycle per resource).
3. Catalog: load the definition (must be active) and its initial state (`isInitial`).
4. Persistence: create `LifecycleBinding` at the initial state.
5. Audit: write an event with `outcome: attached`.

### Read
1. Caller invokes `getLifecycleState { resourceType, resourceId }`.
2. Persistence: resolve the binding. If none, return `attached: false` (404).
3. Catalog: load states + transitions for the lifecycle.
4. Return the binding, current state, and transitions available from it. Read-only.

### Execute a transition
1. Caller invokes `executeTransition { resourceType, resourceId, transitionId }`.
2. Persistence: resolve the binding by `(resourceType, resourceId)`. If none, 404.
3. Catalog: load the transition; it must belong to the same lifecycle and its `fromState` must
   equal the binding's `currentLifecycleStateId`.
4. Authorization: enforce `transition.allowedRoles` against the caller (`super_admin`/`admin`
   bypass; empty/absent `allowedRoles` = no restriction).
5. Branch:
   - **`requiresApproval = true`** → create a pending `LifecycleApprovalRequest`, emit an audit
     event `outcome: approval_requested`, return `status: approval_requested`. State is **not**
     mutated.
   - **Otherwise** → update `currentLifecycleStateId` to `toState`, emit audit
     `outcome: transitioned`, return `status: transitioned`.

### Decide an approval
1. Approver invokes `decideApproval { approvalRequestId, decision, notes }`.
2. Authorization: only `super_admin`/`admin`/`core_developer`.
3. Approval: load the pending request; reject if already decided.
4. Branch:
   - **`rejected`** → mark request rejected, emit audit `outcome: rejected`. State unchanged.
   - **`approved`** → persistence applies the transition (`currentLifecycleStateId := toState`),
     mark request approved, emit audit `outcome: approved`.

---

## 4. Resource Contract

Any platform resource can participate without the engine knowing how it is stored.

A managed resource must expose:
- `resourceType` — open string, sharing the value space of `LifecycleDefinition.targetType`.
- `resourceId` — stable identifier within the resource's own storage; opaque to the engine.
- `currentLifecycleStateId` — owned by the engine in `LifecycleBinding`, not by the resource.

The engine reads and writes only `currentLifecycleStateId` (in `LifecycleBinding`); it never
loads, queries, or mutates the resource's own table/document/blob. Adding a new resource type
requires no engine or schema change.

---

## 5. Permission Model

Two layers: frontend visibility (capability keys) and engine-level runtime enforcement.
**Backend RLS remains the real security boundary** (deferred — see §9).

Frontend capability keys: `platform.lifecycle.read`, `platform.lifecycle.manage`.

| Role | Definition management | Execution |
|---|---|---|
| Developer | read | runtime calls (subject to `allowedRoles`) |
| Solution Architect | read | runtime calls (subject to `allowedRoles`) |
| Core Developer | full | decide approvals |
| Admin | full | decide approvals |
| Super Admin | full | full |

Runtime enforcement:
- `getLifecycleState` — open to any authenticated member.
- `executeTransition` — gated by the transition's `allowedRoles`; `super_admin`/`admin` bypass;
  empty/absent `allowedRoles` = no restriction.
- `decideApproval` — restricted to `super_admin`/`admin`/`core_developer`.

---

## 6. Approval Flow

```
executeTransition (requiresApproval=true)
        │
        ▼
LifecycleApprovalRequest { status: pending }
        │
        ▼
decideApproval
   ├── approved  → persistence applies transition → audit: approved
   └── rejected  → state unchanged                  → audit: rejected
```

Principle: **approval is non-mutating until decided.** A `requiresApproval` transition creates
a pending request and leaves `currentLifecycleStateId` untouched until an approver decides.
The approval service is a separate entity/function from execution.

---

## 7. Audit Flow

Every runtime action writes exactly one `LifecycleExecutionEvent`. The audit service is
**append-only** — the runtime only creates events, never updates or deletes them.

| Action | `outcome` |
|---|---|
| Attach a resource | `attached` |
| Apply a transition | `transitioned` |
| Request approval | `approval_requested` |
| Approve a request | `approved` |
| Reject a request | `rejected` |
| Detach (reserved) | `detached` |
| Failure (reserved) | `failed` |

Each event denormalizes `resourceType`, `resourceId`, and `lifecycleId` from the binding for
queryability without joins. Every action's response `status` equals its audit `outcome` —
response and audit share one vocabulary.

---

## 8. Known Limitations

- **Backend RLS not enforced.** The permission model is frontend visibility + engine-level
  `allowedRoles`/approver checks. Real row-level security is deferred to the backend
  authorization layer.
- **Engine-level `allowedRoles` only.** It checks platform roles; it does not yet resolve
  organization-scoped membership or `OrganizationMember` roles.
- **No binding UI.** Management surfaces exist for definitions/states/transitions/viewer, but
  there is no UI for bindings, approval queues, or the audit timeline yet.
- **No resource-type validation on attach.** The engine does not currently reject a binding
  whose `resourceType` differs from the definition's `targetType` (they share a value space
  by contract, not by runtime check).
- **No detachment / reattachment.** A resource cannot yet be detached from a lifecycle or moved
  to another lifecycle definition. The `detached` audit outcome is reserved.
- **Denormalization drift.** `lifecycleId`/`resourceType`/`resourceId` on approval/audit
  entities are copied from the binding at write time and are not kept in sync if the binding
  later changes.

---

## 9. Deferred Features

- Backend RLS enforcement (the real security boundary).
- Organization-scoped role resolution for `allowedRoles` and approvers.
- Resource-binding management UI (bindings, approval queues, audit timeline).
- Workflow integration — exposing `executeTransition`/`decideApproval` as triggerable PGP Core
  workflow activities.
- Detachment / reattachment of resources across lifecycle definitions.
- Optional runtime validation that `resourceType` matches `targetType` on attach.
- Event Bus publication of lifecycle events (Event Bus is reserved, not runtime in Phase 2).

---

## 10. Reference-Implementation Principles

Future platform services should follow the principles proven here:

1. **Storage independence** — operate on a small abstraction triple, never on the resource's
   own storage.
2. **Service separation** — persistence, approval, audit, and execution are distinct services
   with distinct entities.
3. **Open-typed extensibility** — use open strings (not enums) for resource kinds so new types
   need no schema change.
4. **Definition vs execution split** — model structure separately from running it.
5. **One reference vocabulary** — consistent field names across catalog and runtime.
6. **Audit is append-only** — one vocabulary shared between response and audit.
7. **No business logic in the engine** — workflows consume the engine; they are not part of it.

This snapshot is the canonical reference. Treat any future change to these entities, functions,
or flows as requiring an explicit architectural justification.