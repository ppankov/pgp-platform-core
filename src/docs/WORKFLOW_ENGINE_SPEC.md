# PGP Core — Workflow Engine Specification (Phase 7)

**Status:** Phase 7 — Stable platform reference implementation for declarative, manually-progressed workflows.

This document specifies the Workflow Engine exactly as implemented in Phase 7. Phase 7 provides a real execution runtime, but only for safe, declarative, and explicitly invoked workflow progression. It does **not** execute arbitrary code, evaluate expressions, make automatic decisions, call external APIs, run provider adapters, schedule waits, trigger on Event Bus events, run background workers, retry, or provide a visual drag-and-drop builder.

---

## 1. Definition / Version / Instance Separation

The Workflow Engine separates five concerns:

1. **WorkflowDefinition** — workflow identity in the catalog. Either platform-scoped or organization-scoped. Contains no executable code and is not a workflow instance.
2. **WorkflowVersion** — a versioned, declarative workflow graph. Created as draft; released versions become immutable. graph is declarative JSON only.
3. **WorkflowInstance** — one execution of a released version. Organization-scoped. Represents one run.
4. **WorkflowStepRun** — a per-node execution record within an instance. One active (waiting/running) step per instance + node visit.
5. **WorkflowExecutionEvent** — immutable append-only audit record for an instance.

A single definition can have many versions; a single released version can be executed by many instances; each instance is independent.

---

## 2. Graph Contract

A workflow `graph` is a declarative JSON object:

```
{
  "nodes": [ { "key": "...", "type": "...", "title": "...", "description": "...", "configuration": {} } ],
  "edges": [ { "from": "...", "to": "...", "label": "..." } ]
}
```

Each node has a stable `key`, a `type`, a `title`, a `description`, and a `configuration` object. Each edge has `from`, `to`, and an optional `label`.

The graph contains **no scripts, functions, expressions, or remote code**. A graph containing executable-looking values is rejected.

---

## 3. Supported Phase 7 Node Types

- `start` — the single entry node. Processed internally by the runtime.
- `manual` — a human/app gate. The runtime stops and waits; progression is explicit via `completeWorkflowStep`.
- `end` — a terminal node. Processed internally by the runtime.

Node `type` remains an open string for future compatibility, but the Phase 7 runtime rejects unsupported node types with 400.

---

## 4. Graph Validation

Validation is enforced identically at version registration and at release:

- `graph` must be an object with `nodes` and `edges` arrays.
- At least one node.
- Node `key` is required and unique.
- Node `type` is required and must be a supported type.
- Exactly one `start` node.
- At least one `end` node.
- Every edge `from`/`to` must reference existing nodes.
- No duplicate edges.
- The `start` node cannot have incoming edges.
- `end` nodes cannot have outgoing edges.
- Every non-end node must have at least one outgoing edge.
- All nodes must be reachable from start.
- No cycles (Phase 7 is acyclic only).
- The graph must contain no executable-looking values.

Multiple outgoing edges are allowed (branching). For a manual node with multiple outgoing edges, the caller must provide `nextNodeKey` explicitly at progression.

---

## 5. Immutable Released Versions

- Versions are created as `draft`.
- `releaseWorkflowVersion` revalidates the complete graph, marks the version `released`, sets `releasedAt`, and updates the definition's `currentVersionId`.
- Released versions are immutable: `releaseWorkflowVersion` rejects a non-draft version with 400. No update function mutates a released version's graph.
- `deprecated` is reserved (deprecation path deferred).

---

## 6. Instance Status Model

| Status | Meaning |
|---|---|
| `pending` | Created but not yet started (reserved; the runtime creates instances as `running`). |
| `running` | Started; processing the start node. |
| `waiting` | Paused at a manual node awaiting explicit progression. |
| `completed` | Reached an end node and finished successfully. |
| `failed` | A step failed; the instance is terminated. |
| `cancelled` | Cancelled by an administrator. |

The runtime creates an instance as `running`, processes the start node internally, then transitions to `waiting` (at the first manual node) or `completed` (if start connects directly to end).

---

## 7. StepRun Status Model

| Status | Meaning |
|---|---|
| `pending` | Reserved (created but not yet running). |
| `running` | Reserved for future automatic nodes. |
| `waiting` | A manual node awaiting explicit progression. |
| `completed` | The step finished (historical). |
| `failed` | The step failed (historical). |
| `skipped` | Reserved for future branch skipping. |

- One active (`waiting`/`running`) StepRun per instance + node visit.
- `start` and `end` nodes are processed internally and created directly as `completed`.
- `manual` nodes enter `waiting`.
- Completed and failed runs are historical; no StepRun record is deleted by runtime operations.

---

## 8. Manual Progression Semantics

- The runtime automatically passes through `start` and `end` nodes.
- It must stop and wait at every `manual` node.
- `completeWorkflowStep` completes the current waiting manual step and advances to the next node.
- Only the current waiting manual step may be completed. A mismatch (no waiting step, or a terminal instance) is rejected or returned idempotently.
- The runtime never executes arbitrary node logic. `configuration` is stored declaratively and never interpreted.

---

## 9. Branch Selection

- When the current manual node has a single outgoing edge, the runtime auto-advances to its target.
- When the current manual node has multiple outgoing edges, the caller must provide `nextNodeKey`. If omitted, 400. If the provided `nextNodeKey` is not among the outgoing edges, 400.
- The runtime never guesses which branch to take.
- At `startWorkflow`, the start node must have a single outgoing edge to auto-advance (branching decisions happen at manual nodes, not at the auto-processed start). A start node with multiple outgoing edges is rejected with 400.

---

## 10. Append-Only Audit

- `WorkflowExecutionEvent` records are append-only: the runtime only creates them, never updates or deletes them.
- `metadata` contains safe identifiers/status values only — never workflow input/output content, credentials, secrets, or stack traces.

---

## 11. Organization and Platform Scope

- **Platform-scoped** definitions have `organizationId = null` and can be started by any organization. Created/managed by `core_developer`/`super_admin`.
- **Organization-scoped** definitions require `organizationId` and can only start instances in that organization. Created/managed by `admin`/`super_admin`.
- Instances are organization-scoped (`organizationId` is the tenant boundary).
- `startWorkflow` enforces scope: for an organization-scoped definition, the instance `organizationId` must match the definition's `organizationId` (400 otherwise).
- `key` is unique within scope: unique per platform scope, or per `(organizationId, key)` for organization scope. The same key is allowed in different organization scopes.

---

## 12. Event Bus Integration

The Workflow Engine uses the existing `publishEvent` service and never creates `PlatformEvent` records directly.

### Event Types

| Operation | Event type |
|---|---|
| registerWorkflowDefinition | `workflow.definition_registered` |
| registerWorkflowVersion | `workflow.version_registered` |
| releaseWorkflowVersion | `workflow.version_released` |
| startWorkflow | `workflow.instance_started` |
| completeWorkflowStep (step) | `workflow.step_completed` |
| completeWorkflowStep (instance ends) | `workflow.instance_completed` |
| failWorkflowStep (step) | `workflow.step_failed` |
| failWorkflowStep (instance) | `workflow.instance_failed` |
| cancelWorkflowInstance | `workflow.instance_cancelled` |

### sourceType / sourceId Rules
- `sourceType` is always `workflow`.
- `sourceId` is the relevant definition, version, or instance id.

### Safe Payload Fields
Payloads may contain: `workflowDefinitionId`, `workflowVersionId`, `workflowInstanceId`, `organizationId`, `nodeKey`, `status`, `resourceType`, `resourceId`.

Payloads **never** contain: workflow input, workflow output, graph content, node configuration, credentials, secrets, tokens, or error stack traces.

### Best-Effort Publication
Publication is best-effort. A publication failure or zero subscribers never rolls back workflow execution. The Workflow Engine does not dispatch or process `EventDelivery` records.

---

## 13. Lifecycle Compatibility

The Workflow Engine does not modify the Lifecycle Engine and adds no workflow-specific lifecycle logic. Workflow resources participate through the existing `(resourceType, resourceId)` abstraction via reserved resource-type values:

- `workflow_definition`
- `workflow_version`
- `workflow_instance`

No lifecycle definitions or bindings are automatically created. A workflow may reference another platform resource through `resourceType`/`resourceId`, but the runtime never directly mutates that resource.

---

## 14. Permission Model

| Capability | Roles |
|---|---|
| `platform.workflows.read` | developer, solution_architect, core_developer, admin, super_admin |
| `platform.workflows.manage` (platform definitions + versions + release) | core_developer, super_admin |
| `platform.workflows.connect` (org definitions/versions, start/progress/fail/cancel) | admin, super_admin |

- **Developer** — read visible workflow definitions and instances.
- **Solution Architect** — read definitions, versions, and graph structure.
- **Core Developer** — manage platform-scoped definitions and versions, release platform workflow versions, read instances.
- **Admin** — manage organization-scoped definitions and versions, start/progress/fail/cancel organization instances, read platform workflow catalog.
- **Super Admin** — full access.

### Boundary
- Core Developer and Super Admin manage platform-scoped definitions and versions.
- Admin may create, activate, progress, fail, and cancel organization workflow instances.
- Admin may not register platform-scoped definitions or versions (403).
- Backend functions run under the service role.
- Function-level role, scope, and organization checks are mandatory.
- Direct frontend entity access remains subject to backend RLS.

---

## 15. Security Restrictions

- No arbitrary code execution, no `eval`, no dynamic imports, no scripts, no manifest-provided functions.
- No expression evaluation; no automatic decision logic.
- No external API calls; no connector actions; no plugin execution.
- `graph` must contain no executable-looking values (rejected at registration and release).
- Instance `input`/`output` and StepRun `input`/`output` are transport data; secret-looking keys are redacted from `getWorkflowInstance` reads.
- `lastError` stores safe error text only — never stack traces.
- Execution event `metadata` contains safe identifiers/status only.

---

## 16. Backend Functions

| Function | Purpose | Authorized roles |
|---|---|---|
| `registerWorkflowDefinition` | Create a definition (platform or organization scope) | platform: core_developer/super_admin; org: admin/super_admin |
| `registerWorkflowVersion` | Create a draft version with a validated graph | scope-permitted |
| `releaseWorkflowVersion` | Revalidate, mark released, set currentVersionId | scope-permitted |
| `startWorkflow` | Start an instance of a released version | admin/super_admin |
| `getWorkflowInstance` | Read instance + steps + audit (redacted) | developer/solution_architect/core_developer/admin/super_admin |
| `completeWorkflowStep` | Complete current waiting step, advance | admin/super_admin |
| `failWorkflowStep` | Fail current step and instance | admin/super_admin |
| `cancelWorkflowInstance` | Cancel a non-terminal instance | admin/super_admin |
| `listWorkflows` | Catalog + optional org instance view | developer/solution_architect/core_developer/admin/super_admin |

### Idempotency
- `completeWorkflowStep` on a terminal instance returns the current state (`already_completed`/`already_failed`/`already_cancelled`).
- `failWorkflowStep` on a terminal instance returns the current state.
- `cancelWorkflowInstance` on an already-cancelled instance returns `already_cancelled`; on completed/failed instances returns 400.
- Duplicate connection/definition creation is rejected with 409 (not idempotent).

---

## 17. Management UI

- **Workflow Catalog** (`/workflows`) — definitions table with scope/versions/current-version badges; "New Definition" gated by manage/connect.
- **Workflow Definition Detail** (`/workflows/:definitionId`) — definition metadata + versions table; "New Version" and "Release" gated by manage; "Start Instance" gated by connect. Draft graph entry is a structured JSON editor (`WorkflowVersionForm`) with parse feedback and server validation feedback — **no visual drag-and-drop builder**.
- **Workflow Instances** (`/workflows/instances`) — instance list with status filter.
- **Instance Detail** (`/workflows/instances/:instanceId`) — status, current node, correlationId, resource binding metadata, completed/waiting/failed steps, append-only execution timeline; Complete/Fail/Cancel actions gated by connect. Secret-looking input/output values are not displayed (redacted by the read function).

---

## 18. Dashboard

Five real-data counters: Workflow Definitions, Released Workflow Versions, Running Workflow Instances, Waiting Workflow Steps, Failed Workflow Instances. Counters use the user-context SDK (RLS-scoped).

---

## 19. Known Limitations

1. No store-level uniqueness constraint on `(workflowDefinitionId, version)` or on definition `(scope, key)` / `(scope, organizationId, key)` — enforced in function logic via pre-checks; concurrent calls may race.
2. The start node must have a single outgoing edge to auto-start; multiple outgoing edges at start are rejected (branching happens at manual nodes).
3. `pending`, `running`, and `skipped` StepRun statuses and `pending` instance status are reserved and not produced by Phase 7 operations.
4. `deprecated` version status is reserved.
5. No expression evaluation, automatic decisions, or action registry.

---

## 20. Deferred Functionality

- Real OAuth authorization, OAuth callback handling, token exchange, token refresh.
- External secret manager implementation.
- Provider adapters and external API calls.
- Live connectivity testing and synchronization.
- Webhooks.
- Background jobs and connection-health monitoring.
- Event Bus-triggered workflow starts (no automatic start on published events).
- Scheduled waits and scheduler.
- Automatic retries.
- Automatic decision logic and expression evaluation.
- Action registry (pluggable step actions).
- Dependency enforcement between plugins/apps and workflows.
- Visual drag-and-drop workflow builder.
- Store-level uniqueness where applicable.

---

## 21. Cross-Phase Integrity

Phase 7 was additive only. No prior-phase structures were modified:

- **Phase 2 Lifecycle Engine — unchanged.** Only `workflow_definition`, `workflow_version`, `workflow_instance` resource-type values are reserved.
- **Phase 3 Event Bus contract — unchanged.** `publishEvent` was not modified; the Workflow Engine consumes it as a client.
- **Phase 4 Event Delivery Runtime — unchanged.** The Workflow Engine publishes events but does not dispatch or process deliveries.
- **Phase 5 Plugin Engine — unchanged.**
- **Phase 6 Connector Engine — unchanged.**

**END OF PHASE 7 WORKFLOW ENGINE SPEC.**