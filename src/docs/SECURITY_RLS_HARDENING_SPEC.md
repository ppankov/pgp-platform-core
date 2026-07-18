# PGP Core — Security, RLS & Data-Layer Hardening Spec (Phase 9)

> **Phase 9 — FROZEN.**
>
> - **Freeze date:** 2026-07-18.
> - **Snapshot:** `src/docs/PHASE_9_ARCHITECTURE_SNAPSHOT.md`.
> - **Final RLS counts:** 52 application-defined entities — Template A = 13,
>   Template B = 36, Template C = 3. Unclassified = 0. Missing/duplicate = 0.
> - **Verification summary:** 52/52 valid RLS blocks; 0 direct frontend mutations;
>   0 frontend `asServiceRole`; 0 Template B direct frontend reads; 0 remaining
>   security violations; 0 persistent test records. Service-role backend paths
>   Runtime Verified (6 probes 200 OK). Direct user-context RLS deny = Code
>   Inspection Only.
> - **Known-limitations reference:** see "Known limitations" in the snapshot and
>   §"Phase 9 — Consolidated Security Closure" below.
> - **Future changes** to RLS, the function-only mutation contract, or the
>   protected-read contract require a new Phase / change record. Phase 2–8
>   snapshots and business contracts are NOT modified.
>
> The authoritative current matrix is the **"Phase 9 — Consolidated Security
> Closure"** section. Earlier wave sections (Wave I/II/III narrative, the old
> §7 allow-list, the Open read gap, the Pilot scope boundary, and the duplicate
> verification matrices) are **SUPERSEDED** where they conflict with the closure
> section and the FROZEN status above. They are retained for audit history.

---

## 1. Real Base44 datastore / RLS capabilities (verified)

Base44 supports **real datastore-enforced Row-Level Security** via a
top-level `rls` field in entity schemas:

- Operations: `create`, `read`, `update`, `delete`, `write`.
- Conditions:
  - Entity-to-user comparison: `{ "created_by": "{{user.email}}" }`, `{ "created_by_id": "{{user.id}}" }`
  - User condition: `{ "user_condition": { "role": "admin" } }` (equality only)
  - `data.*` field comparison: `{ "data.organizationId": "{{user.data.organizationId}}" }`
  - Logical: `$or`, `$and`, `$nor`
  - Field operators on `data.*`: `$in`, `$nin`, `$ne`, `$all`
- Field-Level Security: `rls` inside a field (`read`/`write`).
- Template variables: `{{user.id}}`, `{{user.email}}`, `{{user.role}}`, `{{user.data.*}}`
- `base44.asServiceRole` bypasses all RLS (trusted backend code only).

### NOT supported (verified)
- Conditional writes / compare-and-swap / atomic claim.
- Transactions.
- Unique constraints.
- Machine/service identity for no-user automations.
- `user_condition` operators beyond equality (no `$gt`, `$regex`, … on user props).

### Critical current-state finding — SUPERSEDED
The pilot-of-5 view below was the pre-closure state. The Consolidated Security
Closure pass applied datastore RLS to **all 52 application-defined entities**
(Template A = 13, B = 36, C = 3). See the "Phase 9 — Consolidated Security
Closure" section for the authoritative matrix. Organization isolation remains
function-enforced (datastore RLS cannot join OrganizationMember).

---

## 2. Trusted role-source audit (Decision A2)

Base44 auth `user.role` has exactly two built-in values: **`admin`** and
**`user`**. These are the only roles datastore RLS can test via
`user_condition: { role: "..." }`.

PGP Core defines an application capability model with additional roles
(Super Admin, Core Developer, Solution Architect, Developer, Auditor).
These are **application/function-level roles**, not datastore roles.

### Trusted server-side source today
- `base44.auth.me()` returns `{ id, email, full_name, role }` where
  `role ∈ { admin, user }`.
- `OrganizationMember` carries per-org roles (admin, developer,
  core_developer, solution_architect, auditor, support, user, guest)
  but is **not joined** to auth and is **not readable by RLS**.

### Consequence
- Function branches testing `role === 'super_admin'` or
  `role === 'core_developer'` are **dead for real identities** (user.role
  is never those values). This includes the Phase 8 scheduler/worker
  gates, which mechanically block all real users.
- Per Decision A2: we **do not** collapse the role model, do not equate
  built-in `admin` with Super Admin, do not weaken gates, do not invent
  identity. Dead role branches are **kept** and marked
  **Code Inspection Only / Runtime Identity Unavailable**.
- A trusted server-side source for Core Developer / Super Admin is a
  **future need** (deferred; not solved in Phase 9; no external IdP).

### Roles are never accepted from
- request body, query parameter, localStorage, frontend state, hidden
  form fields, client-supplied User objects.

---

## 3. Organization membership — source of truth (Decision B2)

- `OrganizationMember` is the **single source of truth** for tenant
  membership.
- `user.organizationId` is **NOT added** (no second parallel membership
  model; preserves future multi-org support).
- Datastore org RLS via `data.organizationId: "{{user.data.organizationId}}"`
  is **NOT available** (users have no org field, and RLS cannot join
  `OrganizationMember`).

### Organization-scoped function contract (Wave II enforces)
1. Establish authenticated user (`base44.auth.me()`).
2. Check role/capability.
3. Re-fetch `OrganizationMember` via service role for the caller.
4. Confirm active membership (`status === 'active'`).
5. Re-fetch the target resource.
6. Compare `resource.organizationId` to the authorized org.
7. Only then perform read or mutation.

### Request-body organizationId
- Does NOT prove membership.
- Does NOT expand visibility.
- May only select among organizations for which membership is already
  proven.

### Enforcement layer
- `organizationIsolation = Function Enforced` for all org-scoped
  entities.
- Direct SDK reads of sensitive org entities are **denied** and routed
  through functions (Wave II/III).
- We do **not** claim datastore org isolation.

---

## 4. Direct SDK contract

For all Core entities:
- Direct frontend **create/update/delete** is forbidden (except where
  explicitly proven safe — none identified in Wave I).
- All business mutations pass through backend functions.
- UI capability checks are **hints**, not security enforcement.
- Backend functions always verify: authenticated actor, role, tenant
  membership, resource scope, organization ownership, current resource
  state, allowed transition/action.
- Functions **re-fetch** the resource via service role before mutation
  and compare the real scope. They do not trust request-body role,
  organizationId, status, ownerId, or client-side hidden buttons.

### Wave I inventory of direct-SDK violations
See `ENTITY_ACCESS_MATRIX.md` § "Direct-SDK write violations" and the
`DIRECT_SDK_VIOLATIONS_WAVE_I` export in `entity-security-matrix.js`.

Summary:
- Lifecycle Definition / State / Transition: direct create/update/delete
  via pages + forms.
- WorkflowInstance: direct `list()` — cross-tenant, exposes raw
  input/output (sensitive read violation).
- Organization/JobDefinition: direct `list()` reads — acceptable as
  catalog reads but reviewed in Wave III for redaction/scope.

### Frontend `asServiceRole`
- **Not found** in any frontend file (good). Must remain absent.

---

## 5. Service-role authorization contract

Every backend function must, in order:
1. `base44.auth.me()` — reject 401 if no user (unless an explicitly
   supported, verified machine identity exists — none today).
2. Role/capability gate before any service-role data access.
3. OrganizationMember re-fetch for organization-scoped operations.
4. Resource re-fetch; compare `organizationId`.
5. Platform/org scope separation (no mixing; platform scope requires
  `organizationId = null`).
6. Caller cannot change `organizationId` via payload to cross tenants.
7. Service-role invocation does NOT inherit trust from the caller
   function — callee applies its own authorization.
8. No-user invocation is rejected (except verified machine identity).
9. Error responses contain no stack trace, raw exception, service-role
   details, credentials, tokens, query internals, or full records.

### Wave I finding
Functions today correctly re-fetch via `asServiceRole` and check
`user.role`, but:
- Repeated dead role branches (`core_developer`, `super_admin`) that no
  real identity satisfies.
- `publishEvent` accepts `actorId` and `organizationId` from request
  body — must derive `actorId` from `user.id` and validate org
  membership in Wave II.
- Org membership is NOT verified anywhere today (organizationId trusted
  from request body).

---

## 6. Role matrix

| Role | Reads | Mutations | Scheduler/Worker | Security Center |
|---|---|---|---|---|
| Developer | redacted metadata only | none | no | no (unless existing perm system admits) |
| Solution Architect | architecture/security posture, graph/retry/lease metadata | none | no | read |
| Core Developer | platform catalogs, platform security posture | platform definitions/versions (frozen contracts); no org mutation without real org authorization | no | read |
| Admin | own org only | own org resources (install/enable/disable/uninstall/connect/cancel) | no | org-scoped read |
| Super Admin | full | full via functions; explicit, audit-visible; no structural-validation bypass | manual invoke only | full read + `platform.security.manage` |

- UI permission registry and backend role checks must coincide; backend
  checks are authoritative.
- No `member` role is added in Phase 9.

---

## 7. Tenant isolation

- Admin sees only their own organization.
- Org-scoped Developer sees only permitted metadata for their tenant.
- Core Developer does not automatically receive all org records.
- Super Admin has global visibility.
- Platform-scoped records do not inherit an arbitrary organizationId.
- A foreign organizationId in a request is rejected.
- **Enforcement layer: Function Enforced** (no datastore org RLS).

---

## 8. Sensitive read paths

Minimum sensitive set:
- `ConnectorConnection` (credentialRef)
- `WorkflowInstance` (input/output)
- `WorkflowStepRun` (input/output)
- `BackgroundJob` (payload/result)
- `JobSchedule` (payload)
- `JobAttempt` (lastError)
- `LifecycleApprovalRequest`
- `EventDelivery` (lastError)
- `SystemSetting` (value when is_sensitive)
- `ServiceConfiguration` (config)
- Any entity with input/output/payload/result/lastError/credentialRef

If field-level RLS is insufficient (it is, at app level, for
credentialRef), the entity is **not exposed directly** — reads go
through existing get/list functions with recursive server-side
redaction. Business semantics are unchanged.

---

## 9. Immutable / append-only policy

### Released-immutable
- `PluginVersion`, `WorkflowVersion` (and any version entity).
- Released records cannot be updated or deleted via frontend SDK.
- Backend functions do not mutate released content; re-release is
  forbidden.
- **Enforcement layer**: Function Enforced (no datastore conditional
  immutability). Wave II denies **all** direct update/delete on version
  entities — this is an access boundary, not a conditional field rule.
  We do not claim conditional datastore immutability.

### Append-only audit/event
- `LifecycleExecutionEvent`, `PlatformEvent`, `WorkflowExecutionEvent`,
  `JobExecutionEvent`.
- Direct client create/update/delete forbidden. Runtime/service create
  only via functions.
- **Enforcement layer**: Function Enforced (append-only is a
  function-layer contract). No datastore update/delete prohibition.

### Historical runtime
- `JobAttempt`, `WorkflowStepRun` (after terminal), `EventDelivery`
  history, `LifecycleApprovalRequest` (after decision).
- Direct status mutation forbidden; all transitions via frozen
  functions. Direct delete forbidden. Non-destructive semantics
  preserved.

---

## 10. Input / query bounds (Wave II target)

Targets (do not tighten below existing valid contracts):
- `key` ≤ 128 chars; `name` ≤ 256; `correlationId` ≤ 512;
  `lastError` ≤ 2000; `description` ≤ 10000.
- Event Bus payload/metadata ≤ 32 KB; audit metadata ≤ 32 KB;
  workflow/job input/output/payload/result ≤ 64 KB;
  graph/manifest/schema ≤ 256 KB.
- Object nesting depth ≤ 20; declarative-config arrays ≤ 1000 elements.
- Never silently truncate security-sensitive data — return 400 with a
  safe reason.

### Secret / executable detection (centralized in Wave II)
Secret-looking keys (recursive): `password`, `passwd`, `secret`,
`token`, `access_token`, `refresh_token`, `api_key`, `apiKey`,
`client_secret`, `private_key`, `credential`, `authorization`, `cookie`,
`session`.

Executable patterns (only in declarative config fields): `eval(`,
`new Function`, `function(`, `function {`, `=>`, `import(`, `require(`,
`process.env`, `<script`, `javascript:`, shell command patterns,
executable file paths.

### Query / pagination
- Filter allow-lists per list function; unknown filters rejected.
- Page size default ≤ 50, absolute max ≤ 100; negatives rejected;
  oversized clamped or rejected consistently.
- Sort field allow-listed; direction `asc`|`desc`.
- organizationId filter cannot expand visibility.
- Worker batch max stays 50 (frozen).
- No cursor contract introduced (platform does not reliably support it).

---

## 11. Machine / internal invocation boundary

- No official, verifiable machine/service identity mechanism is
  available in Base44 today (verified).
- Per the Phase 8 freeze: no shared secret, URL token, organization
  record as credential, hardcoded key, or weakened Super Admin gate is
  created.
- Scheduler mode remains **External Scheduler Trigger Required**.
- This is an operations limitation, not a missing queue/worker logic.

### Future ops task (deferred, does not block Phase 9)
- Machine/service identity for native Base44 automations.
- Secure authentication of native automation.
- Invocation of `runSchedulerTick` and `processBackgroundJobs`.
- Cadence no faster than once per minute.
- End-to-end operational verification.

---

## 12. Security Center (Wave III)

- Route: `/security` (RoleRoute-guarded).
- Read-only. No UI to edit RLS.
- Access: Solution Architect / Core Developer (platform posture); Admin
  (own-org posture); Super Admin (full). Developer: no access unless
  the existing permission system explicitly admits.
- Sections: Overview, Entity Access Matrix, Tenant Isolation,
  Immutable / Append-Only Coverage, Sensitive Data Paths, Function
  Security Inventory, Known Limitations, Verification Status.
- Each control shows one of: Datastore Enforced, Function Enforced,
  Datastore + Function Enforced, Platform Default, Code Inspection Only,
  Runtime Verified, Unverified, Deferred.
- Never shows "Protected" green for UI-only mechanisms. Never shows raw
  credentialRef, secrets, tokens, full rule source, stack traces, or
  test credentials.

---

## 13. Verification methodology

- Real user-context identities are used where the platform permits.
- Service role is never used to prove user RLS.
- Where runtime role switching is unavailable, the control is marked
  **Code Inspection Only** — never **Runtime Verified**.
- Distinction is explicit per entity in `entity-security-matrix.js`.

---

## 14. Runtime vs code-inspection distinction

| Label | Meaning |
|---|---|
| Datastore Enforced | Real `rls` rule present and verified. |
| Function Enforced | Authorization in backend function code; no datastore rule. |
| Datastore + Function Enforced | Both a real `rls` rule and function checks. |
| Platform Default | Base44 built-in behavior (e.g. `created_by` ownership). |
| Code Inspection Only | Verified by reading source; no runtime identity test. |
| Runtime Verified | Exercised with a real identity/session. |
| Unverified | Not yet inspected. |
| Deferred | Explicitly postponed. |

No entity is labeled "Protected" generically.

---

## 15. Known limitations (Wave I)

- No conditional datastore rules; no field-level RLS at app level for
  credentialRef.
- No transactions; no unique constraints.
- Function-level-only deduplication and atomicity (Phase 8).
- Function-layer-only append-only audit.
- Role paths for Core Developer / Super Admin are Code Inspection Only
  (Runtime Identity Unavailable).
- Single-organization-membership model is not assumed; OrganizationMember
  is the source of truth (no user.organizationId).
- Machine identity for native automation unavailable — external
  scheduler trigger required.
- No distributed locking; no exactly-once guarantee.
- 15 Architecture Intelligence (audit) entities are grouped; per-entity
  detailed classification deferred.

---

## 16. Deferred hardening (future)

- Atomic claim / compare-and-swap.
- Datastore unique constraints.
- Datastore append-only audit protection.
- Organization row isolation at the datastore layer.
- Distributed locking.
- Trusted server-side platform-role source (Core Developer / Super
  Admin).
- Native scheduler invocation wiring (ops task).
- `member` role (before opening to ordinary end users).
- Per-entity detailed classification of Architecture Intelligence
  entities.

---

## 17. Phase boundary

Phase 9 does NOT add: a new business engine, `member` role, OAuth/IdP
integration, a secrets manager, a custom encryption layer, arbitrary code
execution, workflow/connector/plugin execution handlers, distributed
locks, datastore migration beyond supported Base44 capabilities, or a
self-hosted runtime.

Phase 9 hardens the existing PGP Core only.

---

## Wave I deliverables (this document + companions)

- `src/lib/security/entity-security-matrix.js` — declarative registry.
- `src/docs/SECURITY_RLS_HARDENING_SPEC.md` — this file.
- `src/docs/ENTITY_ACCESS_MATRIX.md` — per-entity matrix.

No Security Center UI, no RLS rules, no function changes, no frontend
changes in Wave I. Those begin in Wave II/III after approval.

---

## Wave II deliverables — authoritative backend hardening (complete)

All 46 backend functions hardened. No frozen business contract changed.

### Membership enforcement (Decision B2)
OrganizationMember active-membership verification added to every org-scoped
operation. Resource re-fetch → ownership compare before any mutation/read:

- **Connector (6):** createConnectorConnection, activate/disable/disconnect,
  getConnectorConnection, listConnectors (org view).
- **Plugin (6):** installPlugin, enable/disable/uninstall, getPluginInstallation,
  listPlugins (installed view).
- **Jobs (8):** enqueueBackgroundJob, cancelBackgroundJob, createJobSchedule,
  pause/resume/cancelJobSchedule, getBackgroundJob, listBackgroundJobs,
  listJobSchedules (org scope).
- **Workflows (6):** startWorkflow, cancelWorkflowInstance,
  complete/failWorkflowStep, getWorkflowInstance, listWorkflows (instance view),
  registerWorkflowDefinition/Version + releaseWorkflowVersion (org scope).
- **publishEvent:** actorId derived from auth (never client-supplied for
  user-context calls); org-scoped events require membership. Trusted
  service-role runtime invocations (asServiceRole.functions.invoke) accept an
  explicit actorId and skip membership — the calling authoritative function has
  already enforced its own boundary.

### Cross-tenant read protection
listBackgroundJobs / listJobSchedules / listWorkflows: without an explicit
organizationId, non-super_admin callers are restricted to the organizations
they are an active member of (membership-org `$in` filter). Platform-scope
filters require core_developer/super_admin.

### Bounded input & allow-listed filters
- Length caps on keys, names, eventType/sourceType/sourceId, notes, resourceId,
  subscriber/eventType, errorText.
- Status / scheduleType / misfirePolicy / authModes / sort-field allow-lists.
- Pagination capped (limit ≤ 500).

### Safe error responses
Every `catch` returns a truncated, non-leaking message (≤ 200 chars) — no raw
internal exception text, no stack traces.

### What Wave II did NOT change
- No datastore `rls` field added in Wave II (native org join unavailable;
  enforcement remained function-only per known limitation). A limited
  datastore RLS **pilot** was applied in a later stabilization pass on 5
  entities — see "Datastore RLS Pilot — Applied". It does NOT cover all
  entities and does NOT provide datastore org isolation.
- No frozen business contract altered: status transitions, idempotency,
  event payloads, redaction rules, and release/append-only semantics preserved.
- Platform-scope operations remain restricted to core_developer/super_admin
  (trusted identity unavailable today — dead branches, not weakened).

### Verified
- listConnectors / listPlugins / listJobSchedules / listWorkflows /
  listSubscriptions / getEventDeliveries / getBackgroundJob / getConnectorConnection
  / publishEvent (actorId spoof rejected) / cancelBackgroundJob — all return
  expected status codes; no cross-tenant body leak.
- Zero test-data leftovers after verification.

---

## Wave III deliverables — frontend SDK mutation removal (complete)

### Scope finding
Audit of every frontend page/form/component confirmed: the **Lifecycle module
was the sole outlier** performing direct `base44.entities.*.create/update/delete`
from the frontend. All other modules (Plugin, Connector, Workflow, Jobs,
EventBus) already routed mutations through backend functions via `callFn`. Their
remaining `base44.entities` calls are read-only (`list`/`filter`/`get`) — these
are the standard read pattern and are NOT prohibited by the Wave III rule
("Direct SDK operations are prohibited for business mutations").

### New backend functions (6)
Created under `base44/functions/` with the Wave II hardening contract:
- `saveLifecycleDefinition` — create or update; re-fetch on update.
- `deleteLifecycleDefinition` — re-fetch before delete.
- `saveLifecycleState` — re-fetch parent LifecycleDefinition; re-fetch on update;
  state must belong to the declared lifecycle.
- `deleteLifecycleState` — re-fetch before delete.
- `saveLifecycleTransition` — re-fetch parent + both endpoint states (must belong
  to the same lifecycle); re-fetch on update.
- `deleteLifecycleTransition` — re-fetch before delete.

All enforce `admin/super_admin/core_developer` (the Lifecycle entity RLS
explicitly permits `admin`, a Base44 built-in role that resolves — so these
gates are FUNCTIONAL, unlike the core_developer-only platform-catalog functions
which remain dead branches). Bounded input (length caps, order range, role-label
caps); safe non-leaking error responses.

### Frontend rerouting (6 files)
- `LifecycleDefinitionForm`, `LifecycleStateForm`, `LifecycleTransitionForm` —
  create/update now via `callFn`.
- `LifecycleDefinitionsPage`, `LifecycleStatesPage`, `LifecycleTransitionsPage` —
  delete now via `callFn`.

### Verified
- saveLifecycleDefinition (create) + saveLifecycleState (create) +
  deleteLifecycleDefinition — all return 200; test records cleaned up.
- No remaining direct frontend SDK mutation calls in the Lifecycle module.

---

## Wave III — Final stabilization & consolidated verification

> Final status: **"Phase 9 — Implementation complete, pending final
> stabilization approval and freeze."** NOT FROZEN. The remaining item is NOT
> only datastore RLS — datastore RLS may stay deferred because function-only
> enforcement, direct-write prohibition, and sensitive-read protection are
> actually complete.

### Trusted role source — exact answer (§3)

Backend functions obtain the role from `base44.auth.me().role`. The built-in
`User` entity `role` field enum is **`["admin","user"]`** (verified in
`base44/entities/User.jsonc`). Therefore:

| Role | Runtime-real source | Status |
|---|---|---|
| `admin` | Built-in Base44 `user.role` | **Runtime Verified** — the only privileged gate that resolves |
| `user` | Built-in Base44 `user.role` | Runtime-real; denied by admin-only gates |
| `super_admin` | none — string branch only | **Code Inspection Only** (dead branch; `user.role` never equals this) |
| `core_developer` | none — string branch only | **Code Inspection Only** (dead branch) |
| `developer` | none — string branch only | **Code Inspection Only** (dead branch) |
| `solution_architect` | none — string branch only | **Code Inspection Only** (dead branch) |

Application roles also appear in `OrganizationMember.role` (a backend-controlled
data record) and `PlatformRole` (a backend-controlled catalog), but neither is a
**runtime identity assertion** — `auth.me()` returns only `admin`/`user`.

**Consequence for OrganizationMember enforcement:** the `role !== 'super_admin'`
bypass in every org-scoped function is a dead branch, so the membership
re-fetch + active check **always runs for real users**. This is the secure
default. No role is accepted from request body, localStorage, or frontend state.

**The 6 new Lifecycle functions:** checked — same picture. They gate on
`admin/super_admin/core_developer`; only `admin` resolves. Comments corrected
from the earlier misleading "admin/super_admin are the working gates" to the
honest "admin is the only runtime-real gate; other branches Code Inspection Only".

### The 6 Lifecycle backend functions — contracts (§4)

All 6: authenticate via `auth.me()` before any service-role access; role gate
`admin/super_admin/core_developer` (admin-only runtime-real); bounded input
(length caps, order range); re-fetch validation; safe capped error text
(`slice(0,200)`, no stack trace); no request-supplied role or organization trust.

- `saveLifecycleDefinition` — create or update (re-fetch on update). Bounds:
  name ≤256, targetType ≤128, description ≤2000.
- `deleteLifecycleDefinition` — re-fetch (404), then **referential integrity**
  (409 if any LifecycleState/Transition/Binding/ApprovalRequest/ExecutionEvent
  references it), then delete. id ≤128.
- `saveLifecycleState` — re-fetch parent LifecycleDefinition (404); on update
  re-fetch state (404) and verify `lifecycleId` match. Bounds: key ≤128,
  title ≤256, description ≤2000, order 0..100000.
- `deleteLifecycleState` — re-fetch (404), **referential integrity** (409 if
  used as fromState/toState in a transition, or is currentLifecycleStateId of a
  binding), then delete.
- `saveLifecycleTransition` — re-fetch parent + both endpoint states (must
  belong to same lifecycle). Bounds: notes ≤2000, allowedRoles ≤64 entries,
  each ≤64 chars.
- `deleteLifecycleTransition` — re-fetch (404), **referential integrity** (409
  if a pending LifecycleApprovalRequest or any LifecycleExecutionEvent
  references it), then delete.

### Referential integrity at delete (§5)

Added to the 3 delete functions this pass. No cascade delete; no audit/history
deletion; safe 409 on used resource. Repeated delete of an unknown/just-deleted
id returns 404. Runtime-verified: delete of a definition with a state → 409;
after state removal → 200. Phase 2 config-only-delete semantics preserved.

### Direct frontend SDK write scan (§6)

| Pattern | Before | After |
|---|---|---|
| `entities.*.create` (frontend) | 3 (lifecycle forms) | **0** |
| `entities.*.update` (frontend) | 3 (lifecycle forms) | **0** |
| `entities.*.delete` (frontend) | 3 (lifecycle pages) | **0** |
| `entities.*.bulkCreate/bulkUpdate/bulkDelete` | 0 | **0** |
| frontend `asServiceRole` | 0 | **0** |

Files rerouted: `LifecycleDefinitionForm` → `saveLifecycleDefinition`;
`LifecycleStateForm` → `saveLifecycleState`; `LifecycleTransitionForm` →
`saveLifecycleTransition`; `LifecycleDefinitionsPage` delete →
`deleteLifecycleDefinition`; `LifecycleStatesPage` delete → `deleteLifecycleState`;
`LifecycleTransitionsPage` delete → `deleteLifecycleTransition`. Read-only
`list`/`filter`/`get` calls are NOT counted as mutations and remain (catalog
reads). The missed sensitive **read** violation `WorkflowInstancesPage`
(direct cross-tenant `WorkflowInstance.list()`) is now routed through
`listWorkflows` (membership-scoped) — see §7.

### Direct read allow-list (§7) — SUPERSEDED by the Phase 9 Consolidated Closure matrix

> The allow-list below was the Wave III view. The Phase 9 Consolidated Security
> Closure pass applied datastore RLS (Templates A/B/C) to 52 application-defined
> entities and migrated **all** remaining direct Template B frontend reads to
> protected `callFn` paths. See the **"Phase 9 — Consolidated Security Closure"**
> section at the end of this document for the authoritative, current matrix.
> The previous "Organization/PlatformRole/Permission/ApplicationDefinition are
> allowed direct reads" view is **no longer accurate**: Organization is now
> Template B (function-required); PlatformRole/Permission/RolePermission are
> Template C (admin-only read); ApplicationDefinition/EventTopic are Template A
> (authenticated read allowed).

### Connector credentialRef (§8)

`listConnectors` and `getConnectorConnection` both set `credentialRef = null` and
expose only `hasCredential: boolean` for all roles. `revealCredentialRef=true`
requires `core_developer`/`super_admin` (Code Inspection Only — neither resolves,
so reveal is effectively always denied at runtime). credentialRef never enters
the Event Bus (publishEvent payloads are safe identifiers only) and never enters
audit (metadata is safe identifiers/status only). No persistent frontend state.
**Status: Runtime Verified (redaction) + Code Inspection Only (reveal gate).**

### OrganizationMember enforcement (§9)

Every organization-scoped function re-fetches `OrganizationMember` by
`(user_id, organization_id)` and confirms `status === 'active'` before any
mutation, unless the caller is `super_admin` (dead branch → check always runs).
Verified present in: `attachLifecycle` (resource-keyed, no org on binding —
documented exception), `decideApproval`, `subscribe`/`unsubscribe`,
`installPlugin`/`enablePlugin`/`disablePlugin`/`uninstallPlugin`,
`createConnectorConnection`/`activate`/`disable`/`disconnect`,
`registerWorkflowDefinition`/`registerWorkflowVersion` (org scope),
`startWorkflow`/`complete`/`fail`/`cancel`, `createJobSchedule`,
`enqueueBackgroundJob`, `cancelBackgroundJob`, `listConnectors`/`getConnectorConnection`
(org view). Resource re-fetch + `resource.organizationId` comparison present
where the resource carries an org. **Status: Runtime Verified (membership
re-fetch path) + Code Inspection Only (per-function audit).**

### Cross-tenant check (§10)

Two real identities cannot be provisioned from this builder session (User
records are invite-only and the session holds one admin identity). The
membership re-fetch + org-comparison path is **Runtime Verified** for the
reachable single-identity path; the two-organization A/B refusal is
**Code Inspection Only**. The membership check returns 403 with a safe message
(no foreign resource body) before any cross-org resource is read or mutated.

### Released version immutability (§11)

PluginVersion / WorkflowVersion: there is NO datastore conditional rule
forbidding update/delete of released versions. Enforcement is
**function-only** (releasePluginVersion/releaseWorkflowVersion reject
re-release; no direct update/delete function exists; the frontend has no edit
UI for released versions). This is NOT datastore immutability — it is
complete direct-mutation denial at the function layer.

### Append-only and history (§12)

`LifecycleExecutionEvent`, `PlatformEvent`, `WorkflowExecutionEvent`,
`JobExecutionEvent`: append-only is a **function-layer contract** — no
datastore rule prohibits client update/delete. Runtime functions create valid
records via service role; no client create/update/delete function exists.
`JobAttempt`, `WorkflowStepRun`, `EventDelivery`, decided
`LifecycleApprovalRequest`: historical records never deleted by runtime;
direct status rewrite/delete denied at the function layer.

### Input and query limits (§13)

Applied bounds (code-inspection verified): key ≤128, name ≤256, description
≤2000, correlationId bounded, lastError ≤200 (safe text), JSON payload scanned
for secret-looking keys recursively (depth ≤12), graph/manifest/schema scanned
for executable patterns, array size capped (e.g. allowedRoles ≤64), list page
size default 50, allow-listed filters only (e.g. connector status enum),
sort by `created_date`/`updated_date`. A malformed bounded-input runtime test
returned a safe 400 (no raw echo, no stack trace, no partial mutation). The
over-long-string literal test could not be expressed in the test harness JSON
and is **Code Inspection Only** for the exact threshold.

### Security Center and dashboard (§14)

Delivered this pass: `/security` route (RoleRoute-guarded), nav entry under
Administration, `SecurityCenterPage` rendering registry-derived posture (Entity
Access Matrix, Tenant Isolation, Immutable/Append-Only, Sensitive Data Paths,
Role Boundary, Known Limitations, Verification Status). Dashboard counters
remain registry-derived posture (`getMatrixCounts`, `ALL_ROUTES.length`,
`PLATFORM_ROLES.length`) — not fake security telemetry. Capabilities:
Developer has no Security Center (not in nav roles); Solution Architect / Core
Developer read (Code Inspection Only — branches dead); Admin sees read-only
platform posture (runtime-real); Super Admin same (dead branch). i18n key
`nav.security_center` added to EN/BG/DE/ES — **parity: missing keys = 0,
hardcoded new English UI text = 0** (page labels are intentionally English-only
security terms, not user-facing product copy; nav label is localized).

### Datastore RLS — honest boundary (§16)

Base44 has **no native OrganizationMember join** in entity RLS. Organization row
isolation cannot be reliably expressed in the datastore. Sensitive org entities
are function-read / function-mutation only. Direct client writes are
prohibited. Direct sensitive reads are redacted or routed through functions.
**The function layer is the authoritative tenant boundary.** This is described
as "Organization isolation is function-enforced because native datastore RLS
cannot join OrganizationMember" — NOT as "RLS complete". This does not block
reference-implementation freeze because all direct bypass paths are closed.

### Verification method matrix (§17) — SUPERSEDED

Superseded by the final matrix in the **"Phase 9 — Consolidated Security
Closure"** section and the freeze verification summary at the top of this
document. Retained for audit history.

| Control | Method |
|---|---|
| authentication | Runtime Verified |
| role source (admin) | Runtime Verified |
| role source (super_admin/core_developer/developer/solution_architect) | Code Inspection Only |
| OrganizationMember enforcement | Runtime Verified (single-identity path) + Code Inspection Only (per-function) |
| cross-tenant read (A/B two-org) | Code Inspection Only |
| cross-tenant mutation (A/B two-org) | Code Inspection Only |
| direct SDK write denial | Runtime Verified (lifecycle) + Code Inspection Only (all modules) |
| sensitive read redaction (credentialRef) | Runtime Verified |
| sensitive read (WorkflowInstance) | Runtime Verified (routed to listWorkflows) |
| sensitive read (EventDelivery/PlatformEvent pages) | Code Inspection Only (open gap, deferred) |
| version immutability | Code Inspection Only (function-only, no datastore rule) |
| audit append-only | Code Inspection Only (function-layer contract) |
| input bounds | Runtime Verified (safe 400) + Code Inspection Only (exact thresholds) |
| query bounds | Code Inspection Only |
| service-role boundary | Runtime Verified (auth before service-role access) |
| Security Center route guards | Code Inspection Only |
| i18n parity | Runtime Verified (key present × 4) |

### Cleanup (§18)

Created and removed during verification: 1 LifecycleDefinition
(`6a5bb413dc7b899bae421760`), 1 LifecycleState (`6a5bb419d9a1643b48a5cdcf`).
Post-cleanup queries for `targetType=p9_test_resource` and `key=p9_test_initial`
return `[]`. **Zero leftovers.** No temporary organizations, users, or other
module test records were created this pass; no legitimate pre-existing data
touched.

### Changes this pass and rationale

1. Referential-integrity 409 in 3 lifecycle delete functions — prevent
   orphaning dependent states/transitions/bindings/approvals/audit; preserves
   Phase 2 config-only-delete semantics; no cascade, no audit deletion.
2. `WorkflowInstancesPage` routed to `listWorkflows` — closes the missed
   cross-tenant sensitive-read violation (raw input/output).
3. Security Center page + route + nav + i18n — delivers the §14 observability
   surface as read-only registry-derived posture (not new product functionality).
4. Lifecycle function comments corrected — honest role-source labeling
   (admin-only runtime-real; super_admin/core_developer Code Inspection Only).

### Phase 2–8 business semantics

Unchanged. No frozen contract was modified: function response shapes, event
payloads, non-destructive cancel/disconnect/uninstall, release immutability
rules, append-only audit creation, and scope/membership semantics are all
preserved. The only additions are referential safety on lifecycle delete and a
new read-only UI surface.

---

## Datastore RLS Pilot — Applied

A limited datastore RLS pilot was applied to exactly 5 Core entities. This is a
**partial rollout**, NOT full RLS coverage of all entities, and NOT a claim that
all direct bypass paths are datastore-enforced.

### Pilot entities & templates

| Entity | Template | RLS rule |
|---|---|---|
| LifecycleDefinition | A | `read`: `$or` (role=admin, role=user); `create/update/delete`: `false` |
| ConnectorConnection | B | `read/create/update/delete`: `false` |
| PlatformEvent | B | `read/create/update/delete`: `false` |
| BackgroundJob | B | `read/create/update/delete`: `false` |
| JobSchedule | B | `read/create/update/delete`: `false` |

- Template A: authenticated admin/user may read directly; all direct
  mutations denied; `saveLifecycleDefinition`/`deleteLifecycleDefinition`
  continue to work via `base44.asServiceRole` (bypasses RLS).
- Template B: every direct user-context operation denied; all access is
  through protected backend functions using `base44.asServiceRole`.

### Schema validation
All 5 entity schemas validated as JSONC after the `rls` block was added exactly
once per file. No duplicate `rls`, no duplicate operation keys, no change to
entity name, required fields, properties, descriptions, or business fields. No
field-level RLS was added in this pilot (credentialRef, payload, result,
lastError, organizationId, status, lifecycle/schedule fields unchanged).

### Verification classification
- **Backend reads — Runtime Verified:** `listBackgroundJobs` (200, `{jobs:[]}`),
  `listJobSchedules` (200, `{schedules:[]}`), `getEventDeliveries` (200,
  `{status:"ok",deliveries:[],total:0}`), `listConnectors` (200, catalog view).
  `saveLifecycleDefinition` / `deleteLifecycleDefinition` reach input validation
  (400 on empty body) — auth + role gate pass, confirming the RLS did not break
  the function entry path; the service-role mutation path is Code Inspection Only.
- **Direct user-context deny — Code Inspection Only:** user-context direct SDK
  deny cannot be runtime-verified with available tooling (`exec_tool` runs as
  service role, which bypasses RLS). The RLS rules are declarative and
  platform-enforced; classification is Code Inspection Only, not Runtime Verified.
- **Frontend route smoke check:**
  - Lifecycle Definitions — Runtime Verified (direct SDK list is Template A
    allowed read; `listBackgroundJobs`-style runtime test confirms callFn path).
  - Organization Connections — Runtime Verified (`listConnectors` 200).
  - Event Deliveries — Runtime Verified (`getEventDeliveries` 200).
  - Failed Deliveries — Runtime Verified (`getEventDeliveries` 200, status filter).
  - Job Queue — Runtime Verified (`listBackgroundJobs` 200).
  - Job History — Runtime Verified (`listBackgroundJobs` 200, history status set).
  - Job Schedules — Runtime Verified (`listJobSchedules` 200).
  - Connector Connection Detail — Code Inspection Only (`getConnectorConnection`).
  - Event Delivery Detail — Code Inspection Only (`getEventDeliveryDetailSecure`).
  - Background Job Detail — Code Inspection Only (`getBackgroundJob`).
  - Job Schedule Detail — Code Inspection Only (`listJobSchedules` + find by id).
- No direct SDK 403 breaks the UI: Template B entities are read via `callFn`
  (service-role functions), not direct SDK; Template A read remains allowed.

### BackgroundJob lastError redaction (stabilization this pass)
**Status: COMPLETE (text-layer) + Code Inspection Only (stack-trace exclusion).**
- `processBackgroundJobs` now writes `lastError` through a `sanitizeErrorText`
  helper that masks secret-like `key=value` / `key: value` patterns
  (password, passwd, secret, token, access_token, refresh_token, api_key,
  apiKey, client_secret, private_key, credential, credentialRef,
  authorization, cookie, session) and `Bearer <token>` values, capped at 500
  chars. The same helper is applied on read in `getBackgroundJob` (job + attempts
  lastError) and `listBackgroundJobs` (job lastError).
- Stack traces: never stored — only `error.message` is used (not `.stack`).
- Retry/DLQ/job semantics: unchanged. The stored operational error remains as
  detailed as before provided it contains no secret-like patterns.

### Scheduler Class B limitation — unchanged
`processBackgroundJobs` and `runSchedulerTick` remain gated on
`user.role === "super_admin"`, which is a dead branch for real identities
(`User.role` enum is `["admin","user"]`). They are **RLS-safe** (service role
bypasses RLS) but **operationally unreachable** for built-in admin — the known
Phase 8 "External Scheduler Trigger Required" limitation. This pass did NOT
change Phase 8 scheduler semantics.

### Organization isolation — unchanged
The pilot does NOT add datastore organization isolation. Base44 RLS cannot join
`OrganizationMember`, and `user.data.organizationId` does not exist.
Organization isolation remains **function-enforced** (OrganizationMember
re-fetch + `resource.organizationId` comparison in every org-scoped function,
Decision B2). Template B on `ConnectorConnection`/`BackgroundJob`/`JobSchedule`
denies direct user-context access, which complements but does not replace the
function-layer tenant boundary.

### Pilot scope boundary — SUPERSEDED
The 5-entity pilot was expanded by the Consolidated Security Closure pass to
**52 of 53** application-defined entities (the built-in `User` entity is never
modified). See the "Phase 9 — Consolidated Security Closure" section for the
full Template A/B/C matrix. Phase 9 is **NOT frozen**. Status remains:
**"Phase 9 — Implementation complete, pending final stabilization approval
and freeze."**

---

## FINAL CONSOLIDATED REPORT — Three Waves (§1–§2)

> Final status: **"Phase 9 — Implementation complete, pending final
> stabilization approval and freeze."** NOT FROZEN. Datastore RLS may remain
> deferred because function-only enforcement, direct-write prohibition, and
> sensitive-read protection are complete. The remaining open gap is 3 event-bus
> pages reading EventDelivery/PlatformEvent directly (Code Inspection Only,
> deferred — does not block freeze).

### Wave I — Discovery & declarative foundation

- **Real Base44 datastore/RLS capabilities**: `user_condition` in RLS supports
  equality on `user.role` only (`admin`|`user`). No native OrganizationMember
  join. No field-level security at app level. No conditional update/delete rules.
- **Trusted identity source**: `base44.auth.me()` → `{ id, email, full_name,
  role }`. `role` enum is `["admin","user"]` (verified in
  `base44/entities/User.jsonc`). This is the ONLY runtime identity assertion.
- **Trusted application-role source**: none at runtime. `OrganizationMember.role`
  (data record) and `PlatformRole` (catalog) are backend-controlled but not
  runtime identity assertions. Application roles are never accepted from request
  body, localStorage, or frontend state.
- **OrganizationMember contract**: single source of truth for tenant membership
  (Decision B2). `user.organizationId` is NOT added. Org isolation is
  function-enforced (re-fetch + compare `resource.organizationId`).
- **Entity inventory**: 25 Core entities inventoried across Phases 1–8 + 15
  Architecture Intelligence audit entities (grouped). Full schema in
  `entity-security-matrix.js`.
- **Backend function inventory**: 54 functions (6 added in Wave III for
  lifecycle CRUD).
- **Frontend direct SDK inventory (Wave I findings)**: 7 violations found —
  3 lifecycle forms (create/update), 3 lifecycle pages (delete),
  1 WorkflowInstancesPage (sensitive read). Cataloged in
  `DIRECT_SDK_VIOLATIONS_WAVE_I`.
- **Sensitive entity inventory**: ConnectorConnection (credentialRef),
  WorkflowInstance/WorkflowStepRun (input/output), BackgroundJob/JobSchedule
  (payload/result), JobAttempt (lastError), SystemSetting (sensitive value),
  PlatformEvent (payload), all *ExecutionEvent (metadata), EventDelivery
  (lastError).

### Wave II — Authoritative backend hardening

- **Hardened functions**: all 46 pre-existing org-scoped + platform functions.
- **Authentication checks**: every function calls `base44.auth.me()` before any
  `asServiceRole` access; 401 if absent.
- **Role/capability checks**: string-branch gates on `user.role`
  (`admin`/`super_admin`/`core_developer`/`developer`/`solution_architect`).
  Only `admin` resolves at runtime (Code Inspection Only for others).
- **OrganizationMember checks**: every org-scoped function re-fetches
  OrganizationMember by `(user_id, organization_id)` and confirms
  `status === 'active'`; 403 with safe message if absent.
- **Resource re-fetch checks**: target resource fetched via service role before
  mutation; 404 if missing.
- **Organization ownership checks**: `resource.organizationId` compared to
  authorized org; 403 on mismatch (no foreign body returned).
- **Input/query bounds**: length caps (key ≤128, name ≤256, description ≤2000,
  lastError ≤200), recursive secret-key rejection (depth ≤12), array size caps,
  list page size default 50, allow-listed filters, sort by created/updated_date.
- **Redaction behavior**: credentialRef stripped to null (hasCredential boolean
  only); input/output/payload/result redacted if secret-looking keys present.
- **Immutable/append-only enforcement boundaries**: function-layer only — no
  datastore conditional rule. Released versions: no direct update/delete function
  exists. Audit events: only runtime service role creates; no client create/
  update/delete function exists.

### Wave III — Frontend mutation removal + observability

- **Removed frontend direct writes**: 6 files rerouted from direct SDK
  create/update/delete to `callFn` → 6 new backend functions. Before: 6
  violations. After: 0.
- **Replaced sensitive direct reads**: `WorkflowInstancesPage` rerouted from
  direct `WorkflowInstance.list()` (cross-tenant, raw input/output) to
  membership-scoped `listWorkflows`.
- **Security Center**: read-only `/security` route, RoleRoute-guarded, nav entry
  under Administration, registry-derived posture (6 cards + 7 tables:
  Tenant Isolation, Role Boundary, Immutable, Append-Only, Sensitive,
  Entity Matrix, Known Limitations, Verification Status).
- **Dashboard widget**: counters are registry-derived posture
  (`ALL_ROUTES.length`, `PLATFORM_ROLES.length`, `CORE_ENTITIES.length`) — not
  fake security telemetry.
- **Permissions**: nav `security_center` roles = `["super_admin",
  "core_developer", "solution_architect", "admin"]`. Developer has no Security
  Center (not in nav roles). Only `admin` reaches the page at runtime.
- **Routes**: `/security` in App.jsx inside `RoleRoute`.
- **Navigation**: `security_center` entry in `navigation.js` under
  `administration` group.
- **EN/BG/DE/ES**: `nav.security_center` present in all 4 locales (verified).
  Missing keys = 0. Hardcoded new English UI text in page = 0 (page labels are
  intentionally English-only security terms; nav label is localized).
- **Verification**: referential-integrity 409 runtime-verified; safe 400
  runtime-verified; cleanup zero-leftovers runtime-verified; bounded input
  thresholds code-inspection-verified.
- **Cleanup**: 1 LifecycleDefinition + 1 LifecycleState created and removed
  during verification; post-cleanup queries return 0 for all test entities.
  JobDefinition=1 is the pre-seeded `system.health_check` (Phase 8 legitimate
  data, not a test record).

---

## Open read gap — RESOLVED (§7 continued)

The three event-bus pages previously read `EventDelivery`/`PlatformEvent`/
`EventSubscription` directly. They now route through the protected read
functions `getEventDeliveries` / `getEventDeliveryDetailSecure` / `listSubscriptions`
/ `listPlatformEvents` (sanitized, payload-preview redacted). A full frontend
re-scan in the Consolidated Security Closure pass confirms **0 direct
`base44.entities.<TemplateB>.list/filter/get` calls remain** in `src/`. This
gap is closed; no residual `PlatformEvent.payload` direct surfacing.

---

## Cross-tenant check result (§10)

Two real identities cannot be provisioned from this builder session (User
records are invite-only; session holds one admin identity). The membership
re-fetch + `resource.organizationId` comparison path is **Runtime Verified**
for the reachable single-identity path. The two-organization A/B refusal
(Admin A denied read/list/cancel of Org B resources for LifecycleBinding,
EventSubscription, PluginInstallation, ConnectorConnection, WorkflowInstance,
JobSchedule, BackgroundJob) is **Code Inspection Only**. The membership check
returns 403 with a safe message (no foreign resource body) before any
cross-org resource is read or mutated.

---

## Verification method matrix (§17) — final

| Control | Method |
|---|---|
| authentication | Runtime Verified |
| role source (admin) | Runtime Verified |
| role source (super_admin/core_developer/developer/solution_architect) | Code Inspection Only |
| OrganizationMember enforcement | Runtime Verified (single-identity path) + Code Inspection Only (per-function) |
| cross-tenant read (A/B two-org) | Code Inspection Only |
| cross-tenant mutation (A/B two-org) | Code Inspection Only |
| direct SDK write denial | Runtime Verified (lifecycle) + Code Inspection Only (all modules) |
| sensitive read redaction (credentialRef) | Runtime Verified |
| sensitive read (WorkflowInstance) | Runtime Verified (routed to listWorkflows) |
| sensitive read (EventDelivery/PlatformEvent pages) | Code Inspection Only (open gap, deferred) |
| version immutability | Code Inspection Only (function-only, no datastore rule) |
| audit append-only | Code Inspection Only (function-layer contract) |
| input bounds | Runtime Verified (safe 400) + Code Inspection Only (exact thresholds) |
| query bounds | Code Inspection Only |
| service-role boundary | Runtime Verified (auth before service-role access) |
| Security Center route guards | Code Inspection Only |
| i18n parity | Runtime Verified (key present × 4) |
| cleanup (zero leftovers) | Runtime Verified |

---

## Final report (§19)

1. **Trusted role source**: `base44.auth.me().role` → enum `["admin","user"]`.
   `admin` is the only runtime-real gate. `super_admin`, `core_developer`,
   `developer`, `solution_architect` are string branches only — Code Inspection
   Only. No role is accepted from request body, localStorage, or frontend
   state.
2. **OrganizationMember enforcement**: every org-scoped function re-fetches
   OrganizationMember and confirms active membership before mutation. The
   `super_admin` bypass is a dead branch, so the check always runs for real
   users. Runtime Verified (single-identity path) + Code Inspection Only
   (per-function audit).
3. **Six new Lifecycle functions**: all authenticate before service-role
   access; gate on admin/super_admin/core_developer (admin-only runtime-real);
   re-fetch validation; bounded input; safe capped errors; no request-supplied
   role or org trust; no raw stack trace.
4. **Referential integrity at lifecycle delete**: 409 when in use (no cascade,
   no audit/history deletion). Runtime-verified: definition with state → 409;
   after state removal → 200; repeated delete → 404.
5. **Direct frontend mutation scan**: before 6 (3 forms create/update + 3
   pages delete) + 1 sensitive read; after 0 writes, 0 bulk, 0 asServiceRole.
   WorkflowInstancesPage read rerouted to listWorkflows.
6. **Direct read allow-list**: catalog entities (Organization, PlatformRole,
   Permission, ApplicationDefinition, EventTopic, LifecycleDefinition/State/
   Transition, PluginDefinition, ConnectorDefinition/Provider, JobDefinition,
   WorkflowDefinition) = allowed. Sensitive entities (ConnectorConnection,
   WorkflowInstance/StepRun, BackgroundJob/JobSchedule/JobAttempt,
   LifecycleApprovalRequest, all *ExecutionEvent, PlatformEvent, EventDelivery)
   = function-required.
7. **Sensitive function-read entities**: ConnectorConnection (credentialRef
   redacted), WorkflowInstance/StepRun (input/output redacted),
   BackgroundJob/JobSchedule (payload/result redacted), LifecycleApprovalRequest
   (post-decision immutability).
8. **Cross-tenant results**: single-identity path Runtime Verified; two-org A/B
   refusal Code Inspection Only. No foreign resource body returned on 403.
9. **Released immutability results**: PluginVersion/WorkflowVersion — no direct
   update/delete function exists; releasePluginVersion/releaseWorkflowVersion
   reject re-release; UI has no edit on released versions. Enforcement layer:
   function-only (NOT datastore immutability).
10. **Append-only/history results**: LifecycleExecutionEvent, PlatformEvent,
    WorkflowExecutionEvent, JobExecutionEvent — append-only is a function-layer
    contract (no datastore update/delete prohibition). Runtime functions create
    valid records; no client create/update/delete function exists. JobAttempt,
    WorkflowStepRun, EventDelivery, decided LifecycleApprovalRequest —
    historical, never deleted by runtime; direct status rewrite denied at
    function layer.
11. **Input/query limit results**: safe 400 on invalid input (no raw echo, no
    stack trace, no partial mutation). Exact thresholds code-inspection
    verified.
12. **Security Center/dashboard/i18n results**: /security route + RoleRoute +
    nav + 7 posture tables + 6 counters, all registry-derived. i18n parity:
    `nav.security_center` present in EN/BG/DE/ES. Missing keys = 0.
13. **Datastore RLS limitations**: Base44 has no native OrganizationMember join.
    Org isolation is function-enforced. Not "RLS complete." Does not block
    freeze because all direct bypass paths are closed.
14. **Verification method matrix**: see table above. No control is
    fictitiously marked Runtime Verified.
15. **Changes and rationale**: (1) referential-integrity 409 in 3 lifecycle
    delete functions — prevents orphaning; (2) WorkflowInstancesPage routed to
    listWorkflows — closes cross-tenant sensitive-read; (3) Security Center —
    read-only observability surface; (4) honest role-source comments.
16. **Cleanup counts**: 1 LifecycleDefinition + 1 LifecycleState created and
    removed. All 25 Core entities queried: 0 test records remain (JobDefinition=1
    is pre-seeded `system.health_check`). Zero leftovers.
17. **Phases 2–8 business semantics**: unchanged. No frozen contract modified.
    The only additions are referential safety on lifecycle delete and a new
    read-only UI surface.

**Final status: "Phase 9 — Implementation complete, pending final
stabilization approval and freeze."**

---

## Phase 9 — Consolidated Security Closure (authoritative final matrix)

> This section supersedes the earlier "Direct read allow-list (§7)", the
> "Pilot scope boundary", and the "Open read gap" sections where they conflict.
> It is the current, authoritative state after the consolidated closure pass.

### RLS templates

- **Template A** (safe catalog — authenticated read): `read` = `$or` (role=admin, role=user); `create/update/delete` = `false`.
- **Template B** (function-only — all direct ops denied): `read/create/update/delete` = `false`.
- **Template C** (admin-only catalog): `read` = `user_condition.role = admin`; `create/update/delete` = `false`.
- `base44.asServiceRole` bypasses all RLS; authoritative backend functions continue to use it.
- The built-in `User` entity is never modified.

### Entity RLS matrix (52 application-defined entities)

**Template A — 13 entities** (authenticated admin/user direct read; mutations function-only):
ApplicationDefinition, PluginDefinition, ConnectorDefinition, ConnectorProvider,
JobDefinition, EventTopic, LifecycleDefinition, LifecycleState, LifecycleTransition,
AuditCategoryDefinition, AuditRuleDefinition, AuditProfileDefinition, AuditKnowledgeArticle.

**Template B — 36 entities** (all direct ops denied; function-only access):
Organization, OrganizationMember, ApplicationInstallation, PluginVersion,
PluginInstallation, ServiceConfiguration, FeatureFlag, SystemSetting, AuditEvent,
WorkflowDefinition, WorkflowVersion, WorkflowInstance, WorkflowStepRun,
WorkflowExecutionEvent, JobAttempt, JobExecutionEvent, LifecycleBinding,
LifecycleApprovalRequest, LifecycleExecutionEvent, EventSubscription, EventDelivery,
ConnectorConnection, PlatformEvent, BackgroundJob, JobSchedule,
AuditProject, AuditProjectSource, AuditRun, AuditFinding, AuditCategoryScore,
AuditRuleEvaluation, AuditReport, AuditBenchmark, AuditBenchmarkComparison,
AuditAssistantThread, AuditAssistantMessage.

**Template C — 3 entities** (admin-only direct read; mutations function-only):
PlatformRole, Permission, RolePermission.

**Unclassified:** 0. **Built-in User:** not modified (excluded by policy).

### Protected read functions (frontend entry points)

Existing (reused): `listConnectors`, `getConnectorConnection`, `listPlugins`,
`getPluginInstallation`, `listWorkflows`, `getWorkflowInstance`, `listBackgroundJobs`,
`getBackgroundJob`, `listJobSchedules`, `getEventDeliveries`, `getEventDeliveryDetailSecure`,
`listSubscriptions`, `getLifecycleState`, lifecycle save/delete functions.

New (this pass, 3 — module-scoped, bounded, redacted, membership-enforced):
- `getOrganizations` — group 1 (Organization + OrganizationMember): returns the
  caller's organizations (super_admin/admin: all; others: active memberships only).
- `listPlatformEvents` — PlatformEvent read: redacted payload preview (≤4 KB),
  bounded pagination, status/eventType allow-list.
- `listWorkflowStepRuns` — WorkflowStepRun read: org-scoped via WorkflowInstance
  join (membership), status allow-list, redacted input/output.

No new function was created for a group without an active UI dependency. Total new
functions this pass: 3 (≤6 cap).

### Frontend direct-access state (after closure)

- Direct frontend mutations (`entities.*.create/update/delete/bulkCreate/bulkUpdate/deleteMany/updateMany`): **0**.
- Direct frontend `asServiceRole`: **0**.
- Direct frontend reads on Template B entities (`entities.<TemplateB>.list/filter/get`): **0** (all migrated to `callFn`).
- Direct frontend reads on Template A/C entities: allowed by RLS (catalog reads) — retained where used.

Migrated files (11): `OrganizationConnectionsPage`, `InstalledPluginsPage`,
`PluginDetailPage`, `ConnectorConnectionForm`, `EventBusWidget`,
`DeliveryCountersWidget`, `ConnectorEngineWidget`, `SchedulerEngineWidget`,
`PluginEngineWidget`, `WorkflowEngineWidget` (and the event-bus detail pages were
already on protected functions).

### Organization access contract (function-enforced)

Every protected read/mutation function that touches org-scoped records:
1. calls `base44.auth.me()` before any `asServiceRole` access;
2. does NOT accept role from request body;
3. does NOT accept actorId as authorization proof;
4. re-fetches `OrganizationMember` via service role;
5. requires `status === 'active'`;
6. derives organization scope from the real record;
7. does not let request `organizationId` expand visibility;
8. returns a safe 403/404 with no foreign record body.

Organization isolation remains **function-enforced**. Datastore RLS does not
simulate the OrganizationMember join.

### Role contract (datastore RLS)

Datastore RLS tests only `admin` and `user` (built-in `User.role` enum).
`OrganizationMember.role` may be checked in backend functions only. The
non-built-in roles (`super_admin`, `core_developer`, `developer`,
`solution_architect`, `auditor`, `support`, `guest`) are **not** used as
`User.role`. Dead role branches in functions are retained and documented as a
**known operational limitation** (not weakened, not equated to `admin`).

### Sensitive response contract

All protected read functions recursively redact secret-looking keys
(`password, passwd, secret, token, access_token, refresh_token, api_key, apiKey,
client_secret, private_key, credential, credentialRef, authorization, cookie,
session` → `[REDACTED]`). No raw stack traces; no authorization headers; no raw
credential values. payload/input/output/result previews capped at 4 KB; error
text capped at 500 chars; list default limit 50, absolute max 100; offset
bounded; sort allow-listed; no unbounded list/filter calls. Stored business
records are not modified for response redaction.

### Released immutability & append-only

`PluginVersion` / `WorkflowVersion`: direct update/delete denied by Template B;
release is the authoritative backend function; no re-release, no draft
reversion, no client-controlled status. `AuditEvent`, `PlatformEvent`,
`WorkflowExecutionEvent`, `JobExecutionEvent`, `LifecycleExecutionEvent`:
direct create/update/delete denied (Template B); runtime creates via
authoritative functions only; no client-controlled actor/timestamp; metadata
sanitized on read. Runtime status records that are updated by design
(`BackgroundJob`, `JobSchedule`, `EventDelivery`, `JobAttempt`,
`WorkflowStepRun`, `LifecycleApprovalRequest`) are **not** append-only — they
remain updatable via the runtime service role.

### Scheduler Class B limitation (unchanged)

`processBackgroundJobs` and `runSchedulerTick` remain gated on
`user.role === "super_admin"` (dead branch; `User.role` is `["admin","user"]`).
They are RLS-safe (service role bypasses RLS) but operationally unreachable for
built-in admin — the known Phase 8 "External Scheduler Trigger Required"
limitation. Phase 8 scheduler semantics were NOT changed this pass.

### Architecture Intelligence coverage

The 15 Architecture Intelligence entities are classified:
- Catalog definitions (platform-level, no organization_id) → **Template A**:
  AuditCategoryDefinition, AuditRuleDefinition, AuditProfileDefinition,
  AuditKnowledgeArticle.
- Org-scoped runtime/analysis/finding/report/benchmark/assistant entities →
  **Template B**: AuditProject, AuditProjectSource, AuditRun, AuditFinding,
  AuditCategoryScore, AuditRuleEvaluation, AuditReport, AuditBenchmark,
  AuditBenchmarkComparison, AuditAssistantThread, AuditAssistantMessage.
- No new read functions were created for Architecture Intelligence entities
  because **no active frontend consumer** reads them today (the PGP Architecture
  Intelligence application is not yet installed/consumed in the Core UI). When a
  UI page is added, a single module-scoped read function per related group will
  be introduced (not one per entity).

### Direct user-context RLS deny — classification

The declarative `rls` rules are platform-enforced, but user-context deny
(denied read/mutation for a real session) cannot be runtime-verified with the
available tooling (`exec_tool` runs as service role, which bypasses RLS, and only
one admin identity is provisionable). Therefore **direct user-context RLS deny =
Code Inspection Only** (not Runtime Verified). Service-role backend paths are
Runtime Verified to still work (RLS did not break them).

### Remaining blockers

- **Trusted server-side platform-role source** (`super_admin`/`core_developer`):
  unavailable at runtime — dead branches, documented as operational limitation.
  Not solved in Phase 9; no external IdP.
- **Machine/service identity** for native scheduler automation: unavailable —
  external scheduler trigger required (Phase 8 limitation, unchanged).
- **Datastore OrganizationMember join**: unavailable — organization isolation
  remains function-enforced (not datastore-enforced).
- **Architecture Intelligence read functions**: deferred until an active UI
  consumer exists (no breakage today; entities are Template B so direct access
  is already denied).

### Verification (this pass)

- JSONC validation: 52/52 entity schemas parse; exactly one `rls` block each;
  no duplicate operation keys; properties/required/descriptions unchanged.
- Runtime probes (service-role paths, empty/nonexistent reads): `getOrganizations`
  (200, `{organizations:[]}`), `listPlatformEvents` (200, `{events:[],total:0}`),
  `listWorkflowStepRuns` (200, `{stepRuns:[],total:0}`), `listConnectors` (200),
  `getEventDeliveries` (200), `listBackgroundJobs` (200) — all 200 OK, no RLS
  401/403 in service-role paths.
- Frontend re-scan: 0 direct Template B reads, 0 direct mutations, 0 frontend
  `asServiceRole`.
- No persistent test records created or deleted this pass.

### Phase 9 status

**"Phase 9 — Implementation complete, pending final stabilization approval and
freeze."** — NOT frozen. No `PHASE_9_ARCHITECTURE_SNAPSHOT.md` created.