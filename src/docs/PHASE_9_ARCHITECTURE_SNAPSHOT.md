# PGP Core — Phase 9 Architecture Snapshot (FROZEN)

> **Status: Phase 9 — FROZEN.** Freeze date: 2026-07-18.
> Authoritative, concise snapshot of the security-hardened PGP Core platform
> foundation as of Phase 9 freeze. Does not duplicate the working
> `SECURITY_RLS_HARDENING_SPEC.md`; that spec is the live record.
> Phase 2–8 snapshots are NOT modified by this file.

---

## 1. Phase 9 scope

Phase 9 hardened the existing PGP Core only. It did NOT add a new business
engine, a `member` role, OAuth/IdP integration, a secrets manager, a custom
encryption layer, arbitrary code execution, execution handlers, distributed
locks, datastore migration beyond supported Base44 capabilities, or a
self-hosted runtime.

Phase 9 deliverables: datastore RLS on all application-defined entities,
function-only mutation contract, protected read contract, frontend
direct-access closure, Security Center observability surface, and this
snapshot.

---

## 2. Runtime-real role model

`base44.auth.me()` returns `{ id, email, full_name, role }`. The built-in
`User.role` enum is **`["admin", "user"]`** (verified in
`base44/entities/User.jsonc`). These are the only roles datastore RLS can test
via `user_condition.role`.

| Role | Runtime source | Status |
|---|---|---|
| `admin` | built-in `User.role` | **Runtime Verified** — the only privileged gate that resolves |
| `user` | built-in `User.role` | runtime-real; denied by admin-only gates |
| `super_admin` | none (string branch) | **Code Inspection Only** (dead branch) |
| `core_developer` | none (string branch) | **Code Inspection Only** (dead branch) |
| `developer` | none (string branch) | **Code Inspection Only** (dead branch) |
| `solution_architect` | none (string branch) | **Code Inspection Only** (dead branch) |

`OrganizationMember.role` and `PlatformRole` are backend-controlled data
records/catalogs — NOT runtime identity assertions. Roles are never accepted
from request body, localStorage, or frontend state.

---

## 3. Organization isolation contract

- `OrganizationMember` is the single source of truth for tenant membership.
- `user.organizationId` is NOT added (no second parallel membership model;
  preserves future multi-org support).
- Datastore org RLS via `data.organizationId: "{{user.data.organizationId}}"`
  is NOT available — users have no org field and datastore RLS cannot join
  `OrganizationMember`.
- **Enforcement layer: Function Enforced.** Every org-scoped backend
  function: `auth.me()` → role gate → re-fetch `OrganizationMember` (service
  role) → require `status === 'active'` → re-fetch target resource → compare
  `resource.organizationId` → only then read/mutate. Request-body
  `organizationId` never expands visibility.

---

## 4. Template A / B / C definitions

- **Template A** (safe catalog — authenticated read): `read` = `$or`
  (role=admin, role=user); `create/update/delete` = `false`. Mutations through
  authoritative backend functions via `base44.asServiceRole`.
- **Template B** (function-only — all direct ops denied):
  `read/create/update/delete` = `false`. All access through protected backend
  functions using `base44.asServiceRole`.
- **Template C** (admin-only catalog): `read` = `user_condition.role = admin`;
  `create/update/delete` = `false`.
- `base44.asServiceRole` bypasses all RLS (trusted backend code only).
- The built-in `User` entity is never modified.

---

## 5. Entity-to-template matrix (52 application-defined entities)

**Template A — 13:** ApplicationDefinition, PluginDefinition,
ConnectorDefinition, ConnectorProvider, JobDefinition, EventTopic,
LifecycleDefinition, LifecycleState, LifecycleTransition,
AuditCategoryDefinition, AuditRuleDefinition, AuditProfileDefinition,
AuditKnowledgeArticle.

**Template B — 36:** Organization, OrganizationMember, ApplicationInstallation,
PluginVersion, PluginInstallation, ServiceConfiguration, FeatureFlag,
SystemSetting, AuditEvent, WorkflowDefinition, WorkflowVersion,
WorkflowInstance, WorkflowStepRun, WorkflowExecutionEvent, JobAttempt,
JobExecutionEvent, LifecycleBinding, LifecycleApprovalRequest,
LifecycleExecutionEvent, EventSubscription, EventDelivery,
ConnectorConnection, PlatformEvent, BackgroundJob, JobSchedule, AuditProject,
AuditProjectSource, AuditRun, AuditFinding, AuditCategoryScore,
AuditRuleEvaluation, AuditReport, AuditBenchmark, AuditBenchmarkComparison,
AuditAssistantThread, AuditAssistantMessage.

**Template C — 3:** PlatformRole, Permission, RolePermission.

**Totals:** 13 + 36 + 3 = 52. Unclassified = 0. Missing/duplicate = 0.

---

## 6. Function-only mutation contract

Direct frontend `base44.entities.*.create/update/delete/bulkCreate/bulkUpdate/
updateMany/deleteMany` = **0**. Every business mutation passes through an
authoritative backend function that re-fetches the resource via service role
and compares the real scope before mutating. UI capability checks are hints,
not enforcement. No request-body role, organizationId, status, ownerId, or
client-side hidden button is trusted. Frozen Phase 2–8 business contracts
(transitions, idempotency, event payloads, non-destructive cancel/uninstall,
release immutability, append-only audit creation) are preserved.

---

## 7. Protected read contract

Template B entities are never read directly by the frontend; all reads go
through protected functions (existing + 3 new this pass):

- Existing (reused): `listConnectors`, `getConnectorConnection`, `listPlugins`,
  `getPluginInstallation`, `listWorkflows`, `getWorkflowInstance`,
  `listBackgroundJobs`, `getBackgroundJob`, `listJobSchedules`,
  `getEventDeliveries`, `getEventDeliveryDetailSecure`, `listSubscriptions`,
  `getLifecycleState`, and the lifecycle save/delete functions.
- New this pass (module-scoped): `getOrganizations` (Organization +
  OrganizationMember), `listPlatformEvents` (PlatformEvent),
  `listWorkflowStepRuns` (WorkflowStepRun).

Each function authenticates before any `asServiceRole` access, applies an
allow-listed filter set, bounded pagination (default 50, max 100), and
returns redacted records.

---

## 8. Sensitive redaction contract

Recursive redaction of secret-looking keys (password, passwd, secret, token,
access_token, refresh_token, api_key, apiKey, client_secret, private_key,
credential, credentialRef, authorization, cookie, session → `[REDACTED]`).
`ConnectorConnection.credentialRef` is never returned (only `hasCredential:
boolean`; `revealCredentialRef` requires dead `core_developer`/`super_admin`
branches). payload/input/output/result previews capped at 4 KB; error text
capped at 500 chars; no raw stack traces, authorization headers, or raw
credential values. Stored business records are not modified for response
redaction.

---

## 9. Released immutability

`PluginVersion` / `WorkflowVersion`: direct update/delete denied by Template
B; release is the authoritative backend function; no re-release, no draft
reversion, no client-controlled status. This is a function-layer access
boundary (no datastore conditional-immutability rule exists).

---

## 10. Append-only history / event contract

`AuditEvent`, `PlatformEvent`, `WorkflowExecutionEvent`, `JobExecutionEvent`,
`LifecycleExecutionEvent`: direct create/update/delete denied (Template B);
runtime creates via authoritative functions only; no client-controlled
actor/timestamp; metadata sanitized on read. Runtime status records updated by
design (`BackgroundJob`, `JobSchedule`, `EventDelivery`, `JobAttempt`,
`WorkflowStepRun`, `LifecycleApprovalRequest`) are NOT append-only — they
remain updatable via the runtime service role.

---

## 11. Query / input bounds

- Length caps: key ≤ 128, name ≤ 256, description ≤ 2000, correlationId
  bounded, lastError ≤ 500 (safe text).
- Object nesting depth ≤ 12 for recursive secret-key scan.
- Declarative config (graph/manifest/schema) scanned for executable patterns;
  no `eval`, `new Function`, `require(`, `import(`, `process.env`, `<script`,
  `javascript:`, shell patterns.
- List page size default 50, absolute max 100; negatives rejected; oversized
  clamped/rejected. Sort by `created_date`/`updated_date`. Allow-listed
  filters only. No unbounded `list`/`filter` calls. No cursor contract.

---

## 12. Security Center contract

- Route `/security` (RoleRoute-guarded); read-only.
- Registry-derived posture (Entity Access Matrix, Tenant Isolation,
  Immutable/Append-Only, Sensitive Data Paths, Role Boundary, Known
  Limitations, Verification Status). Not new product functionality; not fake
  telemetry.
- Nav roles: `super_admin`, `core_developer`, `solution_architect`, `admin`.
  Developer has no access. Only `admin` reaches the page at runtime.
- i18n `nav.security_center` present in EN/BG/DE/ES (parity: missing keys = 0).

---

## 13. Verification summary

- **Entity RLS:** 52/52 valid blocks, exactly one per file; 0 duplicate, 0
  missing, 0 unclassified, 0 invalid JSONC.
- **Frontend:** 0 direct mutations; 0 `asServiceRole`; 0 Template B direct
  reads.
- **Runtime probes (service-role paths):** `getOrganizations`,
  `listPlatformEvents`, `listWorkflowStepRuns`, `listConnectors`,
  `getEventDeliveries`, `listBackgroundJobs` — all 200 OK, no RLS 401/403 in
  service-role paths.
- **Direct user-context RLS deny:** Code Inspection Only (cannot be runtime-
  tested; `exec_tool` runs as service role; one admin identity provisionable).
- **Persistent test records:** 0 created/0 deleted this pass.
- **Dead role branches:** retained and documented, not weakened, not equated
  to `admin`.

---

## 14. Known limitations (not freeze blockers)

- Built-in `User.role` supports only `admin`/`user`. `super_admin`,
  `core_developer`, `developer`, `solution_architect` are dead runtime
  branches (Code Inspection Only).
- Scheduler remains Phase 8 Class B and requires an external trigger
  (`processBackgroundJobs` / `runSchedulerTick` gated on dead `super_admin`).
- OrganizationMember isolation is function-enforced; datastore RLS cannot join
  OrganizationMember.
- Trusted service actorId boundary is a documented limitation (no machine/
  service identity for native automation).
- Direct user-context RLS deny is Code Inspection Only.
- Architecture Intelligence read functions are deferred (no active UI consumer;
  entities are Template B so direct access is already denied).

These are documented limitations, not implemented features.

---

## 15. Frozen contracts and files

- **Frozen business contracts:** Phase 2–8 engine semantics, status
  transitions, event payloads, non-destructive cancel/uninstall, release
  immutability, append-only audit creation, scope/membership semantics,
  Phase 8 scheduler semantics.
- **Frozen snapshots:** `PHASE_2`–`PHASE_8` architecture snapshots are
  unchanged.
- **Working spec:** `src/docs/SECURITY_RLS_HARDENING_SPEC.md` status set to
  "Phase 9 — FROZEN." Future changes to RLS, the function-only mutation
  contract, or the protected-read contract require a new Phase / change
  record.

---

## 16. Explicit out-of-scope items

- A new business engine.
- A `member` role.
- OAuth / external IdP integration / trusted platform-role source.
- A secrets manager or custom encryption layer.
- Arbitrary code execution / execution handlers (workflow, connector,
  plugin).
- Distributed locking / exactly-once guarantees.
- Datastore migration beyond supported Base44 capabilities.
- A self-hosted runtime.
- Datastore OrganizationMember join / datastore org isolation.
- Native scheduler automation wiring (ops task).
- Per-entity Architecture Intelligence read functions (deferred).