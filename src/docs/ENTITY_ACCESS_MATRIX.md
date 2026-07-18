# PGP Core — Entity Access Matrix (Phase 9, Wave I)

> Per-entity access classification. Companion to
> `SECURITY_RLS_HARDENING_SPEC.md`. Values are EXACT — no generic
> "Protected". Enforcement layer is the real boundary today.

Legend:
- **Direct R** / **C** / **U** / **D** = direct frontend SDK
  Read / Create / Update / Delete policy.
- **Enforcement** = where the control actually lives.
- **Verification** = how it was checked.

Enforcement values: `Datastore Enforced`, `Function Enforced`,
`Datastore + Function Enforced`, `Platform Default`,
`Code Inspection Only`, `Runtime Verified`, `Unverified`, `Deferred`.

---

## Phase 1 — Identity, Tenancy, Catalog, Platform Admin

| Entity | Scope | Direct R | C | U | D | Function path | Org isolation | Sensitive fields | Immutable / Append-only | Enforcement | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Organization | platform (root) | function-preferred | denied | denied | denied | function-only (super_admin) | n/a | settings (non-sensitive) | — | Function Enforced | Code Inspection |
| OrganizationMember | organization | function-preferred | denied | denied | denied | function-only (admin/super_admin) | function (self/org admin) | — | — | Function Enforced | Code Inspection |
| PlatformRole | platform | read allowed | denied | denied (immutable) | denied (immutable) | function-only (super_admin) | n/a | — | is_system immutable | Function Enforced | Code Inspection |
| Permission | platform | read allowed | denied | denied | denied | function-only (super_admin) | n/a | — | — | Function Enforced | Code Inspection |
| RolePermission | platform | read allowed | denied | denied | denied | function-only (super_admin) | n/a | — | — | Function Enforced | Code Inspection |
| ApplicationDefinition | platform | read allowed | denied | denied | denied | function-only (super_admin) | n/a | — | — | Function Enforced | Code Inspection |
| ApplicationInstallation | organization | denied | denied | denied | denied | function-only (org admin) | function (member re-fetch) | config (non-sensitive) | — | Function Enforced | Code Inspection |
| ServiceConfiguration | organization | denied | denied | denied | denied | function-only | function (member re-fetch) | config (secrets by ref only) | — | Function Enforced | Code Inspection |
| FeatureFlag | platform/org | function-preferred | denied | denied | denied | function-only | function for org flags | — | — | Function Enforced | Code Inspection |
| SystemSetting | platform | denied (sensitive redacted) | denied | denied | denied | function-only (super_admin/core_developer) | n/a | value (is_sensitive) | — | Function Enforced | Code Inspection |
| EventTopic | platform | read allowed | denied | denied | denied | function-only | n/a | — | — | Function Enforced | Unverified |

## Phase 2 — Lifecycle Engine

| Entity | Scope | Direct R | C | U | D | Function path | Org isolation | Sensitive fields | Immutable / Append-only | Enforcement | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| LifecycleDefinition | platform | read allowed | denied ⚠ | denied ⚠ | denied ⚠ | function-only (core_developer/admin/super_admin) | n/a | — | — | Function Enforced | Code Inspection |
| LifecycleState | platform | read allowed | denied ⚠ | denied ⚠ | denied ⚠ | function-only | n/a | — | — | Function Enforced | Code Inspection |
| LifecycleTransition | platform | read allowed | denied ⚠ | denied ⚠ | denied ⚠ | function-only | n/a | — | — | Function Enforced | Code Inspection |
| LifecycleBinding | platform (opaque) | denied | denied | denied (runtime) | denied | attachLifecycle / runtime | n/a | — | only currentLifecycleStateId mutated | Function Enforced | Code Inspection |
| LifecycleApprovalRequest | platform | denied | denied (runtime) | denied (decideApproval) | denied | decideApproval | n/a | — | status immutable post-decision | Function Enforced | Code Inspection |
| LifecycleExecutionEvent | platform (audit) | denied | denied (runtime only) | denied (append-only) | denied (append-only) | runtime service role | n/a | metadata (safe only) | append-only | Function Enforced | Code Inspection |

⚠ = direct-SDK write violation present today (Wave III removes).

## Phase 3 — Event Bus

| Entity | Scope | Direct R | C | U | D | Function path | Org isolation | Sensitive fields | Immutable / Append-only | Enforcement | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PlatformEvent | platform/org | denied | denied (runtime via publishEvent) | denied (future processor) | denied (append-only) | publishEvent | function when org set | payload (safe only) | append-only | Function Enforced | Code Inspection |
| EventSubscription | platform | denied | denied | denied | denied | subscribe/unsubscribe | n/a | — | — | Function Enforced | Code Inspection |

## Phase 4 — Delivery Runtime

| Entity | Scope | Direct R | C | U | D | Function path | Org isolation | Sensitive fields | Immutable / Append-only | Enforcement | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EventDelivery | platform | denied | denied (runtime) | denied (runtime) | denied (historical) | dispatchEvent/processEventDelivery | n/a | lastError (safe) | historical; unique (eventId,subId) function-only | Function Enforced | Code Inspection |

## Phase 5 — Plugin Engine

| Entity | Scope | Direct R | C | U | D | Function path | Org isolation | Sensitive fields | Immutable / Append-only | Enforcement | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PluginDefinition | platform | read allowed | denied | denied | denied | registerPluginDefinition | n/a | — | key immutable | Function Enforced | Code Inspection |
| PluginVersion | platform | read allowed | denied (draft) | denied (released immutable) | denied | registerPluginVersion/releasePluginVersion | n/a | manifest (declarative) | released immutable; re-release forbidden | Function Enforced | Code Inspection |
| PluginInstallation | organization | denied | denied | denied | denied (non-destructive) | install/enable/disable/uninstallPlugin | function (member re-fetch) | configuration (non-sensitive) | uninstalledAt preserved | Function Enforced | Code Inspection |

## Phase 6 — Connector Engine

| Entity | Scope | Direct R | C | U | D | Function path | Org isolation | Sensitive fields | Immutable / Append-only | Enforcement | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ConnectorDefinition | platform | read allowed | denied | denied | denied | registerConnectorDefinition | n/a | — | key immutable | Function Enforced | Code Inspection |
| ConnectorProvider | platform | read allowed | denied | denied | denied | registerConnectorProvider | n/a | credentialRequirements (metadata only) | — | Function Enforced | Code Inspection |
| ConnectorConnection | organization | denied (credentialRef hidden) | denied | denied | denied (non-destructive) | create/activate/disable/disconnectConnectorConnection | function (member re-fetch) | credentialRef (opaque) | disconnect non-destructive | Function Enforced | Code Inspection |

## Phase 7 — Workflow Engine

| Entity | Scope | Direct R | C | U | D | Function path | Org isolation | Sensitive fields | Immutable / Append-only | Enforcement | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WorkflowDefinition | platform/org | read allowed (scope-respecting) | denied | denied | denied | registerWorkflowDefinition | function for org scope | — | key immutable | Function Enforced | Code Inspection |
| WorkflowVersion | platform/org | read allowed | denied (draft) | denied (released immutable) | denied | register/releaseWorkflowVersion | function for org scope | graph (declarative) | released immutable | Function Enforced | Code Inspection |
| WorkflowInstance | organization | denied ⚠ | denied | denied | denied (historical) | start/complete/fail/cancelWorkflowInstance | function (member re-fetch) | input/output (redacted) | terminal historical | Function Enforced | Code Inspection |
| WorkflowStepRun | organization | denied | denied (runtime) | denied (runtime) | denied (historical) | runtime | via parent instance | input/output (redacted) | terminal historical; append-style | Function Enforced | Code Inspection |
| WorkflowExecutionEvent | platform/org (audit) | denied | denied (runtime only) | denied (append-only) | denied (append-only) | runtime service role | n/a | metadata (safe only) | append-only | Function Enforced | Code Inspection |

⚠ = direct-SDK read violation present today (WorkflowInstancesPage.list — cross-tenant, raw input/output).

## Phase 8 — Scheduler and Background Job Runtime

| Entity | Scope | Direct R | C | U | D | Function path | Org isolation | Sensitive fields | Immutable / Append-only | Enforcement | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| JobDefinition | platform | read allowed (payload redacted) | denied | denied | denied | registerJobDefinition | n/a | payloadSchema/resultSchema (declarative) | key immutable | Function Enforced | Code Inspection |
| JobSchedule | platform/org | denied (payload redacted) | denied | denied | denied (non-destructive) | create/pause/resume/cancelJobSchedule | function for org scope | payload (redacted) | cancel non-destructive | Function Enforced | Code Inspection |
| BackgroundJob | platform/org | denied (payload/result redacted) | denied (scheduler/enqueue) | denied (worker runtime) | denied (terminal preserved) | scheduler/processBackgroundJobs/enqueue/cancel | function for org scope | payload/result/lastError | terminal preserved | Function Enforced | Code Inspection |
| JobAttempt | platform/org (historical) | denied | denied (runtime) | denied (runtime) | denied (historical) | worker runtime | via parent job | lastError (safe) | abandoned preserved; append-style | Function Enforced | Code Inspection |
| JobExecutionEvent | platform/org (audit) | denied | denied (runtime only) | denied (append-only) | denied (append-only) | runtime service role | n/a | metadata (safe only) | append-only | Function Enforced | Code Inspection |

## Architecture Intelligence (audit) — grouped

| Entity | Scope | Direct R | C | U | D | Function path | Org isolation | Sensitive fields | Immutable / Append-only | Enforcement | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AuditProfileDefinition | platform | read allowed | denied | denied | denied | function-only | n/a | — | — | Function Enforced | Unverified |
| Audit entities (grouped, 14) | mixed platform/org | function-preferred | denied | denied | denied | function-only | function for org members | evaluative content (non-secret) | AuditRun/evaluations historical | Function Enforced | Unverified |

---

## Direct-SDK write violations (Wave I inventory → Wave III removes)

| File | Entity | Operation | Severity |
|---|---|---|---|
| src/pages/lifecycle/LifecycleDefinitionsPage.jsx | LifecycleDefinition | entities…delete(id) | write violation |
| src/components/lifecycle/LifecycleDefinitionForm.jsx | LifecycleDefinition | entities…create/update | write violation |
| src/pages/lifecycle/LifecycleStatesPage.jsx | LifecycleState | entities…delete(id) | write violation |
| src/pages/lifecycle/LifecycleTransitionsPage.jsx | LifecycleTransition | entities…delete(id) | write violation |
| src/components/lifecycle/LifecycleStateForm.jsx | LifecycleState | likely create/update | write violation (confirm) |
| src/components/lifecycle/LifecycleTransitionForm.jsx | LifecycleTransition | likely create/update | write violation (confirm) |
| src/pages/workflows/WorkflowInstancesPage.jsx | WorkflowInstance | entities…list() | sensitive read violation (cross-tenant, raw input/output) |

## Direct-SDK reads under review (Wave III)

| File | Entity | Operation |
|---|---|---|
| src/pages/plugins/PluginDetailPage.jsx | Organization | list() |
| src/pages/connectors/OrganizationConnectionsPage.jsx | Organization | list() |
| src/pages/plugins/InstalledPluginsPage.jsx | Organization | list() |
| src/pages/jobs/JobDefinitionsPage.jsx | JobDefinition | list() |
| src/pages/jobs/JobSchedulesPage.jsx | JobDefinition | list() |
| src/pages/jobs/JobQueuePage.jsx | JobDefinition | list() |
| src/pages/lifecycle/LifecycleStatesPage.jsx | LifecycleDefinition/State | list()/filter() |
| src/pages/lifecycle/LifecycleTransitionsPage.jsx | LifecycleDefinition/State/Transition | list()/filter() |

## Backend function security inventory (Wave I summary)

All 46 deployed functions re-fetch via `asServiceRole` and check
`user.role`. Findings:

- **Dead role branches**: `core_developer` / `super_admin` checks never
  pass for real identities (user.role ∈ {admin, user}). Kept per Decision
  A2; marked Code Inspection Only.
- **No organization membership verification**: organizationId trusted
  from request body across all org-scoped functions. Wave II adds
  OrganizationMember re-fetch + resource re-fetch + ownership compare.
- **publishEvent** accepts `actorId` and `organizationId` from request
  body — Wave II derives `actorId` from `user.id` and validates org
  membership.
- **Safe errors**: functions return `error.message` on 500 — Wave II
  sanitizes to safe text (no stack trace / raw exception).

## What is safe for Wave II

1. Add OrganizationMember re-fetch + resource re-fetch + ownership
   comparison to every org-scoped function — pure authorization
   tightening, no business contract change.
2. Derive `actorId` from `user.id` in `publishEvent`; validate org
   membership.
3. Centralize recursive secret-key + executable-pattern rejection into a
   shared helper imported by all functions.
4. Add bounded input validation (lengths, depth, array size, JSON size)
   to mutating functions.
5. Add list-function filter allow-lists, sort allow-lists, page-size
   caps (≤50 default, ≤100 max).
6. Sanitize 500 error responses to safe text.
7. Add datastore `rls` rules **only** where verifiable and safe:
   - Global catalog reads can remain open (read allowed) for
     authenticated users — but these are reads, not the security
     boundary.
   - **No org-scoped datastore RLS** (RLS cannot express
     OrganizationMember membership).
8. Deny direct SDK mutations for Core entities at the function level —
   functions remain the authoritative boundary.

## What cannot be solved in Base44 (honest)

- Datastore org isolation (no user.organizationId; RLS cannot join
  OrganizationMember) → function-only.
- Conditional datastore immutability for released versions → function
   deny-all on update/delete.
- Datastore append-only audit → function-layer contract.
- Unique constraints → function-level dedup.
- Atomic claim / compare-and-swap → function-logic-only (Phase 8
  at-least-once).
- Trusted identity for Core Developer / Super Admin → deferred (no
  external IdP in Phase 9).
- Machine identity for native scheduler automation → external trigger
  required.

---

Wave I complete. No business behavior changed. Awaiting approval to
begin Wave II (authoritative backend + data access hardening).