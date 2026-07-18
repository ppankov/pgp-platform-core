# PGP Core — Phase 7 Architecture Snapshot

**STATUS: FROZEN — Platform Reference Implementation**

> Stable platform reference implementation for declarative,
> manually-progressed workflows.

**Snapshot date:** 2026-07-18 (UTC)

---

## 1. Scope and Frozen Status

Phase 7 delivers the PGP Core **Workflow Engine** as a stable, declarative
reference implementation for workflows that are **manually progressed** by an
operator. The engine stores and validates workflow graphs and executes a
controlled runtime that advances an instance through graph nodes under explicit
human action.

Phase 7 is **frozen**. It is intentionally scoped and must not be described as a
complete production-ready workflow automation system. It is a **reference**:
declarative graphs, manual progression, no automatic decisions, no code
execution, no scheduling, no background workers.

This snapshot records the implementation exactly as built. No entities,
functions, permissions, pages, or behavior are modified by this document.

---

## 2. Reused and Normalized Structures

Phase 7 reuses established PGP Core architectural patterns:

- **Definition / Version / Instance separation** — normalized in Phase 5
  (Plugin Engine) and Phase 6 (Connector Engine); Phase 7 follows the same
  three-tier identity/version/execution model.
- **Platform-global versus organization-scoped identity** — the same scope model
  used by the Lifecycle Engine (Phase 2) and Plugin Engine (Phase 5).
- **Event Bus as loose-coupling transport** — the Event Bus (Phase 3) and
  Delivery Runtime (Phase 4) are reused without modification for best-effort
  publication of workflow lifecycle events.
- **Role-based capability matrix** — the platform permission model
  (`src/lib/permissions.js`) is extended with workflow capabilities under the
  existing role tier model.
- **Service role for runtime functions** — all workflow backend functions operate
  under the platform service role, consistent with the Lifecycle, Event,
  Plugin, and Connector engines.

Phase 7 introduces **no** changes to the Lifecycle Engine, Event Bus,
Delivery Runtime, Plugin Engine, or Connector Engine.

---

## 3. Five-Layer Architecture

The Workflow Engine is composed of five entities, each with a single, distinct
responsibility:

1. **WorkflowDefinition** — workflow identity in the catalog.
2. **WorkflowVersion** — a versioned, declarative workflow graph.
3. **WorkflowInstance** — one execution of a released version.
4. **WorkflowStepRun** — a per-node execution record within an instance.
5. **WorkflowExecutionEvent** — immutable append-only audit record.

The layers are strictly separated: identity, versioning, execution, per-node
execution state, and audit never share storage responsibility.

---

## 4. Definition / Version / Instance / StepRun / Audit Separation

- A **Definition** holds identity (key, name, scope, active flag) and a pointer
  to its current released version. It contains no graph and no execution state.
- A **Version** holds the declarative graph and a release status. A version is
  created as draft and becomes immutable once released. It contains no execution
  state.
- An **Instance** holds the execution state of a single run against a released
  version. It references a definition and a version, but never mutates either.
- A **StepRun** holds the per-node execution state within an instance. It is the
  only node-level runtime state.
- An **ExecutionEvent** is the audit trail. The runtime only creates events; it
  never updates or deletes them. Audit is separate from execution, versioning,
  and identity.

---

## 5. Exact Entity Responsibilities and Fields

### WorkflowDefinition
- `key` — stable unique machine identifier within scope; immutable after creation.
- `name` — human-readable display name.
- `description` — optional prose.
- `scope` — `platform` (organizationId null) or `organization` (organizationId required).
- `organizationId` — null for platform scope; required for organization scope.
- `active` — whether new instances may be started from this definition.
- `currentVersionId` — reference to the current released WorkflowVersion.

### WorkflowVersion
- `workflowDefinitionId` — reference to WorkflowDefinition.
- `version` — semantic version string; unique per definition.
- `graph` — declarative JSON (`nodes` + `edges`); never executable.
- `releaseStatus` — `draft` | `released` | `deprecated`.
- `checksum` — metadata-only integrity marker (no package download in Phase 7).
- `createdAt`, `releasedAt` — timestamps.

### WorkflowInstance
- `workflowDefinitionId`, `workflowVersionId` — references to definition and
  released version.
- `organizationId` — tenant boundary.
- `resourceType`, `resourceId` — optional opaque resource binding.
- `status` — execution status (see §10).
- `currentNodeKey` — the node the instance is currently at.
- `input`, `output` — transport data (redacted on read if secret-looking).
- `correlationId` — opaque, propagated unchanged to audit events.
- `startedById`, `startedAt`, `completedAt`, `failedAt`, `cancelledAt`,
  `lastError` — execution lifecycle fields.

### WorkflowStepRun
- `workflowInstanceId` — reference to WorkflowInstance.
- `nodeKey` — the graph node this run executes.
- `nodeType` — `start` | `manual` | `end`.
- `status` — step execution status (see §11).
- `attemptCount` — number of processing attempts.
- `input`, `output` — transport data (redacted on read if secret-looking).
- `startedAt`, `completedAt`, `failedAt`, `lastError` — step lifecycle fields.

### WorkflowExecutionEvent
- `workflowInstanceId`, `workflowDefinitionId`, `workflowVersionId`,
  `organizationId` — denormalized for audit queryability.
- `eventType` — e.g. `workflow.instance_started`.
- `nodeKey` — node the event concerns, when applicable.
- `actorId`, `correlationId` — actor and propagated correlation.
- `metadata` — safe identifiers/status values only; never input/output,
  credentials, secrets, or stack traces.
- `createdAt` — event timestamp.

---

## 6. Platform Versus Organization Workflow Scope

- **Platform scope** (`scope: "platform"`, `organizationId: null`): global
  workflow definitions shared across the platform. Managed by Core Developer
  and Super Admin. Instances require an explicit `organizationId` at start.
- **Organization scope** (`scope: "organization"`, `organizationId` required):
  tenant-specific workflow definitions. Managed by Admin and Super Admin.
  Instances inherit the definition's organization.

`key` is unique per platform scope, or per `(organization, key)` for
organization scope. Scope is set at definition registration and is immutable.

---

## 7. Backend Function List

All workflow functions operate under the platform service role. Function-level
scope, role, and organization checks are mandatory.

- `registerWorkflowDefinition` — create a platform- or organization-scoped
  definition (identity only; no graph).
- `registerWorkflowVersion` — create a draft version with a declarative graph;
  graph validation is enforced here.
- `releaseWorkflowVersion` — transition a draft version to released; rejects
  non-draft versions.
- `startWorkflow` — start an instance of a released version; creates the start
  node StepRun and progresses to the next node.
- `getWorkflowInstance` — read an instance with its step runs and audit events;
  redacts secret-looking input/output.
- `completeWorkflowStep` — progress the current waiting manual node.
- `failWorkflowStep` — fail the current step and the instance.
- `cancelWorkflowInstance` — cancel the instance.
- `listWorkflows` — list definitions and versions visible to the caller.

No `updateWorkflowVersion` function exists. No function updates or deletes
`WorkflowExecutionEvent`.

---

## 8. Workflow Graph Contract

A version's `graph` is declarative JSON:

```
{
  "nodes": [ { "key": "...", "type": "...", "title": "...", "description": "...", "configuration": {} } ],
  "edges": [ { "from": "...", "to": "...", "label": "..." } ]
}
```

Validation rules enforced at registration (`registerWorkflowVersion`) and
re-validated at release (`releaseWorkflowVersion`):

- **nodes**: must be a non-empty array.
- **edges**: must be an array; each edge references existing node keys.
- **exactly one start node**: precisely one node of `type: "start"`.
- **at least one end node**: one or more nodes of `type: "end"`.
- **unique node keys**: no duplicate `key` values across nodes.
- **valid edge references**: every `edge.from` and `edge.to` must match an
  existing node key.
- **reachability**: every node must be reachable from the start node.
- **no cycles**: the graph must not contain cycles.
- **no duplicate edges**: no repeated `(from, to)` pair.

Supported Phase 7 node types:

- `start`
- `manual`
- `end`

Any other node type is rejected with `unsupported node type: <type>`.

**Executable-looking values are rejected.** Any node `configuration` value (or
nested value) matching executable patterns (e.g. `function`, `() =>`, `=>`, or
strings containing `function(){...}`) is rejected with
`graph contains executable-looking values`. The engine stores and validates
declarative structure only; it never interprets or executes node configuration.

---

## 9. Runtime Progression Semantics

- **start node** — processed internally. On `startWorkflow`, the runtime creates
  a `completed` StepRun for the start node and advances to the next node. The
  start node never enters a `waiting` state.
- **end node** — processed internally. When the runtime reaches an end node, it
  creates a `completed` StepRun for it and marks the instance `completed`. The
  end node never enters a `waiting` state.
- **manual node** — enters `waiting`. The instance is set to `waiting` and the
  StepRun is created with `status: "waiting"`. Progression requires an explicit
  operator action via `completeWorkflowStep`.
- **multiple branches require explicit `nextNodeKey`**. When the current node
  has more than one outgoing edge, the caller must supply a `nextNodeKey`
  identifying the chosen branch. If `nextNodeKey` is omitted when multiple edges
  exist, the function rejects with
  `nextNodeKey is required (multiple outgoing edges)`.
- **the runtime never guesses a branch.** No automatic branch selection occurs.
- **the runtime never executes arbitrary node logic.** Node `configuration` is
  declarative metadata only; no handlers, expressions, or actions are invoked.

When the current node has exactly one outgoing edge, `nextNodeKey` may be
omitted and the runtime follows the single edge.

---

## 10. WorkflowInstance Status Model

- `pending` — created but not yet started (transient in Phase 7).
- `running` — actively executing between nodes (transient; the runtime
  normally lands in `waiting` or a terminal state).
- `waiting` — paused at a manual node awaiting explicit progression.
- `completed` — reached an end node; terminal.
- `failed` — failed by `failWorkflowStep` or a runtime error; terminal.
- `cancelled` — cancelled by `cancelWorkflowInstance`; terminal.

Terminal states (`completed`, `failed`, `cancelled`) are final for that
instance; the runtime does not resume a terminal instance.

---

## 11. WorkflowStepRun Status Model

- `pending` — created but not yet processing.
- `running` — actively processing (transient).
- `waiting` — paused at a manual node.
- `completed` — finished successfully; historical.
- `failed` — failed; historical.
- `skipped` — reserved; not produced by the Phase 7 runtime.

One active (`waiting`/`running`) StepRun exists per instance + node visit.
Completed/failed StepRuns are historical and never deleted by runtime
operations.

---

## 12. Current-Step Enforcement

`completeWorkflowStep` enforces a strict current-step contract:

- **`completeWorkflowStep` accepts no arbitrary `nodeKey` to select a StepRun.**
  The function's parameters do not include a `nodeKey` selector.
- **It operates only on `instance.currentNodeKey`.** The function reads the
  instance, takes its `currentNodeKey`, and resolves the StepRun for that node
  only.
- **It resolves only the waiting StepRun for that current node.** The StepRun is
  filtered by `workflowInstanceId` and `nodeKey === instance.currentNodeKey`
  with `status: "waiting"`. If no such waiting StepRun exists, the function
  rejects with `No waiting step to complete (instance is not waiting)`.
- **A historical or non-current step cannot be targeted by the function.** A
  completed/failed StepRun for a previously visited node, or a StepRun for a
  node that is not the current node, is structurally unreachable by this
  function. There is no API surface to target it.

This design makes re-processing of historical steps impossible through the
workflow function layer.

---

## 13. Idempotency Behavior

- **Repeated completion on terminal instances**: calling `completeWorkflowStep`
  on an instance already `completed` returns `already_completed` without
  reprocessing any step. Calling on an instance already `failed` returns
  `already_failed`; on an instance already `cancelled` returns
  `already_cancelled`.
- **Repeated cancellation**: calling `cancelWorkflowInstance` on an already
  `cancelled` instance returns `already_cancelled` without side effects.
  Cancelling a `completed` or `failed` instance is rejected with a `400`
  (`Cannot cancel a completed/failed instance`).
- **Fail behavior**: calling `failWorkflowStep` on an instance already `failed`
  returns `already_failed`; on a `completed` or `cancelled` instance it is
  rejected. A successful fail marks the current StepRun `failed`, the instance
  `failed`, records `lastError`, and emits the failure audit + event.
- **Cancellation restrictions**: cancellation is only permitted from a non-
  terminal state (`pending`, `running`, `waiting`). Terminal states reject
  cancellation.

---

## 14. CorrelationId Preservation

`startWorkflow` accepts an optional `correlationId`. The value is stored on the
instance and **propagated unchanged** to every `WorkflowExecutionEvent` created
for that instance. The runtime never modifies, regenerates, or drops a supplied
correlation id. When none is supplied, the field remains null and is
propagated as null. Correlation ids are opaque to the engine.

---

## 15. Opaque Resource Binding

An instance may carry an optional opaque resource binding:

- `resourceType` — open string identifying the kind of bound resource.
- `resourceId` — stable identifier of the bound resource within its own
  storage.

**The runtime never mutates the bound resource.** `resourceType` and
`resourceId` are opaque binding values carried through the instance and
denormalized onto audit events for queryability only. The Workflow Engine makes
no assumption about how or where the referenced resource is stored, and it
issues no read or write against it.

---

## 16. WorkflowExecutionEvent Audit Contract

- **Append-only through runtime functions.** Every workflow runtime function
  writes audit records exclusively via a shared create-only `audit()` helper
  that calls `WorkflowExecutionEvent.create(...)`. No workflow function calls
  `update` or `delete` on `WorkflowExecutionEvent`.
- **Safe metadata only.** `metadata` contains safe identifiers and status
  values only — definition id, version id, instance id, organization id, node
  key, from/to state, status, outcome. It never contains workflow `input` or
  `output` content, node `configuration`, credentials, secrets, tokens, or
  stack traces.
- **Ordered execution timeline.** Events are created in execution order and
  ordered by `createdAt` for timeline rendering.
- **No input/output or secrets in audit metadata.** This is enforced by the
  shape of the metadata object the helper constructs; transport data is never
  copied into audit metadata.

Runtime verification produced the expected ordered event sequence for a
completed instance: `instance_started` → `step_waiting` → `step_completed` →
`instance_completed`.

---

## EXACT IMMUTABILITY ENFORCEMENT BOUNDARY

WorkflowVersion immutability is enforced at the **function** and **management
UI** layers:

- `releaseWorkflowVersion` rejects non-draft versions with
  `Only draft versions can be released; released versions are immutable`.
- No backend function updates released version content (`graph`, `checksum`,
  `version`, or `workflowDefinitionId`). The only field `releaseWorkflowVersion`
  mutates on a released version is `releaseStatus` (→ `released`) and
  `releasedAt`.
- No `updateWorkflowVersion` function exists.
- Management UI exposes no edit action for released versions.
  `WorkflowDefinitionDetailPage` renders versions read-only; the only per-
  version action is "Release", shown only for `releaseStatus === "draft"`.
- Released versions are displayed read-only.

Phase 7 does **not** enforce conditional released-version immutability at the
datastore level:

- The entity schema has no `releaseStatus`-dependent update prohibition.
- Direct SDK mutation remains subject to the platform's default RLS.
- A role allowed by that default entity access could theoretically bypass the
  function layer and mutate a released version directly.
- This is a documented limitation, deferred to the future Security/RLS
  hardening phase.

Phase 7 does **not** claim datastore-level immutability.

---

## EXACT APPEND-ONLY ENFORCEMENT BOUNDARY

WorkflowExecutionEvent append-only behavior is enforced at the **function**
and **management UI** layers:

- Runtime functions use a create-only audit helper.
- No workflow function updates or deletes `WorkflowExecutionEvent`.
- The UI renders the audit timeline read-only (no edit/delete affordance).
- Runtime verification produced the expected ordered event sequence.

Phase 7 does **not** encode a datastore-level update/delete prohibition:

- The entity schema has no rule blocking `update` or `delete` on
  `WorkflowExecutionEvent`.
- Ordinary direct entity access remains governed by platform default RLS.
- A role permitted by default entity access could theoretically mutate or
  delete audit records through direct SDK access.
- This is a documented limitation, deferred to Security/RLS hardening.

Phase 7 does **not** claim datastore-enforced append-only guarantees.

---

## EVENT BUS INTEGRATION

The Workflow Engine publishes lifecycle events to the platform Event Bus on a
**best-effort** basis. The Event Bus (Phase 3) and Delivery Runtime (Phase 4)
are reused without modification.

Workflow event types:

- `workflow.definition_registered`
- `workflow.version_registered`
- `workflow.version_released`
- `workflow.instance_started`
- `workflow.step_completed`
- `workflow.step_failed`
- `workflow.instance_completed`
- `workflow.instance_failed`
- `workflow.instance_cancelled`

Event properties:

- `sourceType = "workflow"` for all workflow events.
- `sourceId` = the id of the primary subject (definition id, version id, or
  instance id depending on event type).
- **Safe identifier-only payloads**: payloads contain only identifiers and
  status values (definition id, version id, instance id, organization id, node
  key, status).
- **No input/output** in payloads.
- **No graph or node configuration** in payloads.
- **No credentials, secrets, or stack traces** in payloads.
- **Best-effort publication**: publication failure does not block the primary
  operation; the engine continues on event-publish errors.
- **Zero-subscriber independence**: events are published regardless of whether
  any `EventSubscription` exists. With zero subscribers, no `EventDelivery` is
  created.
- **No EventDelivery dispatch or processing by the Workflow Engine**: the
  Workflow Engine only publishes. Dispatch and processing are the
  responsibility of the Event Bus and Delivery Runtime (Phases 3–4). The Workflow
  Engine never calls `dispatchEvent` or `processEventDelivery`.

---

## LIFECYCLE COMPATIBILITY

The Lifecycle Engine (Phase 2) is unchanged by Phase 7.

Reserved `resourceType` values for workflow resources:

- `workflow_definition`
- `workflow_version`
- `workflow_instance`

These reserved values may be used as opaque `resourceType` bindings when a
lifecycle is attached to a workflow resource. Phase 7 states:

- **No Lifecycle Engine modification.** Phase 7 does not alter lifecycle
  definitions, states, transitions, bindings, or runtime functions.
- **No automatic lifecycle definitions.** Phase 7 creates no lifecycle
  definitions for workflow resources automatically.
- **No automatic lifecycle bindings.** Phase 7 creates no `LifecycleBinding`
  records automatically. Any binding is created explicitly via `attachLifecycle`
  by an authorized role.
- **Workflow resource binding remains opaque.** When a workflow instance binds
  a `resourceType`/`resourceId`, the Workflow Engine treats it as opaque and
  never interprets it as a lifecycle reference.
- **The Workflow Engine does not mutate external platform resources.** It does
  not touch lifecycle bindings, plugin installations, connector connections, or
  any other entity outside its five workflow entities.

---

## PERMISSION MODEL

Workflow capabilities follow the platform role tier model.

**Developer**
- Read-only access to workflow definitions, versions, and instances.

**Solution Architect**
- Read-only access.
- May inspect graph structure (view the declarative graph JSON).

**Core Developer**
- Manage platform-scoped workflow definitions and versions.
- Release platform workflow versions.
- Cannot mutate organization-scoped workflows under the frozen model
  (organization-scope create/version/release requires Admin or Super Admin).

**Admin**
- Manage organization-scoped definitions and versions.
- Release organization workflow versions.
- Start, complete, fail, and cancel organization instances.
- Cannot manage platform-scoped workflows (platform-scope create/version is
  rejected with `Not permitted to manage platform workflow definitions`).

**Super Admin**
- Full access to all workflow capabilities across both scopes.

**Verification method distinction:**
- Admin permission paths were **runtime-verified** (register org definition →
  200, register version → 200, release → 200, start/complete/fail/cancel → 200;
  platform-scope definition → 403).
- Core Developer, Super Admin, Developer, and Solution Architect role gates
  were **verified by code inspection** because the authenticated session role
  could not be switched during the session (role is a platform built-in, not
  overridable in-session).

Backend functions operate under the **service role**. Function-level scope,
role, and organization checks are mandatory and enforced inside each function
before any state mutation. Direct frontend entity access remains subject to
backend/default RLS; the function layer is the authoritative enforcement point
for workflow operations.

---

## UI AND PLATFORM INTEGRATION

- **Workflow Catalog** (`/workflows`) — lists definitions with scope, version
  count, current version, and active badge; "New Definition" action gated by
  manage capability.
- **Workflow Definition Detail** (`/workflows/:definitionId`) — definition
  metadata, scope, active state, and a read-only versions table; "New Version"
  gated by manage; "Release" shown only for draft versions and manage role;
  "Start Instance" gated by the connect/start capability, with an organization
  input for platform-scoped definitions.
- **Workflow Versions** — rendered as a table within the definition detail page;
  version, release status badge, released timestamp, and the release action.
  No edit affordance for released versions.
- **Workflow Instance List** (`/workflows/instances`) — organization-scoped
  executions with status filtering.
- **Workflow Instance Detail** (`/workflows/instances/:instanceId`) — instance
  status, current node, correlation id, resource binding, started/completed
  timestamps, version reference, step runs, and a read-only execution timeline;
  Progress/Fail/Cancel actions gated by the progress capability and current
  status.
- **Structured JSON graph editor** — `WorkflowVersionForm` provides a textarea
  with a default valid graph (start → manual → end), client-side JSON parse
  feedback, and surfaces server validation errors via toast.
- **Validation feedback** — graph validation is server-side; client parse
  errors are shown inline and server rejections are shown as destructive
  toasts.
- **Read-only execution timeline** — audit events rendered as an ordered list
  with no edit/delete controls.
- **Dashboard counters** — `WorkflowEngineWidget` shows five real-data counters
  via user-context SDK (RLS-scoped): definitions, released versions, running
  instances, waiting steps, failed instances.
- **Navigation** — `WORKFLOW_ROLES = [super_admin, admin, core_developer,
  developer, solution_architect]` for read visibility; entries under the
  `workflow` nav group (`/workflows`, `/workflows/instances`).
- **Routing** — `/workflows`, `/workflows/instances`, `/workflows/instances/:instanceId`,
  `/workflows/:definitionId` all registered in `App.jsx` and wrapped in
  `RoleRoute`.
- **Entity registry** — workflow entities registered in `src/lib/entity-registry.js`
  under the workflow engine category.
- **RoleRoute integration** — every workflow route is guarded by `RoleRoute`.
- **EN/BG/DE/ES i18n completeness** — all four locale files contain a full,
  structurally-identical `workflow` block with parity keys (engine, catalog,
  instances, versions, all status labels, release statuses, scope labels, five
  dashboard counters, all `field.*` keys, action labels, graph help, widget
  strings). No missing keys in any locale.

**Bulgarian terminology:**

| English | Bulgarian |
|---|---|
| Workflow Engine | Система за работни процеси |
| Workflow Definition | Дефиниция на работен процес |
| Workflow Version | Версия на работен процес |
| Workflow Instance | Изпълнение на работен процес |
| Workflow Step | Стъпка на работен процес |

---

## VERIFICATION RECORD

This section consolidates the original Phase 7 verification and the final
stabilization coverage.

### Graph validation paths
- Missing definition key → 400 `key, name and scope are required`.
- Missing start node → 400 `graph must contain exactly one start node`.
- Multiple start nodes → 400 `graph must contain exactly one start node`.
- Graph with a cycle → 400 `graph must not contain cycles`.
- Unsupported node type (`automated`) → 400 `unsupported node type: automated`.
- Executable-looking value in node configuration → 400 `graph contains
  executable-looking values`.
- Duplicate edges, invalid edge references, unreachable nodes, duplicate node
  keys → rejected at registration.

### Scope validation paths
- Organization-scoped definition with null `organizationId` → rejected.
- Platform-scope definition created by Admin → 403 `Not permitted to manage
  platform workflow definitions`.
- Organization-scoped definition created by Admin → 200.

### Runtime progression paths
- `startWorkflow` on a released version → instance `waiting` at the first
  manual node; start StepRun created `completed`.
- `completeWorkflowStep` on a waiting manual node with a single outgoing edge →
  instance advances; on reaching an end node → instance `completed`, end StepRun
  created `completed`.
- `completeWorkflowStep` on an instance not waiting (synthetic `running`
  instance with no waiting StepRun) → 400 `No waiting step to complete (instance
  is not waiting)`.

### Branching paths
- Multiple outgoing edges without `nextNodeKey` → 400 `nextNodeKey is required
  (multiple outgoing edges)`.
- Multiple outgoing edges with explicit `nextNodeKey` → instance advances to
  the chosen branch.
- Single outgoing edge → `nextNodeKey` may be omitted.

### Idempotency paths
- `completeWorkflowStep` on a completed instance → `already_completed`.
- `completeWorkflowStep` on a failed instance → `already_failed`.
- `cancelWorkflowInstance` on a cancelled instance → `already_cancelled`.
- `cancelWorkflowInstance` on a completed/failed instance → 400 rejected.
- `failWorkflowStep` on a failed instance → `already_failed`.

### Current-step enforcement
- `completeWorkflowStep` accepts no `nodeKey` selector parameter.
- It resolves only the waiting StepRun for `instance.currentNodeKey`.
- Historical/non-current steps are structurally unreachable by the function.

### Fail and cancel paths
- `failWorkflowStep` with an error reason → current StepRun `failed`, instance
  `failed`, `lastError` set, `workflow.step_failed` + `workflow.instance_failed`
  events emitted.
- `cancelWorkflowInstance` → instance `cancelled`, `cancelledAt` set,
  `workflow.instance_cancelled` event emitted.

### CorrelationId preservation
- Supplied `correlationId` stored on the instance and propagated unchanged to
  every `WorkflowExecutionEvent` for that instance.

### Resource binding preservation
- `resourceType`/`resourceId` carried unchanged through the instance and
  denormalized onto audit events; the runtime issues no read/write against the
  bound resource.

### Event Bus payload safety
- Runtime-confirmed `workflow.instance_completed` payload = `{workflowDefinitionId,
  workflowVersionId, workflowInstanceId, organizationId, nodeKey, status}` only.
  No input/output, graph, configuration, credentials, or stack traces.

### Zero-subscriber publication
- With no `EventSubscription` matching workflow event types, publication
  succeeds and creates no `EventDelivery`. The Workflow Engine is independent of
  subscriber presence.

### Organization isolation
- `startWorkflow` rejects an organization id that does not match an
  organization-scoped definition's `organizationId`.

### Permission boundary results
- Admin: org create/version/release/start/complete/fail/cancel → 200;
  platform create → 403 (runtime-verified).
- Core Developer, Super Admin, Developer, Solution Architect → verified by
  code inspection of each function's role gate.

### Released-version enforcement boundary
- Re-release of a released version → 400 `Only draft versions can be released;
  released versions are immutable` (runtime-verified).
- No `updateWorkflowVersion` function exists; no function mutates released
  version content; UI exposes no edit action for released versions.
- Datastore-level conditional immutability is not enforced (documented
  limitation).

### Append-only audit enforcement boundary
- Runtime creates `WorkflowExecutionEvent` records only; no update/delete calls
  in any workflow function (code-inspection-verified).
- Completed instance produced exactly 4 ordered events: `instance_started`,
  `step_waiting`, `step_completed`, `instance_completed` (runtime-verified).
- Datastore-level update/delete prohibition is not enforced (documented
  limitation).

### Cleanup
Post-verification cleanup confirmed zero leftovers:

- workflow instances = 0
- workflow versions = 0
- workflow definitions = 0
- workflow step runs = 0
- workflow execution events = 0
- workflow PlatformEvents = 0
- EventDeliveries = 0

No temporary role widening occurred during final stabilization. The permission
configuration (`src/lib/permissions.js`) matches the Phase 7 contract with no
widening: Developer and Solution Architect are read-only; Core Developer has
manage + read (no connect); Admin has read + connect (no manage); Super Admin
has full access.

---

## KNOWN LIMITATIONS

- No datastore-level conditional immutability for released `WorkflowVersion`
  records (function/UI layer only).
- No datastore-level append-only rule for `WorkflowExecutionEvent` (function/UI
  layer only).
- No store-level uniqueness for concurrent identical operations (e.g. concurrent
  starts, concurrent step completions) — race protection is deferred.
- Cross-role runtime testing limited by a fixed authenticated session role;
  non-Admin role gates were verified by code inspection.
- No automatic decisions — branching requires explicit `nextNodeKey`.
- No expression evaluation — node `configuration` is declarative metadata only.
- No action registry — no actions are invoked by the runtime.
- No connector actions — the Connector Engine is not invoked by the Workflow
  Engine.
- No plugin execution — the Plugin Engine is not invoked by the Workflow
  Engine.
- No Event Bus-triggered workflow start — instances are started only by
  explicit `startWorkflow` calls.
- No scheduler — no time-based triggers.
- No background worker — progression is synchronous under operator action.
- No retries — failed steps are not automatically retried.
- No delayed waits — waiting is indefinite until explicit progression.
- No visual drag-and-drop builder — graphs are authored via structured JSON.

---

## DEFERRED SECURITY ITEMS

The following are explicitly deferred to the future **Security/RLS hardening
phase**:

- Datastore protection for released `WorkflowVersion` records (a
  `releaseStatus`-conditional update prohibition at the entity level).
- Datastore update/delete prohibition for `WorkflowExecutionEvent`
  (append-only at the entity level).
- Direct SDK mutation restrictions for workflow entities (beyond default RLS).
- Organization-level row isolation enforced at the datastore level for
  workflow entities.
- Store-level uniqueness and race protection for concurrent identical
  operations.
- Complete runtime verification with separate test identities per role (Admin,
  Core Developer, Super Admin, Developer, Solution Architect) rather than
  code-inspection-only verification for non-Admin roles.

---

## CROSS-PHASE INTEGRITY

Phase 7 introduces no changes to prior phases:

- **Phase 2 — Lifecycle Engine**: unchanged. No lifecycle definitions, states,
  transitions, bindings, or runtime functions modified. Workflow resources may
  be bound opaquely; no automatic lifecycle integration is created.
- **Phase 3 — Event Bus contract**: unchanged. The Workflow Engine publishes
  `workflow.*` events with safe identifier-only payloads and reuses the
  existing `publishEvent`/subscription contract.
- **Phase 4 — Delivery Runtime**: unchanged. The Workflow Engine does not
  dispatch or process deliveries; it only publishes. `dispatchEvent` and
  `processEventDelivery` are not invoked by workflow functions.
- **Phase 5 — Plugin Engine**: unchanged. The Workflow Engine does not invoke
  plugin execution; no plugin definitions, versions, or installations are
  modified.
- **Phase 6 — Connector Engine**: unchanged. The Workflow Engine does not
  invoke connector actions; no connector definitions, providers, or
  connections are modified.

---

## EXPLICIT FROZEN GUARANTEES

- Workflow graphs are declarative only.
- Phase 7 supports `start`, `manual`, and `end` nodes only.
- No arbitrary code is executed.
- No automatic branch decision occurs.
- Manual branching requires explicit `nextNodeKey`.
- The workflow runtime never mutates bound external resources.
- Event payloads contain no workflow input/output or secrets.
- Runtime audit is create-only through workflow functions.
- Released versions are immutable through workflow functions and UI.
- Datastore-level immutability and append-only protection are not claimed.
- Phase 7 is a stable reference for manually-progressed workflows only.

---

*End of Phase 7 Architecture Snapshot — STATUS: FROZEN.*