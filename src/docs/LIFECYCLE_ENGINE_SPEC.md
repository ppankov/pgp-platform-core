# Lifecycle Engine — Platform Specification (Phase 2, Service 1)

## Purpose

The Lifecycle Engine is the **first platform-wide service** of PGP Core. It provides one
reusable lifecycle system that can be attached to **any** platform object — Applications,
Plugins, Connectors, Services, AI Providers, Documents, Templates, Workflows, and future
resources — without the engine ever knowing what kind of object it is operating on.

It is **structure + execution** in Phase 2: it defines *what* a lifecycle, state, and
transition *are*, *who* may move between states, and it applies those transitions to concrete
resources — while remaining completely independent of how those resources are stored.

## Architecture Rules

1. **Generic by design.** The engine never references `Application`, `Plugin`, `Connector`,
   or any concrete resource. The only link to a resource kind is the open string `targetType`
   on `LifecycleDefinition` (and the matching `resourceType` on `LifecycleBinding` — the two
   share the same value space).
2. **`targetType` / `resourceType` are open strings, never enums.** Adding a new resource
   type requires **no schema change**.
3. **Storage independence.** Every managed resource is addressed only by the abstraction
   triple `resourceType`, `resourceId`, `currentLifecycleStateId`. The engine never loads,
   queries, or mutates the resource's own storage.
4. **No business logic in the engine.** No review/approval/publication/deprecation behavior
   is hard-coded. These are workflows that *consume* the engine; they are not part of it.
5. **Separation of definition from execution.** Defining a lifecycle is a modeling activity;
   executing it against a concrete resource instance is a runtime activity.
6. **Service separation.** Execution, approval, audit, and persistence are distinct platform
   services, each with its own entity. The runtime orchestrates them but never merges them.

## Data Model

### LifecycleDefinition
- `name` (required), `description`, `targetType` (open string, required), `active` (default `true`)

### LifecycleState
- `lifecycleId` (required), `key` (required), `title` (required), `description`, `color`,
  `icon`, `order` (required), `isInitial`, `isFinal`

### LifecycleTransition
- `lifecycleId` (required), `fromState` (required), `toState` (required), `allowedRoles`,
  `requiresApproval` (default `false`), `notes`

### LifecycleBinding (persistence service)
- `resourceType` (required), `resourceId` (required), `lifecycleId` (required),
  `currentLifecycleStateId` (required). Unique by `(resourceType, resourceId)`.
- `resourceType` shares the value space of `LifecycleDefinition.targetType`.

### LifecycleApprovalRequest (approval service)
- `bindingId`, `lifecycleId`, `transitionId`, `fromState`, `toState`,
  `status` (`pending`/`approved`/`rejected`), `requestedById`, `requestedDate`,
  `decidedById`, `decidedDate`, `notes`
- `lifecycleId` is denormalized from the binding for queryability without a join.

### LifecycleExecutionEvent (audit service — append-only)
- `bindingId`, `resourceType`, `resourceId`, `lifecycleId`, `transitionId`, `fromState`,
  `toState`, `outcome`, `actorId`, `metadata`
- `lifecycleId`/`resourceType`/`resourceId` are denormalized from the binding for audit
  queryability without joins.

> **Reference naming.** All references to a lifecycle definition use the field `lifecycleId`
> across the catalog (State, Transition) and the runtime (Binding, ApprovalRequest,
> ExecutionEvent) for consistency.

## Permissions

Frontend capability keys: `platform.lifecycle.read`, `platform.lifecycle.manage`.

| Role | Definition management | Execution |
|---|---|---|
| Developer | read | runtime calls (subject to `allowedRoles`) |
| Solution Architect | read | runtime calls (subject to `allowedRoles`) |
| Core Developer | full | decide approvals |
| Admin | full | decide approvals |
| Super Admin | full | full |

Runtime enforcement (engine-level; backend RLS remains the real security boundary):

- **`getLifecycleState`** — open to any authenticated member (a resource's current state is
  readable platform-wide).
- **`executeTransition`** — gated by the transition's `allowedRoles`; `super_admin` and
  `admin` bypass `allowedRoles`. An **empty or absent `allowedRoles`** means no role
  restriction (any authenticated member may execute the transition).
- **`decideApproval`** — restricted to approver roles `super_admin`, `admin`,
  `core_developer`.

## Management Surfaces

- **Lifecycle Definitions** — `/lifecycle/definitions`
- **Lifecycle States** — `/lifecycle/states`
- **Lifecycle Transitions** — `/lifecycle/transitions`
- **Lifecycle Viewer** — `/lifecycle/viewer`
- **Dashboard widget** — live counts of definitions / states / transitions.

## Execution Runtime (Phase 2 — implemented)

The execution runtime applies lifecycles to concrete resources. It is **strictly independent
of resource storage**: every resource is addressed only by the abstraction triple
`resourceType`, `resourceId`, `currentLifecycleStateId`. The runtime never loads, queries, or
mutates the resource's own table/document/blob.

### Service separation

| Service | Entity | Responsibility |
|---|---|---|
| Persistence | `LifecycleBinding` | Stores the abstraction triple. The only state the engine mutates. |
| Approval | `LifecycleApprovalRequest` | Pending requests for transitions that require approval. |
| Audit | `LifecycleExecutionEvent` | Append-only record of every runtime action. |
| Execution | (functions) | `attachLifecycle`, `getLifecycleState`, `executeTransition`, `decideApproval` — orchestrate the above. |

### Functions

- **`attachLifecycle`** `{ resourceType, resourceId, lifecycleId }` → creates a
  `LifecycleBinding` at the lifecycle's initial state. Enforces one lifecycle per resource.
- **`getLifecycleState`** `{ resourceType, resourceId }` → returns the binding, current
  state, and transitions available from it. Read-only.
- **`executeTransition`** `{ resourceType, resourceId, transitionId }` → validates the
  transition (same lifecycle, starts from current state), enforces `allowedRoles` against the
  caller, then either (a) creates an approval request when `requiresApproval` is set, or
  (b) applies the transition by updating `currentLifecycleStateId`. Emits an audit event.
- **`decideApproval`** `{ approvalRequestId, decision, notes }` → approver-only entry point
  of the approval service. On approval, persistence applies the transition; on rejection,
  state is unchanged. Emits an audit event either way.

### Response status

Every action's response `status` matches the `LifecycleExecutionEvent.outcome` recorded for
the same action, so response and audit share one vocabulary:

| Function | `status` |
|---|---|
| `attachLifecycle` | `attached` |
| `executeTransition` | `transitioned` \| `approval_requested` |
| `decideApproval` | `approved` \| `rejected` |
| `getLifecycleState` | (query) `attached: true` / `false` |

### Engine rules

1. **Storage independence.** The runtime references resources only by
   `(resourceType, resourceId)` and never touches resource storage.
2. **One lifecycle per resource.** A binding is unique by `(resourceType, resourceId)`.
3. **State advances only through defined transitions.** A transition is valid only if its
   `fromState` equals the binding's `currentLifecycleStateId` and it belongs to the same
   lifecycle definition.
4. **Authorization is two-layered.** `allowedRoles` is enforced by the engine at runtime;
   backend RLS remains the real security boundary.
5. **Approval is non-mutating until decided.** A `requiresApproval` transition creates a
   pending request and leaves `currentLifecycleStateId` untouched until an approver decides.
6. **Audit is append-only.** Every action writes exactly one `LifecycleExecutionEvent`;
   nothing updates or deletes them.

### Resource contract

To participate, a resource type need only be addressable by a stable `resourceId` and let
the runtime own `currentLifecycleStateId` in `LifecycleBinding`. The resource's `resourceType`
must match the `targetType` of the lifecycle definition it binds to (shared value space). The
resource's own storage is never modified by the engine.

## Future Compatibility

The engine schema supports the following future workflows **without architectural change**,
because they are modeled as states + transitions + flags, not as engine code:

- Review workflow
- Approval workflow (via `requiresApproval`, resolved by `decideApproval`)
- Publication workflow
- Deprecation workflow
- Custom customer workflows

Each future workflow is a different *lifecycle definition* (with its own states and
transitions), not a change to the engine.

## Architecture Decisions

1. **`targetType` as open string, not enum.** Future-proofing over validation: the engine must
   support resources that do not exist yet.
2. **State references by id in transitions.** Referential integrity across renames.
3. **`requiresApproval` is a flag, not an approval engine.** Declares intent now; the approval
   service (`LifecycleApprovalRequest` + `decideApproval`) fulfills it, kept separate.
4. **Storage independence via `LifecycleBinding`.** The engine owns only
   `currentLifecycleStateId`; the resource's storage model is irrelevant to it. This lets the
   same engine drive applications, plugins, connectors, documents, templates, and workflows.
5. **Engine is platform-level, not application-level.** Lifecycles are a cross-cutting
   platform capability, so they live in Core as a service.
6. **One reference name.** `lifecycleId` is used everywhere a lifecycle definition is
   referenced, across catalog and runtime, to avoid a split vocabulary.

## Phase 2 Dependencies (Unresolved)

- **Backend RLS enforcement** — the role matrix above is frontend visibility + engine-level
  `allowedRoles` checks until the backend authorization layer is implemented.
- **Resource binding UI** — management pages for bindings, approval queues, and the audit
  timeline are the next surface (not part of the execution layer itself).
- **Workflow integration** — exposing `executeTransition`/`decideApproval` to PGP Core
  workflows as triggerable activities.
- **Detachment / reattachment** — detaching a resource from a lifecycle or moving it to a new
  lifecycle definition (engine rule + audit outcome already reserved: `detached`).