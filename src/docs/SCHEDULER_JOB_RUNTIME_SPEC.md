# Scheduler and Background Job Runtime — Phase 8 Specification

> **Status:** Implementation complete, pending final stabilization and freeze. Stable platform reference implementation for declarative scheduling and at-least-once background job processing. (Exactly-once is NOT guaranteed; processing is at-least-once.)

This document specifies the Scheduler and Background Job Runtime delivered in Phase 8 of PGP Core. It is a declarative, storage-independent runtime: the platform stores job metadata only, executes only a built-in static handler registry, and never stores executable code, credentials, tokens, or stack traces.

---

## 1. Why

Phase 8 introduces a generic, multi-tenant scheduler and worker runtime so that platform services and applications can register safe, built-in job types and have them executed on a once or interval schedule, or on demand. The runtime is the operations-layer counterpart to the Workflow Engine: where workflows model multi-step human/process orchestration, the Job Runtime models single-unit asynchronous work with lease semantics, deterministic deduplication, bounded retries, and an append-only audit trail.

The runtime is deliberately constrained to a **static handler registry** (Phase 8: `system.health_check` only). There is no plugin-provided code execution, no remote code loading, and no arbitrary script execution. Extending the handler set is a Core modification, not a configuration or plugin concern — this is intentional and aligns with the platform implementation rule (Configuration → Plugin → Connector → Application → Core).

## 2. Scope

**In scope (Phase 8):**
- Five entities: `JobDefinition`, `JobSchedule`, `BackgroundJob`, `JobAttempt`, `JobExecutionEvent`.
- Twelve backend functions covering registration, scheduling, enqueue, lease/claim, worker processing, lifecycle control (pause/resume/cancel), and listing.
- Schedule types: `once` and `interval` (minimum 60 seconds). No cron, no timezone calendar.
- Misfire policies: `skip` and `run_once`.
- Deterministic occurrence deduplication via `deduplicationKey` (scheduleId:scheduledFor).
- At-least-once processing via lease semantics; abandoned attempts preserved.
- Bounded retry with backoff and a terminal `dead_letter` state.
- Append-only audit via `JobExecutionEvent`.
- Tenant boundary: `organizationId`; platform-scoped jobs/schedules have a null organization.
- Strict RLS and role-gated control functions.
- Non-destructive lifecycle: cancelled/paused/terminal records are preserved, never deleted by runtime operations.

**Out of scope (deferred):**
- Cron expressions and timezone-aware calendars.
- Native platform scheduler trigger wiring (the tick/worker functions are implemented and role-gated, but require explicit manual hookup to platform automations per environment — see Known Issues).
- Datastore-level locking for concurrent job processing (at-least-once is enforced via lease expiry, not via row locks).
- A pluggable / downloadable handler registry (the registry is static and Core-controlled).
- Priority queues with weighted fair scheduling (priority is a simple numeric claim ordering).
- Dead-letter requeue / replay UI actions (records are visible and auditable; re-enqueue is a manual new job).

## 3. Evidence — Entities

All entities are JSON-schema objects on the Base44 BaaS. Built-in attributes (id, created_date, updated_date, created_by_id) are present and never declared. Timestamps are UTC ISO-8601 strings.

### 3.1 JobDefinition
A platform-global job type in the catalog. Backed by a built-in static handler. Contains no executable code and no credentials.

| Field | Type | Notes |
|---|---|---|
| `key` | string | Stable, unique, immutable after creation. |
| `name` | string | Display name. |
| `description` | string | |
| `handlerKey` | string | Must reference a handler in the static registry. Unknown values rejected. Phase 8: `system.health_check`. |
| `payloadSchema` | object | Declarative JSON schema. No secret-looking keys. |
| `resultSchema` | object | Declarative JSON schema. No secret-looking keys. |
| `defaultRetryPolicy` | object | `{ maxAttempts, backoffType, baseDelaySeconds, maxDelaySeconds }`. Bounded. |
| `active` | boolean | Default true. |

**RLS:** read by developer/solution_architect/core_developer/admin/super_admin (payload redacted for developer/solution_architect); create by core_developer/super_admin via `registerJobDefinition`.

### 3.2 JobSchedule
Describes when BackgroundJobs should be created for a JobDefinition. Platform-scoped (organizationId null) or organization-scoped.

| Field | Type | Notes |
|---|---|---|
| `key` | string | Unique within schedule scope. |
| `jobDefinitionId` | string | Reference to JobDefinition. |
| `scope` | enum | `platform` \| `organization`. |
| `organizationId` | string | Null for platform; required for organization. |
| `scheduleType` | enum | `once` \| `interval`. |
| `runAt` | date-time | Required for `once`. Must be a future UTC timestamp at creation. |
| `intervalSeconds` | number | Required for `interval`. Minimum 60. |
| `startAt` / `endAt` | date-time | Optional bounds. Schedule disables when nextRunAt exceeds endAt. |
| `nextRunAt` | date-time | Deterministic next occurrence, calculated by the scheduler. |
| `payload` | object | Non-sensitive declarative data. Secret-looking keys rejected. |
| `priority` | number | Bounded 0..10 (higher = claimed first). Default 5. |
| `retryPolicy` | object | Overrides JobDefinition default when provided. |
| `misfirePolicy` | enum | `skip` \| `run_once`. Default `skip`. |
| `runCount` / `maxRuns` | number | Optional maxRuns disables schedule when reached. |
| `enabled` | boolean | Default true. |
| `pausedAt` / `cancelledAt` | date-time | Non-destructive lifecycle markers. |

**RLS:** read by developer/solution_architect/core_developer/admin/super_admin; create by core_developer/super_admin (platform) or admin/super_admin (organization) via `createJobSchedule`; update by authorized scope owners via `pauseJobSchedule`/`resumeJobSchedule`/`cancelJobSchedule`.

### 3.3 BackgroundJob
One queued execution. Created by the scheduler (from a JobSchedule, with a deterministic deduplicationKey) or by manual enqueue (jobScheduleId may be null).

| Field | Type | Notes |
|---|---|---|
| `jobDefinitionId` | string | Reference to JobDefinition. |
| `jobScheduleId` | string | Null for manually enqueued jobs. |
| `scope` | enum | `platform` \| `organization`. |
| `organizationId` | string | Null for platform; required for organization. |
| `handlerKey` | string | Copied from JobDefinition at enqueue time. |
| `status` | enum | `queued` \| `leased` \| `running` \| `retry_wait` \| `succeeded` \| `cancelled` \| `dead_letter`. Default `queued`. |
| `payload` / `result` | object | Non-sensitive transport data. Secret-looking keys rejected. |
| `priority` | number | Default 5. |
| `availableAt` | date-time | When the job becomes claimable. For retry_wait, the retry time. |
| `deduplicationKey` | string | Optional. Identifies one logical job occurrence. |
| `attemptCount` / `maxAttempts` | number | |
| `retryPolicy` | object | |
| `leaseOwner` | string | Opaque worker identifier holding the lease. |
| `leaseAcquiredAt` / `leaseExpiresAt` | date-time | |
| `lastError` | string | Safe text only. Never stack traces. |

**RLS:** read by developer/solution_architect/core_developer/admin/super_admin (payload/result redacted for developer/solution_architect); create by the scheduler or admin/super_admin via `enqueueBackgroundJob`; update by the worker runtime (service role).

### 3.4 JobAttempt
A per-worker attempt record. Historical; no attempt is ever deleted by runtime operations. An abandoned attempt is preserved when a lease expires and the job is reclaimed (at-least-once semantics). Contains no payload, result, credentials, or secrets.

| Field | Type | Notes |
|---|---|---|
| `backgroundJobId` | string | |
| `attemptNumber` | number | |
| `status` | enum | `running` \| `succeeded` \| `failed` \| `abandoned`. |
| `workerId` | string | Opaque worker identifier. |
| `startedAt` / `completedAt` / `failedAt` / `abandonedAt` | date-time | |
| `leaseExpiresAt` | date-time | |
| `lastError` | string | Safe text only. Never stack traces. |

**RLS:** read by developer/solution_architect/core_developer/admin/super_admin; create/update by the worker runtime (service role).

### 3.5 JobExecutionEvent
Immutable append-only audit record for a BackgroundJob. The runtime only creates records, never updates or deletes them. `metadata` contains safe identifiers and status values only — never payload, result, credentials, secrets, tokens, or stack traces.

| Field | Type | Notes |
|---|---|---|
| `backgroundJobId` | string | |
| `jobDefinitionId` / `jobScheduleId` | string | Denormalized for audit queryability. |
| `organizationId` | string | Denormalized tenant scope. |
| `eventType` | string | e.g. `job.enqueued`, `job.claimed`, `job.started`, `job.succeeded`, `job.retry_scheduled`, `job.dead_lettered`, `job.cancelled`. |
| `status` | string | Job status at the time of the event. |
| `attemptNumber` | number | |
| `actorId` / `workerId` | string | |
| `correlationId` | string | |
| `metadata` | object | Safe identifiers/status only. |

**RLS:** read by developer/auditor/solution_architect/core_developer/admin; create by the runtime (service role).

## 4. Evidence — Backend Functions

All functions are Deno Deploy handlers in `base44/functions/{name}/entry.ts`. Control functions are role-gated; the tick and worker are restricted to core_developer/super_admin and are designed to be wired to platform automations, not invoked by admin users.

| Function | Permitted roles | Purpose |
|---|---|---|
| `registerJobDefinition` | core_developer, super_admin | Create a JobDefinition. Validates key uniqueness, handlerKey against the static registry, and rejects secret-looking schema keys. |
| `createJobSchedule` | core_developer/super_admin (platform), admin/super_admin (organization) | Create a JobSchedule. Validates scope/org consistency, scheduleType fields, future runAt, interval ≥ 60, and computes nextRunAt. |
| `pauseJobSchedule` | scope owner | Idempotent: returns `already_paused` if already paused. |
| `resumeJobSchedule` | scope owner | Rejects resume of a cancelled schedule. Preserves nextRunAt. |
| `cancelJobSchedule` | scope owner | Non-destructive; idempotent (`already_cancelled`). |
| `enqueueBackgroundJob` | admin/super_admin (organization); platform enqueue rejected for admin | Manual enqueue. Validates scope/org, rejects secret-looking payload keys, enforces deduplicationKey uniqueness. |
| `cancelBackgroundJob` | admin/super_admin | Non-destructive; idempotent (`already_cancelled`). |
| `runSchedulerTick` | core_developer, super_admin | Evaluates due enabled schedules and enqueues BackgroundJobs with deterministic deduplication. |
| `processBackgroundJobs` | core_developer, super_admin | Claims due queued jobs (and expired leases), executes the static handler, writes attempts and audit events. |
| `listJobSchedules` / `listBackgroundJobs` / `getBackgroundJob` | read roles | Listing and detail with payload/result redaction for developer/solution_architect. |

### 4.1 Scheduler Tick Algorithm (`runSchedulerTick`)

1. Select schedules where `enabled = true`, `cancelledAt = null`, and `nextRunAt ≤ now`, ordered by nextRunAt ascending.
2. For each schedule, compute `occurrenceKey = scheduleId + ":" + nextRunAt`.
3. Deduplication: if a non-cancelled BackgroundJob with `deduplicationKey = occurrenceKey` already exists, do not create another. This is deterministic occurrence deduplication. **Enforcement is function-logic-only** (a `filter` then `create`); there is no datastore-level uniqueness constraint on `deduplicationKey`, so two concurrent ticks for the same occurrence can both observe no existing job and both create one. Idempotency holds for sequential ticks; it is not guaranteed under concurrent tick races.
4. Misfire handling (interval only):
   - `overdue = (now − scheduledFor) > intervalSeconds`.
   - `skip`: create a job only if NOT overdue and not already enqueued. Always advance nextRunAt.
   - `run_once`: create a job (the single missed occurrence) if not already enqueued. Always advance nextRunAt.
5. Advance `nextRunAt` to the next deterministic occurrence after now (interval only). For `once`, set `nextRunAt = null` and `enabled = false` after the occurrence is enqueued.
6. Disable the schedule when `maxRuns` is reached, or when the advanced `nextRunAt` exceeds `endAt`.
7. On enqueue: copy `handlerKey` from the JobDefinition, set `availableAt = now`, `deduplicationKey = occurrenceKey`, `maxAttempts` from the schedule/definition retry policy, and emit a `job.enqueued` execution event.

### 4.2 Worker Algorithm (`processBackgroundJobs`)

1. Claim set: BackgroundJobs where `status = queued` and `availableAt ≤ now`, plus jobs where `status = leased` and `leaseExpiresAt < now` (reclaim for at-least-once). Ordered by priority desc, then availableAt asc.
2. For each claimed job:
   - Create a `JobAttempt` (running) with `attemptNumber = attemptCount + 1`, `workerId`, and `leaseExpiresAt`.
   - Set the job to `leased` with `leaseOwner`, `leaseAcquiredAt`, `leaseExpiresAt`, `startedAt`, and increment `attemptCount`.
   - Emit `job.claimed`.
   - Execute the static handler by `handlerKey`.
   - **On success:** set job `succeeded` with `result` and `completedAt`; mark attempt `succeeded`; emit `job.succeeded`.
   - **On failure:** mark attempt `failed` with safe `lastError`; if `attemptCount < maxAttempts`, set job `retry_wait` with `availableAt = now + backoff`, emit `job.retry_scheduled`; if `attemptCount ≥ maxAttempts`, set job `dead_letter` with `deadLetteredAt`, emit `job.dead_lettered`.
3. Lease expiry handling: when a leased job's `leaseExpiresAt` has passed, the next tick reclaims it, marks the prior attempt `abandoned`, and creates a new attempt — at-least-once delivery.

## 5. Security Model

- **No executable code, no credentials.** JobDefinition, JobSchedule, and BackgroundJob store declarative metadata only. The handler registry is static and Core-controlled.
- **Secret-looking key rejection.** payload, result, payloadSchema, and resultSchema are scanned for secret-looking keys (`token`, `secret`, `password`, `apikey`, `credential`, etc.) and rejected.
- **Opaque lease ownership.** `leaseOwner` and `workerId` are opaque identifiers; no worker authentication material is stored.
- **Safe error text only.** `lastError` fields store safe human-readable text. Stack traces are never persisted.
- **Redaction on read.** payload/result are redacted from developer/solution_architect reads; credentialRef-style fields are not present on Job entities.
- **Role gates.** The tick and worker are restricted to core_developer/super_admin and return 403 for admin users — verified. Platform-scoped enqueue is rejected for admin users — verified.
- **Non-destructive lifecycle.** Pause, resume, cancel, dead-letter, and terminal states preserve records; the runtime never deletes audit, attempt, or terminal job records.

## 6. Risk

| Risk | Severity | Mitigation |
|---|---|---|
| No datastore-level locking for concurrent workers. | Medium | The worker claim is a plain `update` (function-logic-only) with **no compare-and-swap / datastore-level lock**. At-least-once is enforced via lease expiry and deterministic deduplication; two concurrent workers can still both read the same available job and both issue a claim `update` before either's status transition is visible, which can produce duplicate processing. A future phase should add conditional (compare-and-swap) updates. This is an acknowledged limitation, not exactly-once. |
| Native scheduler trigger requires manual wiring. | Medium | `runSchedulerTick` and `processBackgroundJobs` are implemented and role-gated but must be wired to platform automations per environment (see Known Issues). Until wired, jobs require manual tick invocation or enqueue. |
| `roles: "all"` conflates guest and user. | Low | Inherited platform limitation; a future "member" tier is tracked separately. |
| Handler registry limited to `system.health_check`. | Low | Intentional. Extending the registry is a Core modification, not a plugin concern. |
| Real-time elapsed between in-environment verification steps. | Low | Verification was performed against real wall-clock time; misfire policies were observed under genuine overdue conditions. |

## 7. Recommendation

- **Do not freeze Phase 8 yet.** The runtime is implementation-complete and pending explicit approval and a final stabilization/freeze step. It is a stable reference implementation suitable for platform services to build upon.
- **Native scheduler trigger (classification B).** Base44 scheduled automations exist platform-wide, but the tick/worker functions require a `super_admin` user context, while platform automations run with **no user context** (`base44.auth.me()` → null → 401). Securely wiring the automation would require either a platform-provided internal-invocation token (not currently exposed for these functions) or accepting unauthenticated public HTTP invocation of the worker (an unacceptable posture for a production runtime). Resolving this invocation boundary is deployment/operations work, not a code-stabilization change. Until resolved, the runtime requires an explicit external trigger or manual Super Admin invocation of the tick/worker functions. The dashboard widget displays "External Scheduler Trigger Required".
- **Do not** attempt to make the handler registry pluggable via plugins or connectors. Keep it Core-controlled until a reviewed, security-hardened extension model is designed.
- **Add a "member" role tier** in a future identity phase to resolve the `roles: "all"` conflation before opening the runtime to non-admin members.

## 8. Priority and Estimated Effort

| Item | Priority | Estimated Effort |
|---|---|---|
| Native trigger wiring (ops task) | High | Small (configuration, not code) |
| Conditional-update concurrency hardening | Medium | Medium |
| Cron / timezone calendar support | Medium | Large (deferred to a later phase) |
| Dead-letter requeue UI action | Low | Small |
| Member role tier | Medium | Medium (cross-cutting identity change) |

## 9. Expected Improvement

- Operations layer now has a generic, tenant-aware scheduler and worker runtime consistent with the platform's declarative, non-executable, audit-first architecture.
- Platform services can register safe built-in job types and rely on deterministic deduplication, at-least-once delivery, bounded retries, and a terminal dead-letter state.
- Append-only `JobExecutionEvent` provides a complete, tamper-evident audit trail per job, consistent with the Lifecycle and Workflow execution-event models.

## 10. Verification Results (Phase 8 Close)

Verification was performed against the **actual deployed backend functions** (not replicated/mirrored logic). Role switching to `super_admin` was unavailable in the build environment, so the tick/worker gates were **temporarily widened to allow `admin`** during verification, the real deployed `runSchedulerTick` and `processBackgroundJobs` were invoked via `test_backend_function`, and the gates were then **restored to `super_admin`-only**; a post-restore invocation as admin correctly returned 403 for both. A temporary `system.stabilization_failure` handler was added to exercise the retry/dead-letter paths and then removed; the handler registry was confirmed to contain exactly `system.health_check` afterward. Test definitions/schedules were created via service-role entity writes (the creation functions correctly reject past `runAt`, so due schedules were created directly to exercise the real tick).

| Path | Result |
|---|---|
| `runSchedulerTick` (real, admin-widened) → evaluated/enqueued/skipped/disabled | 6/5/1/3 ✓ (future once not enqueued; due once enqueued + disabled; interval enqueued + advanced; overdue-skip 0 + advanced; overdue-run_once 1 + advanced; maxRuns disables; endAt disables; disabled & cancelled ignored) |
| Re-tick same occurrence (dedup) | s-due-once stayed at exactly 1 job (occurrenceKey dedup) ✓ |
| `processBackgroundJobs` (real, admin-widened) batch | processed 13, succeeded 9, retried 2, deadLettered 2 ✓ |
| Worker success (`system.health_check`) | succeeded, result `{ok,executedAt,jobId,attemptNumber}`, lease cleared ✓ |
| Unknown handler → dead_letter | `lastError: "unknown handler: …"` (safe text, no stack trace), maxAttempts 1 ✓ |
| Retry → dead_letter (backoff none, maxAttempts 2) | attempt1 → retry_wait (availableAt = now); attempt2 → dead_letter ✓ |
| Retry_wait with backoff fixed 5s → no retry before availableAt | availableAt = startedAt + 5s; not re-claimed within the same batch (worker `now` fixed at batch start) ✓ |
| Expired-lease recovery (at-least-once) | stuck running job reclaimed; attempt1 → `abandoned` (preserved); attempt2 → `succeeded`; attemptCount 2 ✓ |
| Empty queue → processed 0 | ✓ |
| `cancelBackgroundJob` queued → cancelled / re-cancel → `already_cancelled` / cancel succeeded / cancel dead_letter | 200 / 200(already_cancelled) / 400 / 400 ✓ |
| Guard paths (admin): register def / platform schedule / platform enqueue | 403 / 403 / 403 ✓ |
| Validation: unknown def / secret payload / priority 99 / maxAttempts 50 / once-no-runAt / interval<60 / schedule secret payload | 400 (all) ✓ |
| Event Bus: job lifecycle publishes via `publishEvent` only (no `dispatchEvent`/`processEventDelivery`) | 69 PlatformEvents (sourceType `job`); 0 EventDeliveries (zero subscribers); 52 JobExecutionEvents (enqueued/claimed/started/succeeded/retry_scheduled/dead_lettered/attempt_abandoned) ✓ |
| Post-restore `runSchedulerTick` / `processBackgroundJobs` as admin | 403 / 403 ✓ |
| Test data cleanup | 0 leftovers across JobDefinition, JobSchedule, BackgroundJob, JobAttempt, JobExecutionEvent ✓ |

## 11. Known Issues

- **Native scheduler trigger is not wired (classification B).** `runSchedulerTick` and `processBackgroundJobs` require a `super_admin` user context. Base44 scheduled automations run with **no user context** (`base44.auth.me()` → null → 401), so they cannot invoke these functions as written; allowing a no-user path would expose the worker to unauthenticated public HTTP invocation. A platform-provided internal-invocation token would be needed to wire the automation securely — not available from this app's code/build context. Until the invocation boundary is resolved as deployment/ops work, the runtime requires an explicit external trigger or manual Super Admin invocation. The dashboard widget shows "External Scheduler Trigger Required".
- **No datastore-level locking for concurrent job processing.** At-least-once is enforced via lease expiry and deduplication; a concurrent-claim hardening pass (conditional updates) is deferred.
- **Static handler registry limited to `system.health_check`.** Intentional; extension is a Core modification.
- **`roles: "all"` conflates guest and user roles.** Inherited platform limitation; a "member" tier is deferred to a future identity phase.
- **Immutability/append-only enforcement is function-layer logic**, not a datastore-conditional constraint. A future phase may add datastore-level immutability guards.