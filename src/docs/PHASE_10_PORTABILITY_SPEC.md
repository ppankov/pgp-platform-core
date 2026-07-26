# PGP Core — Phase 10 Portability Specification

**Status:** Phase 10 — IMPLEMENTATION, Wave 10.4 pilot.

**Phase type:** Discovery and architecture pass that opened Phase 10. The
discovery pass (this document's opening baseline) defined dependencies and
boundaries only. Subsequent implementation waves executed real changes within
those boundaries: Wave 10.1 (frontend client boundary), Wave 10.2 (catalog
facade hardening + auth redirect fix), Wave 10.3A (domain package foundation),
Wave 10.3B (published domain package integration).

**Date opened:** 2026-07-18.

**Authority:** This document is a working specification. It is NOT a frozen
architecture snapshot. No `PHASE_10_ARCHITECTURE_SNAPSHOT.md` is created in this
pass. This document does not modify, supersede, or weaken any Phase 2–9 frozen
contract.

---

## Current Authoritative Status (after Wave 10.4B.2 selective rollout)

**Phase status:** Phase 10 — IMPLEMENTATION, Wave 10.4 pilot.

**Wave status:**

- Wave 10.1 — COMPLETE / PREVIEW VERIFIED
- Wave 10.2 — COMPLETE / PREVIEW VERIFIED
- Wave 10.3A — COMPLETE / PACKAGE PUBLISHED
- Wave 10.3B — COMPLETE / PACKAGE INTEGRATED
- Wave 10.4 — IN PROGRESS
- Wave 10.4A.1 — Backend Pilot Discovery — COMPLETE
- Wave 10.4A.2 — Formal Pilot Contract — DOCUMENTATION COMPLETE
- Wave 10.4A.3 — Single-function Local Provider Pilot — PILOT IMPLEMENTATION COMPLETE
- Wave 10.4A.4 — Second-function Pilot Selection — COMPLETE
- Wave 10.4A.5 — Second-function Local Provider Pilot — PILOT IMPLEMENTATION COMPLETE
- Wave 10.4A.6 — Two-pilot Architecture Evaluation — COMPLETE
- Wave 10.4B — IN PROGRESS
- Wave 10.4B.1 — Selective Rollout Inventory and Plan — PLANNING COMPLETE
- Wave 10.4B.2 — First Selective Rollout Implementation — COMPLETE
- Wave 10.4B implementation — IN PROGRESS (1 approved candidate complete)
- Phase 10 frozen snapshot — NOT CREATED

**Package:** `@ppankov/pgp-core-domain@0.1.0-alpha.1`

**Package state:**

- public (`publishConfig.access: public`)
- exact-version pinned (`npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/...`)
- 150 local assertions PASS
- Base44 import probe PASS
- integrated into 4 production functions
- no npm credentials stored in Base44

---

## 0. Historical Discovery Baseline (Scope and Guardrails)

Phase 10 establishes the exact dependencies of PGP Core on the Base44 platform
and defines architectural boundaries through which the platform could, over
time, use swappable infrastructure providers.

This pass performs **discovery and architecture definition only**.

Explicit non-actions for this pass:

- No application migration.
- No Base44 replacement.
- No runtime behavior change.
- No entity, backend function, or frontend logic changes.
- No self-hosted backend.
- No Docker / Kubernetes.
- No Supabase / PostgreSQL / Firebase / alternate datastore.
- No changes to Phase 2–9 frozen snapshots or business contracts.
- No GitHub commits, branches, tags, or releases.
- GitHub connector used read-only.

Final verification target: exactly 1 new working document, 0 source/schema/
function/frontend changes, 0 GitHub write operations, 0 persistent test records.

**Historical note:** The above was the discovery-pass baseline. The
implementation waves that followed executed real source changes within the
boundaries defined here (frontend adapter boundary, catalog facade, domain
package, published-package integration), without touching Phase 2–9 frozen
contracts, entities, RLS, or provider backend. Each wave's section records its
own executed changes and verification.

These constraints described the opening discovery pass only. They are not
the current implementation state.

---

## Wave 10.1 — Shared Frontend Client Boundary (Executed)

**Status at execution:** Phase 10 — IMPLEMENTATION, Wave 10.1 (COMPLETE / PREVIEW VERIFIED).
**Date executed:** 2026-07-18.

### Objective

Create a single canonical frontend boundary to the active Base44 provider
without changing UI, business behavior, backend functions, entities, RLS, or
any frozen Phase 2–9 contract.

### Canonical import boundary

- `src/services/base44Adapter.js` is the ONLY frontend module that imports
  `@base44/sdk` directly (`createClient` + `createAxiosClient`) and reads
  Base44-specific frontend app parameters (`@/lib/app-params`). It owns the
  canonical provider client (`providerClient`) and the auth bootstrap helper
  (`fetchPublicSettings`).
- `src/services/backendAdapter.js` exports the provider-neutral facade
  `backend` and imports only from `base44Adapter.js`. No raw client is exposed.
- `src/api/base44Client.js` is now a backward-compat shim that re-exports
  `providerClient as base44` from `base44Adapter.js`; it no longer imports
  `@base44/sdk`.

### Adapter responsibility (base44Adapter.js)

- Import `@base44/sdk` and `@base44/sdk/dist/utils/axios-client`.
- Read `appParams` (VITE_BASE44_APP_ID / APP_BASE_URL / FUNCTIONS_VERSION +
  runtime access_token).
- Construct the canonical provider client (`requiresAuth: false` — public app).
- Host `fetchPublicSettings()` (Base44-specific auth bootstrap axios call).

### Facade responsibility (backendAdapter.js)

- Export `backend` with `auth`, `entities`, `functions` delegating to the
  provider client object references — method names, argument shapes, return
  shapes, and error propagation unchanged — plus `fetchPublicSettings`.
- No raw client. No mock provider. No second provider. No provider-switching
  feature flag. No dependency-injection framework.

### Files created

- `src/services/base44Adapter.js` (canonical adapter)
- `src/services/backendAdapter.js` (provider-neutral facade)
- `src/api/base44Client.js` rewritten as a backward-compat shim (no
  `@base44/sdk` import).

### Files modified — frontend consumers migrated to `backend` (22)

- `src/lib/function-call.js` (`base44.functions.invoke` → `backend.functions.invoke`)
- `src/lib/PageNotFound.jsx` (`base44.auth.me` → `backend.auth.me`)
- `src/pages/ForgotPassword.jsx`, `Login.jsx`, `Register.jsx`, `ResetPassword.jsx`
  (`base44.auth.*` → `backend.auth.*`)
- `src/components/connectors/ConnectorEngineWidget.jsx`,
  `src/components/jobs/SchedulerEngineWidget.jsx`,
  `src/components/lifecycle/LifecycleWidget.jsx`,
  `src/components/plugins/PluginEngineWidget.jsx`
  (`base44.entities.*` → `backend.entities.*`)
- `src/pages/jobs/JobDefinitionsPage.jsx`, `JobQueuePage.jsx`, `JobSchedulesPage.jsx`,
  `src/pages/lifecycle/LifecycleDefinitionsPage.jsx`, `LifecycleStatesPage.jsx`,
  `LifecycleTransitionsPage.jsx`, `LifecycleViewerPage.jsx`
  (`base44.entities.*` → `backend.entities.*`)
- `src/components/connectors/ConnectorConnectionForm.jsx`,
  `src/pages/connectors/OrganizationConnectionsPage.jsx`,
  `src/pages/plugins/InstalledPluginsPage.jsx`, `PluginDetailPage.jsx`
  (removed unused `base44` imports — these only use `callFn`)

### Migrated consumers now using `backend`

18 files import `backend` from `@/services/backendAdapter`; 36 `backend.*`
usages across them.

### Remaining direct Base44 dependencies (frontend)

- `src/services/base44Adapter.js` — canonical, intended.
- `src/lib/AuthContext.jsx` — **platform-managed file**. The platform's
  authentication validator blocks modification and requires
  `import { base44 } from '@/api/base44Client'` plus
  `import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client'` to
  remain. AuthContext could NOT be migrated in Wave 10.1. Its `base44` import
  now resolves through the shim to the canonical `providerClient`, so its
  `base44.auth.*` calls are functionally unchanged. The only true remaining
  direct `@base44/sdk` import in frontend source is AuthContext's
  `createAxiosClient` (deep path) — a platform-managed blocker to be revisited
  in a future wave or via a platform-level change. No forced refactor was
  performed (per spec: leave generated/platform-managed files that cannot be
  safely replaced and document the reason).

### Auth redirect regression (found & fixed)

**Symptom:** After logout, the app opened the non-existent `/login` route
and rendered `404 — The page "login" could not be found`. The first repair
attempt (a `base44Client.js` logout wrapper with a forced
`window.location.assign('/')` reload) was an incorrect race-condition mask
and did NOT fix the preview — the `/login` 404 still appeared. It has been
removed.

**Real root cause:** `src/App.jsx` contained an invalid unauthenticated
redirect — `ProtectedRoute`'s `unauthenticatedElement` was
`<Navigate to="/login" replace />`, but no `/login` route exists in the app
(the platform owns the login experience; there is no app Login page). On
logout, `AuthContext.logout()` flips `isAuthenticated=false` (no `authError`
set), so `AuthenticatedApp` renders the `Routes`; `ProtectedRoute` then
returns the `unauthenticatedElement` `<Navigate to="/login">` → no matching
route → `PageNotFound` → 404. This is an `App.jsx` routing bug, not a Wave
10.1 provider/client change (Wave 10.1 only swapped `base44.auth` →
`backend.auth` import paths and the `base44Client.js` shim; the
`<Navigate to="/login">` line predates Wave 10.1).

**Fix (real):**
- `src/App.jsx`: changed the unauthenticated redirect from
  `<Navigate to="/login" replace />` to `<Navigate to="/" replace />` so an
  unauthenticated SPA-side state change (e.g. logout) lands on Home, not on a
  non-existent `/login` route.
- `src/App.jsx`: added a compatibility redirect route
  `<Route path="/login" element={<Navigate to="/" replace />} />` so any old
  link/bookmark to `/login` resolves to Home instead of 404. This is a
  redirect alias, NOT a new Login page.
- `src/pages/ForgotPassword.jsx`, `src/pages/Register.jsx`: internal
  `<Link to="/login">` → `<Link to="/">`.
- `src/pages/ResetPassword.jsx`: post-reset redirect `/login` → `/`.
- `src/api/base44Client.js`: RESTORED to pure provider delegation. The
  previous logout wrapper (forced `window.location.assign('/')` reload) was
  removed as an incorrect workaround (race-condition masking). `base44.auth`
  is again the unmodified provider `auth` object; `logout` keeps the original
  provider contract (args/return unchanged). No `window.location` workaround,
  no `setTimeout`, no forced reload, no race masking.
- `backend.auth.redirectToLogin` remains pure provider delegation
  (`backendAdapter.js` untouched — Wave 10.1 contract point 3 satisfied).

**Files changed in this repair pass:** `src/App.jsx`,
`src/pages/ForgotPassword.jsx`, `src/pages/Register.jsx`,
`src/pages/ResetPassword.jsx`, `src/api/base44Client.js`,
`src/docs/PHASE_10_PORTABILITY_SPEC.md`.

**Not changed (per constraints):** `src/lib/AuthContext.jsx`
(platform-managed), no Login page created, no backend functions / entities /
RLS / Phase 2–9 files touched.

### Real preview verification (confirmed)

Verification was performed manually by the repository owner in the real
Base44 Preview (not in the agent sandbox, which cannot drive the preview).
Results:

- logout → Sign In screen: **PASS**
- URL after logout: `/`
- direct `/login` → `/` compatibility redirect: **PASS**
- login back → Dashboard: **PASS**
- auth-flow 404: **0**

### Rollback boundary

Revert the 22 modified consumer files, the 2 new service files, and restore
`src/api/base44Client.js` to its original `createClient` form. No entity,
function, schema, RLS, or Phase 2–9 file is touched, so rollback is fully
contained in `src/services/`, `src/api/base44Client.js`, and the consumer
import lines.

### Verification results (static)

- Direct `@base44/sdk` import statements outside `base44Adapter.js`: **1**
  (`src/lib/AuthContext.jsx` — platform-managed, documented above).
- Direct Base44 client construction outside `base44Adapter.js`: **1**
  (`src/lib/AuthContext.jsx` `createAxiosClient` — platform-managed).
- Frontend `asServiceRole` usages: **0**.
- Direct frontend mutations via `.entities`: **0**.
- Import cycles between `base44Adapter` / `backendAdapter` / consumers: **0**
  (`base44Adapter` → `@/lib/app-params`; `backendAdapter` → `base44Adapter`;
  consumers → `backendAdapter`; no back-edge).
- `base44Client.js` shim resolves to `base44Adapter`: yes; no `@base44/sdk`
  import.
- Phase 9 security regression: zero direct frontend Template B reads; zero
  direct frontend mutations; all entity reads are Template A (read:
  admin/user) via `backend.entities`; all mutations remain function-only via
  `callFn`.
- Auth redirect — `App.jsx` unauthenticated redirect: `<Navigate to="/"
  replace />` (was `/login`; real fix).
- Auth redirect — `/login` compatibility route present (redirects to `/`):
  **yes**.
- Auth redirect — internal auth nav refs to `/login`: **0**
  (ForgotPassword / Register / ResetPassword → `/`).
- Auth redirect — direct `window.location` redirects to `/login`: **0**.
- Auth redirect — `base44.auth.logout` pure provider delegation: **yes**
  (previous wrapper removed; original provider contract restored).
- Auth redirect — `backend.auth.redirectToLogin` pure provider delegation:
  **yes** (untouched).
- Auth redirect — static `"/login"` string literals remaining: `App.jsx`
  compat route (intended) only; all auth-consumer `/login` refs removed.
- Auth redirect — Preview verification (logout → Sign In, direct `/login` →
  `/`, login → Dashboard): **PASS** (confirmed manually in the real Base44
  Preview by the repository owner; see "Real preview verification (confirmed)"
  above).

### Build / lint / typecheck

`npm run build`, `npm run lint`, and `npm run typecheck` cannot be executed
from the agent sandbox (no shell/npm runtime is available). Verification was
performed via the static import / cycle / mutation scans recorded above. The
platform's Vite compile of the modified sources is the live build check; no
npm script execution is available in this environment.

### Read-only GitHub comparison (post-Wave-10.1)

- Repository: `ppankov/pgp-platform-core`, `main`, latest commit unchanged
  `7ef273f2e6c5d3b4d34d72651bf3dabe0a25185c`.
- Missing files (in GitHub, not local): 0.
- Extra files (local, not in GitHub): 4 — `base44/connectors/github.jsonc`
  (post-Phase-9 connector metadata), `src/docs/PHASE_10_PORTABILITY_SPEC.md`
  (this spec), `src/services/backendAdapter.js`, `src/services/base44Adapter.js`
  (Wave 10.1 new files). All expected; the user controls commit/push.
- Differing files: 22 — exactly the Wave 10.1 migrated consumer files plus
  the `base44Client.js` shim. `src/lib/AuthContext.jsx` is NOT in the
  differing set (platform blocked the edit, confirming it is untouched).
- Equal files: 292 — all Phase 2–9 docs, all 53 entity schemas, all 59 backend
  functions, all unmodified pages/components unchanged (git blob SHA
  identical to GitHub `main`).
- GitHub write operations: 0.

---

## Wave 10.2 — Frontend Provider Facade Hardening (Executed)

**Status at execution:** Phase 10 — IMPLEMENTATION, Wave 10.2 (COMPLETE / PREVIEW VERIFIED).
**Date executed:** 2026-07-19.
**Prerequisite:** Wave 10.1 verified in real Preview (auth redirect fix +
pure provider logout delegation).

### Objective

Remove the temporary broad frontend `backend.entities` passthrough from
Wave 10.1 and replace it with a narrow, read-only, provider-neutral frontend
data facade (`backend.catalog`) backed by an explicit Template A / Template C
read allow-list. Base44 remains the only active provider. No Wave 10.1
contract is weakened; no Phase 2–9 frozen file is touched.

### Temporary Wave 10.1 `backend.entities` contract (now retired)

Wave 10.1 exposed `backend.entities` as a direct passthrough to
`providerClient.entities` (any entity, any method including
create/update/delete/bulk). This was an intentional transitional contract to
land the provider-neutral boundary quickly. It was too broad for a permanent
frontend surface: it permitted arbitrary entity namespaces, mutation
methods, and unknown entity names with no allow-list guard.

### New `backend.catalog` contract (Wave 10.2)

```
backend.catalog.list(entityName, options?)        -> Promise<record[]>
backend.catalog.filter(entityName, filters, options?) -> Promise<record[]>
backend.catalog.get(entityName, id)              -> Promise<record>
```

- Fixed methods only: `list`, `filter`, `get`. No create/update/delete/bulk.
  No dynamic method names, no `eval`, no reflective arbitrary invocation.
- `entityName` is the only string parameter and is validated against the
  read allow-list BEFORE any provider call. Template B and unknown names
  throw synchronously (`backend.catalog: entity "X" is not in the read
  allow-list.`).
- `options` carries only already-used / provider-supported read params
  (`sort`, `limit`), forwarded positionally to the provider exactly as
  before. No new query language. No pagination semantics change. Response
  shapes unchanged.
- Implemented in `src/services/backendAdapter.js`. Internally it delegates
  to `providerClient.entities[entityName]` (the only `providerClient.entities`
  access in frontend source, allow-listed). No `asServiceRole`, no RLS
  bypass.
- `backend.entities` is REMOVED from the public `backend` export.
  `backend.raw` and the raw provider client are NOT exposed.

### Template A / C read allow-list (authoritative: frozen Phase 9 matrix)

Template A — authenticated direct read (datastore RLS: read admin/user):
`ApplicationDefinition`, `PluginDefinition`, `ConnectorDefinition`,
`ConnectorProvider`, `JobDefinition`, `EventTopic`, `LifecycleDefinition`,
`LifecycleState`, `LifecycleTransition`, `AuditCategoryDefinition`,
`AuditRuleDefinition`, `AuditProfileDefinition`, `AuditKnowledgeArticle`
(13 entities).

Template C — admin-only datastore read (datastore RLS restricts to admin):
`PlatformRole`, `Permission`, `RolePermission` (3 entities).

Allow-list total: 16 entities.

### Template B deny behavior

Template B (function-only read) entity names are NOT in the allow-list and
are rejected by `assertReadable` before any provider call. Template B reads
remain the contract of protected backend functions invoked via
`backend.functions.invoke` (e.g. `listBackgroundJobs`, `listJobSchedules`,
`listPlugins`, `listConnectors`, `listPlatformEvents`, `getEventDeliveries`,
`getEventDeliveryDetailSecure`, `getLifecycleState`). Template B reads were
NOT converted to catalog reads. Phase 9 RLS / protected-read contracts are
not weakened.

### Consumers migrated (19 catalog reads across 11 files)

`backend.entities.<Entity>.list|filter(...)` → `backend.catalog.list|filter("Entity", ...)`.
Arguments, filter objects, sort order, limits, response shapes, loading /
error / empty behavior, UI markup, routes, styling, and translations are
unchanged. No React Query cache keys were in use on these reads (useEffect +
useState), so cache keys are unaffected.

- `src/components/connectors/ConnectorEngineWidget.jsx` (ConnectorDefinition
  .list, ConnectorProvider.filter)
- `src/components/jobs/SchedulerEngineWidget.jsx` (JobDefinition.list)
- `src/components/lifecycle/LifecycleWidget.jsx`
  (LifecycleDefinition/State/Transition .list)
- `src/components/plugins/PluginEngineWidget.jsx` (PluginDefinition.list)
- `src/pages/jobs/JobDefinitionsPage.jsx` (JobDefinition.list)
- `src/pages/jobs/JobQueuePage.jsx` (JobDefinition.list)
- `src/pages/jobs/JobSchedulesPage.jsx` (JobDefinition.list)
- `src/pages/lifecycle/LifecycleDefinitionsPage.jsx`
  (LifecycleDefinition.list)
- `src/pages/lifecycle/LifecycleStatesPage.jsx`
  (LifecycleDefinition.list, LifecycleState.filter)
- `src/pages/lifecycle/LifecycleTransitionsPage.jsx`
  (LifecycleDefinition.list, LifecycleState.filter,
  LifecycleTransition.filter)
- `src/pages/lifecycle/LifecycleViewerPage.jsx` (LifecycleDefinition.list,
  LifecycleState.filter, LifecycleTransition.filter)

`backend.catalog.get` is provided for completeness; no current consumer uses
it yet.

### Remaining AuthContext platform blocker (unchanged)

`src/lib/AuthContext.jsx` remains platform-managed and unchanged. It imports
`base44` from `@/api/base44Client` (the backward-compat shim →
`providerClient`) and `createAxiosClient` from
`@base44/sdk/dist/utils/axios-client`. It uses only `base44.auth.*`
(me/​logout/​redirectToLogin/​updateMe); it does NOT use `base44.entities` or
`backend.catalog`. AuthContext's `createAxiosClient` deep SDK import is the
only remaining direct `@base44/sdk` frontend import outside
`base44Adapter.js` (documented Wave 10.1 blocker; revisited in a future wave
or via a platform-level change). The shim is the only sanctioned path for
platform-managed code that still needs the old client.

### Security invariants (post-Wave-10.2)

- frontend `backend.entities` usages: **0** (passthrough removed).
- frontend `base44.entities` usages: **0**.
- frontend direct entity mutations (create/update/delete/bulk): **0**.
- frontend Template B direct reads: **0** (all via `backend.functions.invoke`).
- frontend `asServiceRole` usages: **0**.
- raw provider client / `backend.raw` exposure: **0**.
- arbitrary entity invocation: **0** (fixed methods only).
- unknown entity names passed to `backend.catalog`: **0** (allow-list
  rejects before provider call).
- `providerClient.entities` access: only inside `backendAdapter.js`
  catalog implementation (allow-listed).
- direct `@base44/sdk` imports outside `base44Adapter.js`: **1**
  (`AuthContext.jsx` — platform-managed, documented).
- import cycles (backendAdapter ↔ base44Adapter ↔ base44Client ↔
  consumers): **0** (forward edges only; no back-edge).
- Phase 9 RLS / protected-read contracts: not weakened.

### Rollback boundary

Revert `src/services/backendAdapter.js` to the Wave 10.1 form (restore the
`entities: providerClient.entities` passthrough) and revert the 11 consumer
files' `backend.catalog.*` calls back to `backend.entities.<Entity>.*`. No
entity, function, schema, RLS, backend, or Phase 2–9 file is touched, so
rollback is fully contained in `src/services/backendAdapter.js` and the 11
consumer read lines. `base44Adapter.js`, `base44Client.js`, `AuthContext.jsx`,
`App.jsx`, and the auth redirect fix are NOT changed by Wave 10.2.

### Verification results (static)

- `backend.entities` usages in frontend: **0** (only a comment in
  `backendAdapter.js`).
- `base44.entities` usages: **0**.
- `providerClient.entities` usages: **3**, all in `backendAdapter.js`
  (catalog internals) — consumers: **0**.
- `backend.raw` exposure: **0** (comment only).
- catalog calls: 19 consumer reads across 11 files (all allow-listed
  Template A entities: ConnectorDefinition, ConnectorProvider,
  JobDefinition, LifecycleDefinition, LifecycleState,
  LifecycleTransition, PluginDefinition).
- unknown entity names to catalog: **0**.
- direct frontend mutations: **0**.
- frontend `asServiceRole`: **0**.
- direct SDK outside adapter: `AuthContext.jsx` only (platform-managed).
- shim non-AuthContext imports: **0**.
- facade exposes entities passthrough: **no**. facade exposes raw: **no**.
  allow-list present: **yes**. mutation methods exposed: **no**.
  import cycle: **no** (forward edges only).

### Build / lint / typecheck

`npm run build`, `npm run lint`, `npm run typecheck` — **NOT EXECUTED** (the
agent sandbox has no shell / npm runtime). The platform's Vite compile of
the modified sources is the live build check. Static import / cycle /
mutation scans recorded above are the available verification.

### Real preview verification (confirmed)

Verification was performed manually by the repository owner in the real
Base44 Preview (not in the agent sandbox). Results:

- Dashboard: **PASS**
- engine widgets (lifecycle, plugins, connectors, scheduler): **PASS**
- Lifecycle lists (Definitions / States / Transitions): **PASS**
- Plugin catalog: **PASS**
- Connector catalog: **PASS**
- Job Definitions: **PASS**
- Job Queue: **PASS**
- Job Schedules: **PASS**
- logout/login flow: **PASS**
- external scheduler limitation displayed as expected
- persistent test records: **0**

### Remaining provider dependencies (frontend)

- `src/services/base44Adapter.js` — canonical, intended (`createClient`,
  `createAxiosClient`, app-params). The only `@base44/sdk` import point by
  design.
- `src/lib/AuthContext.jsx` — platform-managed `createAxiosClient` deep
  import + `base44.auth.*` via shim (documented blocker).
- `src/api/base44Client.js` — backward-compat shim re-exporting
  `providerClient as base44` (platform-managed AuthContext path only).

---

## 1. Phase Status

| Field | Value |
|---|---|
| Phase | 10 |
| Title | Runtime Portability & Provider Independence |
| Current status | Phase 10 — IMPLEMENTATION, Wave 10.4 pilot. |
| Completed waves | 10.1, 10.2, 10.3A, 10.3B, 10.4A.1, 10.4A.2, 10.4A.3, 10.4A.4, 10.4A.5, 10.4A.6, 10.4B.1, 10.4B.2 |
| Next wave | Wave 10.4B.3 selective rollout verification and closure evaluation — REQUIRES EXPLICIT APPROVAL |
| Frozen snapshot | Not created |
| GitHub writes | 0 |

---

## 2. Source Baseline

### 2.1 Sources inspected

- Local Base44 application (315 files; 312 code files scanned).
- GitHub repository `ppankov/pgp-platform-core`, branch `main` (read-only via
  the authorized GitHub connector, scope `public_repo`).

### 2.2 GitHub baseline (read-only verification)

| Check | Result |
|---|---|
| Repository accessible | yes — `ppankov/pgp-platform-core`, public, `default_branch: main` |
| Latest commit on `main` | `7ef273f2e6c5d3b4d34d72651bf3dabe0a25185c` — `Delete PGP-Core_v0.1.0-alpha_Phase9_Frozen.zip` (2026-07-19T00:05:02Z) |
| `src/docs/PHASE_9_ARCHITECTURE_SNAPSHOT.md` present | yes |
| `src/docs/SECURITY_RLS_HARDENING_SPEC.md` present | yes |
| Phase 9 frozen status string `Phase 9 — FROZEN.` present in both docs | yes |
| Phase 10 string present in Phase 9 docs | no (clean — Phase 9 docs untouched) |
| `base44/connectors/github.jsonc` committed to `main` | no (post-Phase-9 integration metadata, local only) |

### 2.3 Phase 2–9 snapshot presence on `main`

- `src/docs/PHASE_2_ARCHITECTURE_SNAPSHOT.md` — present
- `docs/PHASE_3_ARCHITECTURE_SNAPSHOT.md` — present (located under `docs/`, not `src/docs/`)
- `docs/PHASE_4_ARCHITECTURE_SNAPSHOT.md` — present (located under `docs/`, not `src/docs/`)
- `src/docs/PHASE_5_ARCHITECTURE_SNAPSHOT.md` — present
- `src/docs/PHASE_6_ARCHITECTURE_SNAPSHOT.md` — present
- `src/docs/PHASE_7_ARCHITECTURE_SNAPSHOT.md` — present
- `src/docs/PHASE_8_ARCHITECTURE_SNAPSHOT.md` — present
- `src/docs/PHASE_9_ARCHITECTURE_SNAPSHOT.md` — present

All Phase 2–9 snapshots remain present and unchanged. Phase 9 spec retains
status `Phase 9 — FROZEN.`. The prior file-level diff (git blob SHA) confirmed
314 of 314 shared files identical between GitHub `main` and the local Phase 9
baseline; the only local-only file is `base44/connectors/github.jsonc`.

### 2.4 Connector metadata

`base44/connectors/github.jsonc` is post-Phase-9 integration metadata created
by the GitHub connector OAuth authorization performed in this session. It is
NOT committed to GitHub `main` and is NOT modified or committed in this pass.

---

## 3. Base44 Dependency Inventory

Code inspection covered 312 code files. Aggregated dependency touchpoints are
listed below. A "usage" is one lexical occurrence of the dependency surface.

### 3.1 Aggregate usage counts

| Dependency / API | Usages | Files | Layer | Security-sensitive | Runtime-critical |
|---|---:|---:|---|---|---|
| `@base44/sdk` (import) | 66 | 64 | backend (functions) | yes (auth/RLS path) | yes |
| `@base44/vite-plugin` | 5 | 3 | config (package.json, package-lock.json, vite.config.js) | no | yes (build) |
| `createClientFromRequest` | 118 | 59 | backend (functions; import + call = 2 per function) | yes | yes |
| `base44.auth` | 85 | 69 | backend + frontend (auth context, protected routes) | yes | yes |
| `base44.entities` | 23 | 13 | frontend (engine widgets) + docs | yes (RLS-backed) | yes (data) |
| `base44.asServiceRole` | 106 | 63 | backend (privileged ops) | yes (trusted actor) | yes |
| `base44.asServiceRole.entities` | 32 | 7 | backend (scheduler/event/job functions) | yes | yes |
| `base44.functions` (callFn) | 22 | 22 | backend (function-to-function) | yes | yes |
| `base44.integrations` | 0 | 0 | — (no current usage) | n/a | n/a |
| `base44.connectors` | 0 | 0 | — (accessed via asServiceRole.connectors in functions) | yes | yes |
| `base44.files` | 0 | 0 | — (no current usage) | n/a | n/a |
| `base44.users` | 0 | 0 | — (no current usage; invites are platform-managed) | n/a | n/a |
| `base44.analytics` | 0 | 0 | — (no explicit usage; tracker injected by vite plugin) | no | no |
| `Deno.serve` | 59 | 59 | backend (every function entry) | no | yes (runtime) |
| `Deno.*` (general) | 59 | 59 | backend | no | yes (runtime) |
| `VITE_BASE44_*` env vars | 7 | 2 (README.md, src/lib/app-params.js) | config + frontend | no (non-secret) | yes (boot) |
| `import.meta.env` | 4 | 2 (src/lib/app-params.js, src/lib/navigation.js) | frontend config | no | yes (boot) |
| `"rls":` schema blocks | 52 | 52 | schema (entities) | yes | yes (datastore enforcement) |
| `@base44/vite-plugin` build hooks (`hmrNotifier`, `navigationNotifier`, `analyticsTracker`, `visualEditAgent`, `legacySDKImports`) | 5 hooks | 1 (vite.config.js) | config/build | no | yes (build/dev) |

**Representative total:** ~547 Base44 dependency touchpoints (occurrences, not
independent dependencies) across ~140 files. Per-surface occurrence/file
counts are listed in the table above (e.g. `base44.asServiceRole`: 106
occurrences across 63 files; `createClientFromRequest`: 118 occurrences
across 59 files).
(sum of distinct API surfaces; `asServiceRole.entities` is a subset of
`base44.asServiceRole` and is not double-counted in the total).

### 3.2 Structural inventory

| Layer | Count | Base44-coupled |
|---|---:|---|
| Entity schemas (`base44/entities/*.jsonc`) | 53 | yes (RLS on 52; User is platform-managed) |
| Backend functions (`base44/functions/*/entry.ts`) | 59 | yes (all use Deno.serve + createClientFromRequest + @base44/sdk) |
| Workflows (`base44/workflows/`) | 0 | — |
| Agents (`base44/agents/`) | 0 | — |
| Connector metadata (`base44/connectors/`) | 1 (`github.jsonc`, post-Phase-9) | yes (OAuth token managed by platform) |
| Pages (`src/pages/`) | 33 | partial (auth guard, RoleRoute) |
| Components (`src/components/`) | 87 | partial (engine widgets call base44.entities) |
| Docs (`*.md`) | many | no (pure text) |

### 3.3 Environment and boot dependencies

- `src/lib/app-params.js` reads `VITE_BASE44_APP_ID`,
  `VITE_BASE44_APP_BASE_URL`, `VITE_BASE44_FUNCTIONS_VERSION`, and an
  `access_token` from URL/storage. These are the boot-time binding to the
  Base44 backend. Values are non-secret app identifiers.
- `src/api/base44Client.js` (pre-initialized SDK client) is the shared
  frontend entry to `base44.auth/entities/integrations/connectors`.

### 3.4 Secret handling

No secret values are stored in this document. The connector OAuth token for
`github` is held by the Base44 platform (shared mode) and is never read into
application code as a literal. `base44/connectors/github.jsonc` contains only
non-secret connection metadata.

---

## 4. Classification Matrix

Each dependency is classified:

- **A. PORTABLE NOW** — standard React/Vite/TS/JS with no Base44 dependency.
- **B. ADAPTER CANDIDATE** — can be placed behind a provider interface without
  changing the frozen business contract.
- **C. BASE44-COUPLED BUT REPLACEABLE** — requires a future provider
  implementation or data migration.
- **D. HARD PLATFORM BLOCKER** — cannot currently be replaced without
  redesigning infrastructure or runtime.
- **E. BASE44-MANAGED ONLY** — capability whose implementation is fully
  controlled by Base44.

### 4.1 Classification by surface

| Surface | Class | Notes |
|---|---|---|
| React pages/components (UI-only, no `base44.*` calls) | A | 33 pages, ~82 of 87 components |
| Tailwind tokens, `tailwind.config.js`, `index.css` | A | pure design tokens |
| shadcn/ui primitives, lucide-react icons | A | standard packages |
| Pure domain logic inside functions (validation, redaction, state machines) | A | portable algorithms wrapped in Deno handlers |
| Docs (`*.md`) | A | pure text |
| Standard libs (lodash, moment, date-fns, recharts, react-leaflet, framer-motion, three, react-hook-form, zod, etc.) | A | no Base44 coupling |
| `base44.auth` (me, isAuthenticated, updateMe, redirect, logout) | B | AuthProvider facade; 85 usages / 69 files |
| `base44.entities` (frontend widgets) | B | DataProvider facade; 23 usages / 13 files |
| `base44.functions` callFn (function-to-function) | B | FunctionInvoker facade; 22 usages / 22 files |
| `base44.asServiceRole` (privileged ops) | B/C | service-role facade; needs equivalent trusted actor in future provider |
| `base44.connectors` (getConnection) | B | ConnectorRuntimeProvider facade |
| `VITE_BASE44_*` env + `import.meta.env` boot | B | ConfigProvider boundary |
| Entity schemas (53) + RLS declarations (52) | C | portable shape, datastore-specific enforcement; needs data migration |
| `base44.auth` users/sessions/invites | C/E | identity migration requires IdP redesign (out of scope) |
| `createClientFromRequest` + `@base44/sdk` runtime in functions | D | runtime coupling to Deno Deploy + SDK client |
| `Deno.serve` handler shape (59 functions) | D | function runtime coupling |
| Backend function hosting (Base44/Deno Deploy) | D | hosting blocker |
| Datastore RLS enforcement engine | D | cannot be replaced without datastore redesign |
| Scheduler / background job runtime (`processBackgroundJobs`, `runSchedulerTick`) | D | runtime blocker; Class B scheduler limitation (Phase 8 known issue: unreachable for built-in admin) |
| `@base44/vite-plugin` build hooks | D | build-time coupling beyond standard Vite |
| Auth backend (tokens, sessions, email verification) | E | platform-owned |
| `User` entity records (invite-only, cannot create) | E | platform-managed |
| Frontend hosting / CDN | E | platform-managed |
| Connector OAuth token management (shared mode) | E | platform-managed |
| File storage (`UploadFile`, private files, signed URLs) | E | platform-managed (0 current usages) |
| Email delivery (`SendEmail` to registered users) | E | platform-managed (0 current usages) |
| Analytics tracker | E | injected by vite plugin (0 explicit usages) |

### 4.2 Classification totals (by file / surface count)

| Class | Surfaces | Approx. files |
|---:|---|---|
| A. PORTABLE NOW | UI + design + libs + docs + pure domain logic | ~125 |
| B. ADAPTER CANDIDATE | auth/entities facade, callFn, asServiceRole facade, connectors, config | ~80 |
| C. BASE44-COUPLED BUT REPLACEABLE | 53 entity schemas, 52 RLS rules, identity | ~53 + 7 privileged functions |
| D. HARD PLATFORM BLOCKER | 59 function runtimes, datastore RLS engine, scheduler runtime, build plugin | ~60 + build |
| E. BASE44-MANAGED ONLY | auth backend, User, hosting, connector tokens, file/email/analytics | platform-side |

---

## 5. Target Provider Architecture (interfaces/contracts only)

A single `PlatformAdapter` boundary is proposed. No provider code is created in
this pass. Each contract is described at the interface level.

### 5.1 AuthProvider

- **Responsibility:** current user, authentication state, login redirect,
  logout, profile update.
- **Current Base44 implementation:** `base44.auth.me()`,
  `base44.auth.isAuthenticated()`, `base44.auth.redirectToLogin()`,
  `base44.auth.logout()`, `base44.auth.updateMe()`; platform-owned
  tokens/sessions/email verification; `User` entity is read-only and
  invite-only.
- **Caller layers:** `AuthContext`, `ProtectedRoute`, `RoleRoute`, login
  pages, backend function auth checks.
- **Security boundary:** identity + session; role claims (`admin`/`user`).
- **Data ownership:** platform owns User records.
- **Error contract:** throws when unauthenticated; `user_not_registered` /
  `auth_required` error types.
- **Migration difficulty:** high (IdP redesign).
- **Required in Phase 10:** no (interface only).

### 5.2 DataProvider

- **Responsibility:** CRUD over entities, filtering, bulk ops, realtime
  subscriptions, schema introspection.
- **Current Base44 implementation:** `base44.entities.<Name>.list/filter/get/
  create/update/delete/bulkCreate/bulkUpdate/updateMany/deleteMany/subscribe/
  schema()`; privileged path via `base44.asServiceRole.entities`.
- **Caller layers:** frontend widgets, backend functions (service-role).
- **Security boundary:** datastore RLS (52 entities) for user-context reads;
  `asServiceRole` for trusted service writes.
- **Data ownership:** entities stored in Base44 datastore.
- **Error contract:** RLS denial surfaces as permission error; referential
  integrity returns 409.
- **Migration difficulty:** very high (data + RLS migration).
- **Required in Phase 10:** no (interface only).

### 5.3 FunctionInvoker

- **Responsibility:** invoke backend functions (callFn) and integrations
  (LLM, file, email, speech, video, transcription, extraction).
- **Current Base44 implementation:** `base44.functions.<name>(payload)` (callFn
  between functions); `base44.integrations.Core.*` for AI/file/email; functions
  are Deno Deploy handlers via `Deno.serve` + `createClientFromRequest`.
- **Caller layers:** frontend (via SDK), backend (function-to-function callFn).
- **Security boundary:** each function enforces auth + org membership + RLS
  re-fetch.
- **Data ownership:** function code is app-owned; runtime is platform-hosted.
- **Error contract:** uncaught errors bubble; safe redacted errors for
  user-facing flows.
- **Migration difficulty:** high (runtime + hosting).
- **Required in Phase 10:** no (interface only).

### 5.4 FileStorageProvider

- **Responsibility:** public file upload, private file upload, signed URLs.
- **Current Base44 implementation:** `base44.integrations.Core.UploadFile`,
  `UploadPrivateFile`, `CreateFileSignedUrl`.
- **Caller layers:** backend functions (0 current usages).
- **Security boundary:** private files require signed URL.
- **Data ownership:** platform storage.
- **Error contract:** upload/sign failures return error dicts.
- **Migration difficulty:** medium (storage abstraction).
- **Required in Phase 10:** no.

### 5.5 SecretsProvider

- **Responsibility:** declare and access app secrets (API keys, OAuth client
  secrets).
- **Current Base44 implementation:** `set_secrets` declaration; secrets supplied
  out-of-band; read in functions via the SDK.
- **Caller layers:** backend functions needing external API keys.
- **Security boundary:** secrets never appear in code or logs.
- **Data ownership:** platform-managed secret store.
- **Error contract:** missing secret fails the function safely.
- **Migration difficulty:** medium.
- **Required in Phase 10:** no.

### 5.6 SchedulerProvider

- **Responsibility:** schedule and execute background jobs, retry, dead-letter.
- **Current Base44 implementation:** `JobDefinition`, `JobSchedule`,
  `BackgroundJob`, `JobAttempt`, `JobExecutionEvent`; runtime via
  `processBackgroundJobs`, `runSchedulerTick` (Phase 8 Class B limitation:
  unreachable for built-in admin).
- **Caller layers:** backend functions (`enqueueBackgroundJob`,
  `createJobSchedule`, `cancelJobSchedule`, pause/resume).
- **Security boundary:** job metadata only; no payload/result in audit.
- **Data ownership:** platform-hosted worker runtime.
- **Error contract:** `lastError` redacted (500-char cap, no stack traces).
- **Migration difficulty:** high (runtime).
- **Required in Phase 10:** no.

### 5.7 EventPublisher

- **Responsibility:** publish platform events, deliver to subscribers.
- **Current Base44 implementation:** `publishEvent`, `dispatchEvent`,
  `processEventDelivery`, `subscribe`, `unsubscribe`; `PlatformEvent`,
  `EventSubscription`, `EventDelivery`.
- **Caller layers:** backend functions publishing domain events.
- **Security boundary:** read paths protected; payloads redacted.
- **Data ownership:** Event Bus entities in Base44 datastore.
- **Error contract:** delivery status is authoritative per subscriber.
- **Migration difficulty:** medium-high.
- **Required in Phase 10:** no.

### 5.8 ConnectorRuntimeProvider

- **Responsibility:** obtain OAuth access tokens for connected services.
- **Current Base44 implementation:** `base44.asServiceRole.connectors.
  getConnection('<type>')` returns `{ accessToken }` for shared-mode connectors;
  `base44/connectors/*.jsonc` stores non-secret connection metadata.
- **Caller layers:** backend functions using external APIs (e.g., GitHub).
- **Security boundary:** token held by platform; never exposed as literal.
- **Data ownership:** platform-managed token store.
- **Error contract:** missing/dead grant returns connection error.
- **Migration difficulty:** high (OAuth + token lifecycle).
- **Required in Phase 10:** no.

### 5.9 AuditProvider

- **Responsibility:** append-only audit records for lifecycle, workflow, jobs,
  events.
- **Current Base44 implementation:** `LifecycleExecutionEvent`,
  `WorkflowExecutionEvent`, `JobExecutionEvent`, `AuditEvent`; runtime creates
  only, never updates/deletes.
- **Caller layers:** lifecycle/workflow/job/event runtimes.
- **Security boundary:** read by auditor/admin/developer roles; metadata only
  (no secrets/payloads/stack traces).
- **Data ownership:** Base44 datastore.
- **Error contract:** append-only; immutability enforced by runtime contract.
- **Migration difficulty:** medium (must preserve append-only guarantee).
- **Required in Phase 10:** no.

### 5.10 DeploymentProvider

- **Responsibility:** build, host, serve the frontend; route backend functions.
- **Current Base44 implementation:** `@base44/vite-plugin` (build hooks:
  `hmrNotifier`, `navigationNotifier`, `analyticsTracker`, `visualEditAgent`,
  `legacySDKImports`); platform hosting/CDN; Deno Deploy for functions.
- **Caller layers:** build pipeline, dev server, hosting.
- **Security boundary:** build-time only; no runtime secrets in frontend bundle.
- **Data ownership:** platform-managed build + hosting.
- **Error contract:** build failures surface in Vite.
- **Migration difficulty:** high (build plugin + hosting).
- **Required in Phase 10:** no.

---

## 6. Business Logic Separation

| Module | Pure domain logic | Application orchestration | Infrastructure access | UI-only | Base44 platform glue |
|---|---|---|---|---|---|
| Lifecycle Engine | state/transition validation, approval gating | attach/execute/decide flows | `asServiceRole.entities` persistence | viewer pages | `Deno.serve`, `createClientFromRequest`, RLS |
| Event Bus | subscription matching, delivery state | publish/dispatch/process | `asServiceRole.entities` | delivery pages | function runtime + RLS |
| Delivery Runtime | per-subscriber status state machine | process/retry | entity updates | detail pages | function runtime + RLS |
| Plugin Engine | declarative manifest validation, install/enable/disable state | install/enable/disable/uninstall | `asServiceRole.entities` | catalog/detail pages | function runtime + RLS |
| Connector Engine | definition/provider/connection catalog, auth-mode metadata | create/activate/disable/disconnect | `asServiceRole.entities`, `connectors.getConnection` | catalog/connection pages | function runtime + RLS + OAuth token store |
| Workflow Engine | graph traversal, manual node progression | start/complete/fail/cancel | `asServiceRole.entities` | catalog/instance pages | function runtime + RLS |
| Scheduler / Background Jobs | retry policy, lease/claim, dead-letter | enqueue/schedule/cancel/tick | `asServiceRole.entities` (heavy: 32 usages / 7 functions) | queue/history pages | function runtime + RLS + worker runtime (Class B limitation) |
| Security / RLS enforcement | role/membership checks, redaction | function re-fetch validation | RLS at datastore, `asServiceRole` | Security Center (read-only) | datastore RLS engine + function runtime |
| Audit module | append-only event semantics | event emission | entity creates | audit views | datastore + RLS |

**Portability note:** the pure domain logic columns are portable JS and can be
extracted with no behavior change. The infrastructure-access and Base44-glue
columns are the portability boundaries. No frozen engine contract is modified
by this analysis.

---

## 7. Data and Security Portability

### 7.1 Security guarantee sources

| Guarantee | Source |
|---|---|
| Tenant isolation (organization scoping) | function-enforced (re-fetch + membership check) — portable application logic |
| Row-level read access on 52 entities | datastore RLS — Base44-specific |
| Privileged writes (lifecycle, event, job, workflow mutations) | `base44.asServiceRole.entities` — Base44-specific trusted actor |
| Authenticated user identity | `base44.auth` — Base44-managed |
| Role claims (`admin`/`user`) | `User.role` — Base44-managed |
| Organization membership | `OrganizationMember` (function-enforced) — portable logic over Base44-stored data |
| Referential integrity on lifecycle deletes | function-enforced 409 — portable |
| Append-only / immutability (audit, attempts, executions, deliveries) | runtime contract (create-only) — portable logic, but must be re-proven by future datastore |
| Sensitive field redaction | function-enforced recursive redaction — portable application logic |
| `lastError` redaction (500-char cap, no stack traces) | function-enforced — portable |
| Connector OAuth token secrecy | platform-managed token store — Base44-specific |

### 7.2 Role assumptions that are Base44-specific

- Built-in `User.role` supports only `admin`/`user`.
  `super_admin`/`core_developer`/`developer`/`solution_architect`/`auditor`
  are documented but are dead runtime branches (Phase 9 known issue). A future
  AuthProvider must either preserve this two-role model or migrate the role
  taxonomy — out of scope for this pass.

### 7.3 Tenant-isolation rules that must survive any future provider

- Organization is the tenant boundary.
- `OrganizationMember` is the single source of truth for membership.
- All org-scoped reads/writes verify active membership before mutation.
- Cross-tenant data access is denied.
- Direct frontend SDK mutation of business entities is prohibited
  (function-only mutation boundary).

### 7.4 Append-only / immutability contracts to be re-proven

A future DataProvider must prove, for each of these entities, that runtime can
create but never update or delete:

- `LifecycleExecutionEvent`, `WorkflowExecutionEvent`, `JobExecutionEvent`,
  `AuditEvent`, `JobAttempt`, `WorkflowStepRun` (completed/failed historical),
  `EventDelivery` (status transitions allowed; record deletion denied),
  `PlatformEvent`.

### 7.5 Portable redaction rules

Recursive sensitive-field masking, 500-char error cap, and stack-trace
stripping are pure application logic and migrate unchanged. They must not be
weakened by any provider swap.

**No existing rule is weakened by this document.**

---

## 8. Build and Deployment Baseline

### 8.1 Scripts (from `package.json`)

| Script | Command | Standard? | Base44-coupled? |
|---|---|---|---|
| `dev` | `vite` | yes (Vite dev server) | yes — `@base44/vite-plugin` hooks HMR/navigation/analytics/visual-edit |
| `build` | `vite build` | yes (Vite build) | yes — `@base44/vite-plugin` participates in build |
| `lint` | `eslint . --quiet` | yes | no |
| `lint:fix` | `eslint . --fix` | yes | no |
| `typecheck` | `tsc -p ./jsconfig.json` | yes (TypeScript) | no |
| `preview` | `vite preview` | yes | yes (serves built output; backend still Base44-hosted) |

### 8.2 Vite configuration (`vite.config.js`)

- Plugins: `@base44/vite-plugin` (with `hmrNotifier`, `navigationNotifier`,
  `analyticsTracker`, `visualEditAgent`, `legacySDKImports` env flag) and
  `@vitejs/plugin-react`.
- The Base44 plugin is a build/dev-time coupling beyond standard Vite.

### 8.3 Environment variables (frontend, non-secret)

- `VITE_BASE44_APP_ID`
- `VITE_BASE44_APP_BASE_URL`
- `VITE_BASE44_FUNCTIONS_VERSION` (optional)
- `BASE44_LEGACY_SDK_IMPORTS` (build-time flag)
- `access_token` (runtime, URL/storage — not a build var)

### 8.4 Build output

- Vite default output directory (`dist/`). Standard Vite artifact.
- Frontend build can be produced independently of the Base44 backend runtime,
  but the resulting bundle still calls the Base44 backend at runtime via the
  pre-initialized client and `VITE_BASE44_*` boot params.

### 8.5 Runtime services that remain Base44-hosted after frontend build

- Auth backend (tokens, sessions, verification, invites).
- Datastore (entities + RLS enforcement).
- Backend functions (Deno Deploy).
- Scheduler / background job worker runtime.
- Connector OAuth token store.
- File/email/analytics integrations.
- Hosting/CDN for the frontend.

### 8.6 Actions NOT performed in this pass

- No `npm install`, `npm run build`, `npm run lint`, `npm run typecheck`, or
  `npm run preview` was executed as a side effect of this pass.
- No publish or deploy.

---

## 9. Phase 10 Wave History and Forward Plan

Waves 10.1, 10.2, 10.3A, and 10.3B have been executed (COMPLETE). Wave 10.4
is IN PROGRESS via the completed single-function local provider pilot
(Wave 10.4A.3) and the completed second-function local provider pilot
(Wave 10.4A.5); the multi-function provider contract rollout (Wave 10.4B)
has NOT started. The entries below record the real executed state of
completed waves and the architectural direction of in-progress and
not-yet-started waves.

### Wave 10.1 — Shared Frontend Client Boundary — COMPLETE / PREVIEW VERIFIED

- **Status:** COMPLETE. Executed 2026-07-18.
- **Executed scope:** created `src/services/base44Adapter.js` (canonical
  provider client + `fetchPublicSettings`) and `src/services/backendAdapter.js`
  (provider-neutral `backend` facade); rewrote `src/api/base44Client.js` as a
  backward-compat shim; migrated 22 frontend consumers to `backend.*`; fixed
  the `/login` auth redirect regression in `src/App.jsx` (redirect → `/` +
  `/login` compatibility route). See the "Wave 10.1" detailed section above for
  the full file list, the auth regression history, and verification.
- **Preview verification:** PASS (confirmed manually in the real Base44
  Preview by the repository owner: logout → Sign In, `/login` → `/`, login →
  Dashboard, 0 auth-flow 404).
- **Rollback boundary:** revert the 22 consumer files, the 2 new service files,
  and `base44Client.js`; contained in `src/services/`, `src/api/base44Client.js`,
  and the consumer import lines + `src/App.jsx` auth redirect lines.

### Wave 10.2 — Frontend Provider Facade Hardening — COMPLETE / PREVIEW VERIFIED

- **Status:** COMPLETE. Executed 2026-07-19.
- **Executed scope:** removed the temporary broad `backend.entities`
  passthrough; added a read-only `backend.catalog` facade backed by an
  explicit Template A / Template C read allow-list (16 entities); migrated 19
  catalog reads across 11 files. See the "Wave 10.2" detailed section above for
  the allow-list, migrated consumers, and security invariants.
- **Preview verification:** PASS (Dashboard, engine widgets, Lifecycle lists,
  Plugin/Connector catalogs, Job Definitions/Queue/Schedules, logout/login —
  all confirmed manually in the real Base44 Preview by the repository owner).
- **Rollback boundary:** revert `src/services/backendAdapter.js` to the
  Wave 10.1 form and the 11 consumer `backend.catalog.*` call lines.

### Wave 10.3 — Pure Domain Logic Extraction — COMPLETE / PACKAGE INTEGRATED

- **Status:** COMPLETE. Wave 10.3A executed 2026-07-19; Wave 10.3B executed
  2026-07-19.
- **Shared-module packaging blocker discovered:** Base44 backend functions
  deploy independently and cannot import shared cross-folder local modules
  (`ISOLATE_INTERNAL_FAILURE` / "Module not found"). See the historical
  "Wave 10.3 — BLOCKED" section for the finding.
- **npm package solution selected:** publish the pure domain modules as a
  versioned public npm package and import via exact-version `npm:` specifiers
  (the only mechanism satisfying both the purity contract and the "0 runtime
  duplicates" requirement).
- **Wave 10.3A — package foundation:** created `packages/pgp-core-domain/`
  (buildless, dependency-free ESM: `workflowGraph`, `jobScheduling`,
  `backgroundJob`, `safeData`) with 150-assertion parity tests. Package
  prepared, not yet published, not yet integrated (temporary duplication
  existed between deployed inline logic and package parity candidates).
- **Wave 10.3B — published package integration:** published
  `@ppankov/pgp-core-domain@0.1.0-alpha.1` to the public npm registry;
  integrated into the four production functions via exact-version `npm:`
  imports; inline duplicates removed; temporary runtime duplication removed.
- **Inline duplicates removed:** workflow `validateGraph` 2→0, scheduler
  occurrence logic 1→0, background job retry/redaction helpers 1→0 each.
- **4 production functions migrated:** `registerWorkflowVersion`,
  `releaseWorkflowVersion`, `runSchedulerTick`, `processBackgroundJobs`.
- **Exact npm version pinned:** `0.1.0-alpha.1` (no floating imports).
- See the "Wave 10.3A" and "Wave 10.3B" detailed sections for full evidence.

### Wave 10.4 — Backend Provider Contract Architecture — IN PROGRESS

**Rejected original idea:** "introduce a shared backend adapter module
imported by all 59 functions." Reason: Base44 backend functions deploy
independently and cannot import shared cross-folder local modules
(`ISOLATE_INTERNAL_FAILURE`). A shared local backend adapter is not
importable by deployed functions. This approach is rejected for the same
packaging-boundary reason documented in the historical "Wave 10.3 — BLOCKED"
section.

**Current constraints (architectural direction; the single-function pilot
Wave 10.4A.3 is approved and executed, multi-function rollout is not):**

- no shared local cross-folder backend adapter
- no mass refactor of 59 functions
- Base44-specific bootstrap (`createClientFromRequest` + `@base44/sdk` +
  `Deno.serve`) remains local to each function
- reusable provider-neutral logic may require exact-version npm packages
  (the mechanism proven by Wave 10.3A/10.3B), not a shared local module
- Wave 10.4 began with discovery / pilot design (10.4A.1) and executed the
  single-function local provider pilot (10.4A.3)
- multi-function rollout (Wave 10.4B) is not approved

No final Wave 10.4 multi-function implementation plan is defined in this
document.

**Sub-wave progress:**

- Wave 10.4A.1 — Backend Pilot Discovery — COMPLETE. Selected pilot:
  `base44/functions/listJobSchedules/entry.ts`. See the "Wave 10.4A — Backend
  Provider Contract Pilot Design" section.
- Wave 10.4A.2 — Formal Pilot Contract — DOCUMENTATION COMPLETE. Minimal
  provider contract formalized in the "Wave 10.4A" section. No runtime,
  entry.ts, package, or interface file changes.
- Wave 10.4A.3 — Single-function Local Provider Pilot — PILOT IMPLEMENTATION COMPLETE. Local
  Base44 adapter + provider-neutral orchestration implemented inside
  `listJobSchedules/entry.ts`; runtime behavior preserved. See the
  "Wave 10.4A" section.
- Wave 10.4A.4 — Second-function Pilot Selection — COMPLETE. Discovery
  only (0 files changed). Selected `listBackgroundJobs/entry.ts` as the
  second pilot; documented shared/entity-specific capabilities, package
  decision A, and the behavioral-parity plan.
- Wave 10.4A.5 — Second-function Local Provider Pilot — PILOT
  IMPLEMENTATION COMPLETE. Same-file `createBase44Provider` +
  provider-neutral `executeListBackgroundJobs` implemented inside
  `listBackgroundJobs/entry.ts`; runtime behavior preserved. See the
  "Wave 10.4A.5" section.
- Wave 10.4 multi-function rollout (Wave 10.4B): NOT STARTED. Both
  single-function pilots (Wave 10.4A.3 and 10.4A.5) are complete, so
  Wave 10.4 is IN PROGRESS.

### Wave 10.5 — Build and environment profiles — NOT STARTED (forward-plan candidate)

- **Scope:** isolate `@base44/vite-plugin` hooks and `VITE_BASE44_*` env behind
  a build profile so a standard Vite build can be produced for comparison.
- **Files/modules:** `vite.config.js`, `src/lib/app-params.js`, env profiles.
- **Risks:** medium — build pipeline change; must keep dev HMR working.
- **Regression tests:** `npm run build`, `npm run preview`, dev server HMR.
- **Rollback boundary:** restore the single vite config.
- **Expected Base44 credit cost:** low-medium.

### Wave 10.6 — Portability verification and architecture snapshot — NOT STARTED (forward-plan candidate)

- **Scope:** verify provider interfaces compile against a no-Base44 profile,
  document the final portability state, and create
  `PHASE_10_ARCHITECTURE_SNAPSHOT.md` only when all prior waves are green.
- **Files/modules:** docs only.
- **Risks:** low.
- **Regression tests:** full app regression.
- **Rollback boundary:** n/a (docs).
- **Expected Base44 credit cost:** low.

---

## 10. Explicit Out of Scope (this discovery pass)

- Self-hosted production runtime.
- Datastore migration.
- Docker / Kubernetes.
- OAuth / IdP migration.
- Implementation of a secrets manager.
- External scheduler implementation.
- Replacement of Base44 auth.
- Replacement of Base44 RLS.
- Arbitrary code execution.
- Plugin execution runtime.
- Connector credential migration.
- Phase 10 freeze.
- Phase 11.

---

## 11. Historical Discovery Verification

The table below is the historical discovery-pass verification. It records
the discovery baseline (0 source changes, 1 new document). It is NOT the
current implementation verification — see "Verification Baseline after Wave
10.3" below.

| Item | Required | Actual |
|---|---|---|
| Application source files changed | 0 | 0 |
| Entity schema files changed | 0 | 0 |
| Backend functions changed | 0 | 0 |
| Frontend files changed | 0 | 0 |
| Frozen Phase 2–9 documents changed | 0 | 0 |
| New working documents | exactly 1 | 1 (`src/docs/PHASE_10_PORTABILITY_SPEC.md`) |
| GitHub write operations | 0 | 0 |
| Persistent test records | 0 | 0 |
| `PHASE_10_ARCHITECTURE_SNAPSHOT.md` created | no | no |

---

## 11b. Verification Baseline after Wave 10.3

| Item | Result |
|---|---|
| Wave 10.1 Preview (logout/login, `/login` → `/`, Dashboard) | PASS |
| Wave 10.2 Preview (Dashboard, widgets, catalogs, Job pages, login flow) | PASS |
| Domain package tests | 150 assertions PASS |
| npm pack dry-run | PASS, 7 files |
| Package publication | PASS (`@ppankov/pgp-core-domain@0.1.0-alpha.1`, public) |
| Base44 import probe | PASS (4/4 subpaths) |
| Production function compile/gate execution | PASS, 4/4 |
| Production mutating paths | NOT RUNTIME EXECUTED |
| Persistent test records | 0 |
| Frontend direct mutations | 0 |
| Template B direct frontend reads | 0 |
| Frontend `asServiceRole` usages | 0 |
| Entities / RLS changed | 0 |
| Phase 2–9 documents changed | 0 |
| GitHub writes | 0 |
| Phase 10 architecture snapshot | not created |

---

## 12. Historical Discovery Final Report

**Status (historical):** The original discovery-pass final report (Wave 10.2
era), duplicating the discovery baseline (sections 2–4, 11): ~547 Base44
dependency touchpoints across ~140 files; classification A ~125 / B ~80 / C
53 schemas+52 RLS / D 59 function runtimes+RLS+scheduler+build plugin / E
platform-managed; top five blockers — backend function runtime, datastore RLS,
`asServiceRole` trusted actor, build plugin coupling, auth+User entity. Files
changed: 0; 1 new working document; 0 GitHub writes; Phase 9 frozen contracts
confirmed identical on `main`. Superseded by implementation waves 10.1–10.4A.6
and 10.4B.1; see those wave sections for executed changes.
**Final result (historical):** Phase 10 discovery complete.

---

*End of Phase 10 discovery baseline. This was the historical discovery final
report; the implementation waves that followed (10.1, 10.2, 10.3A, 10.3B) were
each executed after explicit approval. See those wave sections for the
executed changes and verification.*

---

## 12b. Current Phase 10 Report after Wave 10.4A.5

1. **Current status:** Phase 10 — IMPLEMENTATION, Wave 10.4 pilot.
2. **Completed:** Wave 10.1, 10.2, 10.3A, 10.3B, 10.4A.1, 10.4A.2, 10.4A.3, 10.4A.4, 10.4A.5.
3. **Package:** `@ppankov/pgp-core-domain@0.1.0-alpha.1`.
4. **Production integrations:** `registerWorkflowVersion`,
   `releaseWorkflowVersion`, `runSchedulerTick`, `processBackgroundJobs`.
5. **Remaining known items:**
   - duplicate-edge identity reconciliation (deployed `from|to|label` vs
     frozen Phase 7 spec repeated `(from,to)`)
   - read-side redaction helper backlog (separate Phase 9 protected-read
     helpers, out of Wave 10.3B scope)
   - `AuthContext` platform-managed SDK dependency (`createAxiosClient` deep
     import; platform blocks modification)
   - Base44 function isolation boundary (no shared local cross-folder imports)
   - scheduler Class B operational limitation
     (`processBackgroundJobs`/`runSchedulerTick` unreachable for built-in
     admin)
   - Supabase provider/runtime not started (package is structured to enable
     reuse, no Supabase implementation exists)
6. **Next:** Wave 10.4A.6 two-pilot architecture evaluation or Wave 10.4B
   planning — REQUIRES EXPLICIT APPROVAL.
7. **Final result:** Phase 10 implementation in progress through the
   Wave 10.4A.5 second-function local provider pilot.

---

## Wave 10.3 — Pure Domain Logic Extraction — BLOCKED (historical)

**Status (historical):** The original Wave 10.3 extraction was blocked by the
shared-module packaging boundary: Base44 deployed functions deploy
independently and cannot import cross-folder local modules
(`ISOLATE_INTERNAL_FAILURE` / "Module not found"); neither `shared/domain/`
nor `base44/shared/domain/` is importable. The three fallback alternatives
(dead-code partial extraction, per-function duplicated copies, or a
networked `base44.functions.invoke` utility) were all rejected as violating
the purity contract or the "0 duplicates" requirement. Files changed: 0.
The blocker was resolved by Wave 10.3A (pure domain package foundation) and
Wave 10.3B (published `@ppankov/pgp-core-domain` integration via exact-version
`npm:` imports). This section is retained only as the historical
packaging-boundary decision baseline; it is NOT the current phase state.

---

## Wave 10.3A — Pure Domain Package Foundation

**Section status (updated):** PACKAGE PREPARED, PUBLISHED, AND INTEGRATED.
Wave 10.3A originally prepared the package foundation (not published, not
integrated). The package was subsequently published to the public npm registry
as `@ppankov/pgp-core-domain@0.1.0-alpha.1` and integrated into the four
production functions in Wave 10.3B. This section records the Wave 10.3A
foundation work; see Wave 10.3B for the integration.

**Date:** 2026-07-19.

### Original shared-module blocker

Wave 10.3 established that Base44 deployed functions deploy independently and
cannot import cross-folder local modules (`ISOLATE_INTERNAL_FAILURE` /
"Module not found"). Neither `shared/domain/` nor `base44/shared/domain/` is
importable by deployed functions.

### Decision A — versioned npm package

The single-source-of-truth path that satisfies BOTH the purity contract (no
Base44/Deno/Supabase inside domain modules) AND the "0 runtime duplicates"
requirement is to publish the pure domain modules as a versioned npm package
and import them via the `npm:` specifier.

### Rejection of permanent per-function duplication

Per-function permanent duplication was rejected because it violates the
"local duplicated validateGraph implementations: 0" contract. Temporary
duplication (deployed inline copies + package parity candidate) is permitted
ONLY as an intermediate packaging state, explicitly resolved by Wave 10.3B.

### Package path

`packages/pgp-core-domain/` — a standalone source workspace at the repository
root, outside the Base44 function tree. Not imported by any deployed Base44
function.

### Provisional identity / version

- name: `pgp-core-domain`
- version: `0.1.0-alpha.1`

Both are provisional until verified at the publication gate (registry
availability, scope, ownership).

### Package structure (minimal, buildless)

```
packages/pgp-core-domain/
  package.json      (type: module, private: false, sideEffects: false, no deps)
  README.md
  src/index.js      (re-exports public functions)
  src/workflowGraph.js
  src/jobScheduling.js
  src/backgroundJob.js
  src/safeData.js
  test/verify.mjs   (node:assert/strict only)
```

No build framework, no transpiler, no bundler, no dependencies, no
devDependencies, no package-lock, no .npmrc, no CI.

### Exported modules / functions

| Subpath export | Function |
| --- | --- |
| `./workflow` | `validateWorkflowGraph(graph)` |
| `./scheduling` | `buildOccurrenceKey(scheduleId, scheduledForUtcIso)`, `evaluateScheduleOccurrence(input)` |
| `./background-job` | `calculateRetryDelay(retryPolicy, attemptNumber)`, `decideFailedJobTransition(input)` |
| `./safe-data` | `containsSecretKey(value)`, `redactSecretKeys(value)`, `sanitizeErrorText(message)` |
| `.` | re-exports all of the above |

### Purity contract

All `src/` files are provider-independent. Verified by static inspection:
0 forbidden patterns (`@base44/sdk`, `base44.*`, `Deno.*`, `supabase`,
React import, `fetch(`, fs, `process.env`/`Deno.env`, `crypto.randomUUID`,
`Date.now(`, `new Date()` with no argument), 0 dependencies, 0
devDependencies. Time-dependent functions accept explicit `nowIso`/`nowMs`.
No input mutation.

### Parity test coverage

`test/verify.mjs` — 150 assertions, dependency-free (`node:assert/strict`
only). Covers: workflow graph (valid, invalid type, missing arrays, empty
nodes, invalid node, missing/duplicate key, missing/unsupported type,
multiple starts, missing end, invalid edge, missing from/to, unknown edge,
duplicate edge same label, duplicate from/to different labels — deployed
behavior, incoming to start, outgoing from end, missing outgoing, unreachable
node, cycle, executable-looking config); scheduler (occurrence key, once new,
once already-enqueued, interval skip not-overdue, interval skip overdue,
interval run_once overdue, first future occurrence, maxRuns disable, endAt
disable, input unchanged); background job (no policy, none, fixed,
exponential, capped exponential, retry_wait, dead_letter, explicit nowIso,
input unchanged); safe data (secret detection, safe object, nested detection,
nested redaction, array redaction, Bearer masking, key=value masking,
key:value masking, 500-char cap, non-string coercion, source unchanged).

### Contract discrepancy findings (open reconciliation items — NO behavior
change in Wave 10.3A)

1. **Duplicate edge identity (workflow graph).** Deployed code identity:
   `from + "|" + to + "|" + label` — label participates. Frozen Phase 7 spec
   identity: repeated `(from, to)` pair — label does not participate. The
   package follows deployed behavior to guarantee no runtime semantic change
   on integration. The discrepancy is documented in the package README and in
   `src/workflowGraph.js`, and remains an open reconciliation item for a future
   explicit decision.

(No other behavioral discrepancies found — package mirrors deployed
semantics for scheduler, background job, and safe data modules.)

### Historical state at the end of Wave 10.3A — temporary duplication boundary

- Deployed functions KEPT their current inline domain logic unchanged.
- Package workspace held parity-candidate implementations.
- This was an intermediate packaging state, NOT a completed extraction.

**Current state after Wave 10.3B:** the package is published; the four
production functions import the package via exact-version `npm:` specifiers;
the inline duplicates have been removed; the temporary runtime duplication
no longer exists. See the "Wave 10.3B" section.

### Verification results

- `npm test` (via `node test/verify.mjs`): **PASS — 150 assertions.**
- `npm pack --dry-run`: NOT EXECUTED (no npm in sandbox).
- Static purity inspection: PASS (0 forbidden patterns, 0 deps, 0 mutation
  patterns beyond deterministic input snapshots, 0 import cycles).

### Publication gate (executed)

EXECUTED (outside Base44, by the repository owner). The package was published
to the public npm registry as `@ppankov/pgp-core-domain@0.1.0-alpha.1` with
public access and an alpha prerelease tag. No npm token was requested, created,
or stored in Base44 — publication happened in the repository owner's
environment. No npm credentials belong in Base44.

### Wave 10.3B integration gate

EXECUTED. See the "Wave 10.3B — Published Domain Package Integration" section
below.

### Rollback (historical — applied to the Wave 10.3A pre-integration state)

Delete `packages/pgp-core-domain/` and this doc section. This rollback applied
only to the pre-10.3B state, when no deployed function imported the package.
Zero runtime behavior changes; zero deployed-file changes; zero frontend
changes.

**After Wave 10.3B integration, do NOT delete the package** — the four
production functions import it. The current rollback is the Wave 10.3B
rollback (see the "Wave 10.3B — Rollback" section): restore the four
functions to their pre-10.3B inline logic, keep the published npm package
intact (do NOT unpublish), and document the integration rollback.

### Frozen contracts verification

Untouched: registerWorkflowVersion, releaseWorkflowVersion, runSchedulerTick,
processBackgroundJobs, other Base44 functions, frontend, adapters,
AuthContext, App.jsx, entities, RLS, app package.json, Phase 2–9 docs.

**Final result:** Phase 10 Wave 10.3A package foundation complete and
subsequently published as `@ppankov/pgp-core-domain@0.1.0-alpha.1`. Integration
completed in Wave 10.3B.

---

## Wave 10.3B — Published Domain Package Integration

**Section status:** COMPLETE.

**Date:** 2026-07-19.

**Phase status at execution:** "Phase 10 — IMPLEMENTATION, Wave 10.3." This wave
completed the Wave 10.3 extraction by integrating the published domain package
into the four production backend functions.

### Objective

Integrate the published `@ppankov/pgp-core-domain@0.1.0-alpha.1` package into
the four production Base44 backend functions via exact-version `npm:` imports,
removing the inline duplicated domain logic, while preserving every deployed
behavior, HTTP status, response shape, validation error string, event name,
audit field, and datastore call exactly.

### Final package identity / version

- **name:** `@ppankov/pgp-core-domain` (public package under the `@ppankov`
  npm scope).
- **exact version:** `0.1.0-alpha.1` (alpha prerelease tag).
- **publication:** confirmed — published to the public npm registry with
  public access (`publishConfig.access: public`) by npm account `ppankov` with
  auth-and-writes 2FA / WebAuthn.
- **0 dependencies.**

### Exact-version pinning (REQUIRED)

All four production functions import via exact-version `npm:` specifiers. No
floating imports (`latest`, `alpha`, `^`, `~`, unversioned) are used. A newer
or floating version is never an emergency workaround — on regression, restore
the pre-integration inline logic instead.

### Import probe

A temporary backend function `verifyCoreDomainPackage` was created, deployed,
and invoked. It imported the four subpath exports
(`/workflow`, `/scheduling`, `/background-job`, `/safe-data`) and exercised one
function per module with deterministic inputs. Auth gate only; no datastore
reads/writes; no `asServiceRole`; no persistent records; no event/audit writes;
no secrets.

**Probe runtime result:** PASS.

```json
{
  "status": "package_import_verified",
  "package": "@ppankov/pgp-core-domain",
  "version": "0.1.0-alpha.1",
  "checks": { "workflow": true, "scheduling": true, "backgroundJob": true, "safeData": true }
}
```

The probe function was removed after successful integration (see "Probe
removal" below). No diagnostic/test backend function remains in the source.

### Production functions migrated

1. `base44/functions/registerWorkflowVersion/entry.ts` — imports
   `validateWorkflowGraph` from `.../workflow`; removed local `SUPPORTED_NODE_TYPES`,
   `EXEC_PATTERN`, `validateGraph`. `validateGraph(graph)` →
   `validateWorkflowGraph(graph)`.
2. `base44/functions/releaseWorkflowVersion/entry.ts` — same import and
   removal; `validateGraph(version.graph)` → `validateWorkflowGraph(version.graph)`;
   release prefix `"Graph validation failed on release: "` preserved.
3. `base44/functions/runSchedulerTick/entry.ts` — imports `buildOccurrenceKey`,
   `evaluateScheduleOccurrence` from `.../scheduling`; replaced inline
   occurrence-key construction, once/interval decision, misfire skip/run_once,
   nextRunAt advance, maxRuns/endAt terminal with `evaluateScheduleOccurrence`.
   `buildOccurrenceKey` used for the dedup query key. Infrastructure
   orchestration (auth/super_admin gate, due-schedule read, definition cache,
   dedup datastore query, BackgroundJob create, audit, publishEvent,
   JobSchedule update, counters, response shape) unchanged.
4. `base44/functions/processBackgroundJobs/entry.ts` — imports
   `calculateRetryDelay`, `decideFailedJobTransition` from `.../background-job`
   and `containsSecretKey`, `redactSecretKeys`, `sanitizeErrorText` from
   `.../safe-data`. Removed local `SECRET_KEYS`, `hasSecretKey`, `redactResult`,
   `SECRET_TEXT_KEY`, `BEARER_TEXT`, `sanitizeErrorText`, `retryDelay`, and the
   inline retry/dead-letter decision. `hasSecretKey`→`containsSecretKey`,
   `redactResult`→`redactSecretKeys`, inline retry/dead-letter→
   `decideFailedJobTransition`. HANDLERS, LEASE_SECONDS, lease, audit, events,
   counters, and at-least-once/race limitations unchanged.

### Inline duplicates removed (before → after)

- Workflow: local `validateGraph` implementations 2 → 0; local
  `SUPPORTED_NODE_TYPES` copies 2 → 0; local `EXEC_PATTERN` copies 2 → 0.
- Scheduler: inline occurrence-decision algorithm 1 → 0; local
  occurrence-key concatenation 1 → 0 (now `buildOccurrenceKey`).
- Background jobs: local `retryDelay` 1 → 0; local secret vocabulary (`SECRET_KEYS`)
  1 → 0; local redaction helper (`redactResult`) 1 → 0; local `sanitizeErrorText`
  1 → 0; inline retry/dead-letter decision 1 → 0.

Note: read-side redaction helpers in other backend functions
(`getBackgroundJob`, `listBackgroundJobs`, `getEventDeliveries`, etc.) are
separate Phase 9 protected-read helpers and are out of scope for Wave 10.3B
(not part of the four target functions). They are unchanged.

### Exact imports used

```
npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/workflow
npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/scheduling
npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/background-job
npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/safe-data
```

5 exact-version import statements across the four functions. Floating imports
found: 0.

### Local npm test

`node test/verify.mjs` → **PASS — 150 assertions.** (Re-run after integration;
package source unchanged in this wave, only `package.json` name/version/
publishConfig and README updated.)

### npm pack dry-run

7 files (expected): `package.json`, `README.md`, `src/index.js`,
`src/workflowGraph.js`, `src/jobScheduling.js`, `src/backgroundJob.js`,
`src/safeData.js`. (`npm pack` not executed in the Base44 sandbox — no npm
available; file count derived from the `files` field + auto-included
`package.json`.)

### Base44 npm import probe result

PASS (see "Import probe" above).

### Deployed compile results

All four production functions deployed and their `npm:` imports resolved.
Verified via non-mutating invocations (empty payload returns the same
400/403 the pre-integration code returned, before any datastore access —
confirming the module loaded and the validation/role gates execute):

- `registerWorkflowVersion` `{}` → 400 `workflowDefinitionId and version are required`.
- `releaseWorkflowVersion` `{}` → 400 `workflowVersionId is required`.
- `runSchedulerTick` `{}` → 403 `Not permitted to invoke the scheduler tick`.
- `processBackgroundJobs` `{}` → 403 `Not permitted to invoke the worker`.

### Runtime test boundary

Production mutating flows were NOT runtime-executed. No new
Workflow/Schedule/BackgroundJob records were created for testing. Compile =
module load + non-mutating gate return, not a mutating runtime PASS. The
mutating paths (create workflow version, release, scheduler tick, job
processing) rely on the package's 150-assertion behavioral-parity test plus
the deployed compile verification. The scheduler Class B known limitation
(processBackgroundJobs/runSchedulerTick unreachable for built-in admin) is
unchanged — these super_admin-gated functions remain manual-only.

### Probe removal

`base44/functions/verifyCoreDomainPackage/` (entry.ts + directory) deleted
after successful integration. No deployed or source test endpoint remains.

### Frontend and security invariants

- `backend.entities` frontend usages (outside the canonical adapter): 0. (The
  only matches are documentation comments inside `src/services/backendAdapter.js`
  stating the passthrough was removed.)
- `base44.entities` frontend usages: 0.
- `asServiceRole` frontend usages: 0. (Only match is a documentation comment in
  `backendAdapter.js`.)
- direct frontend mutations: 0.
- Template B direct frontend reads: 0.
- raw provider exposure: 0.
- auth redirect fix preserved; AuthContext unchanged; App.jsx unchanged.
- `backendAdapter` / `base44Adapter` unchanged (no package import added there).
- entities, RLS unchanged.
- Phase 2–9 frozen documents unchanged.
- No frontend file modified in Wave 10.3B.

### No npm token in Base44

No npm token was requested, created, or stored in Base44. No npm credentials
belong in Base44. Publication happened in the repository owner's environment.
No package dependency was added to the root `package.json` (Base44 functions
use direct `npm:` imports, which resolve at deploy time without an app-level
dependency declaration).

### Persistent test records

0 created. No new Workflow/Schedule/BackgroundJob/audit records were created
for this wave.

### GitHub operations

0 write operations. Read-only only. (Read-only comparison with
`ppankov/pgp-platform-core` branch `main` reported separately.)

### Contract discrepancy status

The duplicate-edge identity discrepancy (deployed: `from|to|label` participates;
frozen Phase 7 spec: repeated `(from,to)` only) remains an open reconciliation
item. The package follows deployed behavior, so integration introduces no
runtime semantic change. Unchanged by Wave 10.3B; to be resolved by an
explicit future decision.

### Package reuse potential for Supabase Edge Functions

The package is plain ESM with no Base44/Deno/Supabase coupling. Supabase Edge
Functions (or any provider runtime supporting ES modules) may import it
directly via `npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/...`. Supabase
implementation is NOT started — no Supabase client, migration, or dual-runtime
behavior exists in the app. The package is structured to enable this reuse
without modification.

### Rollback

On integration regression: restore the four functions to their exact
pre-Wave-10.3B inline logic; keep the published npm package intact (do NOT
unpublish); remove the temporary probe if present; set Wave 10.3B status to
blocked; document the failure. Never use a newer/floating version as an
emergency workaround.

### Frozen contracts verification

Untouched: entities, RLS, other Base44 functions, frontend, adapters,
AuthContext, App.jsx, app `package.json`, Phase 2–9 docs. Only the four
target functions and this spec document changed in Wave 10.3B (plus
`packages/pgp-core-domain/package.json` name/version/publishConfig and README
metadata sync).

**Final result:** Phase 10 Wave 10.3 complete.

---

## Wave 10.4A — Backend Provider Contract Pilot Design

**Section status:** Wave 10.4A.1 + 10.4A.2 documentation COMPLETE; Wave 10.4A.3
single-function local provider pilot implementation COMPLETE.

**Phase status:** Phase 10 — IMPLEMENTATION, Wave 10.4 pilot. Wave 10.4 is IN
PROGRESS via the completed single-function pilot (Wave 10.4A.3); the
multi-function rollout (Wave 10.4B) has NOT started. This section records the
pilot selection, a minimal provider contract, a responsibility split, the
executed pilot implementation, a redaction decision, acceptance criteria, a
package decision, and a next decision gate.

### Pilot selection (Wave 10.4A.1 — COMPLETE)

**Selected pilot:** `base44/functions/listJobSchedules/entry.ts`.

**Selection reasons:**

- read-only
- zero persistent writes
- zero audit/event writes
- zero function-to-function calls
- zero connectors / secrets / email / AI integrations
- two entity dependencies (`JobSchedule`, `OrganizationMember`)
- bounded input (allow-listed `scope` / `scheduleType` / `sort`; limit capped
  1–500)
- exercises authentication (`base44.auth.me()`)
- exercises role gating (`READ_ROLES`, platform-scope role gate)
- exercises tenant membership (explicit organizationId gate + own-orgs
  restriction)
- exercises privileged datastore reads (`base44.asServiceRole.entities.*`)
- exercises safe payload redaction (`redact()`)
- low rollback risk (single entry.ts file, clear response shape)

**Candidates not selected (documented reasons):**

- `getLifecycleState`: no tenant scope — operates on the
  `(resourceType, resourceId)` abstraction and performs no organization
  membership check; does not exercise the tenant-scope capability required for
  a Backend Provider Contract pilot.
- `listWorkflows`: four entity dependencies and broader branching (catalog +
  versions + optional instance view) — more orchestration surface than the
  minimal pilot needs, higher regression risk.
- `listBackgroundJobs`: more complex redaction and role-based visibility
  (payload/result role gating + `sanitizeErrorText` regex + array status
  validation) — more logic than the minimal pilot needs to validate the
  contract boundary.

### Formal minimal provider contract (provider-neutral capabilities)

The contract is intentionally narrow. Only capabilities the pilot function
actually uses are described. No universal CRUD methods, no create/update/delete,
no capability the pilot does not use.

#### getCurrentUser()

- **Purpose:** resolve the calling user's identity and role.
- **Input:** none (bound to the request context by the provider adapter).
- **Output:** `{ id, role } | null`.
- **Expected error behavior:** returns `null` when unauthenticated; never
  throws — the caller maps `null` to the existing 401.
- **Current Base44 mapping:** `await base44.auth.me()`.
- **Future-provider responsibility:** provide an authenticated identity lookup
  that returns the user id and a role claim equivalent to the two-role
  (`admin`/`user`) model (or a migrated role taxonomy, out of scope here).

#### verifyOrganizationMembership(userId, organizationId)

- **Purpose:** confirm the user is an active member of a specific organization
  before revealing organization-scoped data.
- **Input:** `userId`, `organizationId`.
- **Output:** an active membership record | `null`.
- **Expected error behavior:** returns `null` when the user is not an active
  member (or when `organizationId` is empty); never throws — the caller maps
  `null` to the existing 403 "Not a member of this organization".
- **Current Base44 mapping:**
  `svc.entities.OrganizationMember.filter({ user_id: userId, organization_id: orgId })`
  then select the first `status === 'active'` record.
- **Future-provider responsibility:** resolve active membership for the
  organization tenant boundary.

#### listActiveOrganizationMemberships(userId)

- **Purpose:** enumerate the organizations the user is an active member of, for
  the own-organization restriction when no explicit `organizationId` is
  provided.
- **Input:** `userId`.
- **Output:** `organizationId[]`.
- **Expected error behavior:** returns `[]` when there are no active
  memberships or on read failure; never throws — the caller maps `[]` to the
  existing `{ schedules: [] }` response.
- **Current Base44 mapping:**
  `svc.entities.OrganizationMember.filter({ user_id: userId, status: 'active' })`
  then map to `organization_id`.
- **Future-provider responsibility:** enumerate active memberships for the
  tenant boundary.

#### filterJobSchedules(filter, sortField, limit)

- **Purpose:** read schedule records matching the constructed filter.
- **Input:** a constructed filter object (scope / organizationId /
  jobDefinitionId / scheduleType / enabled), an allow-listed sort field, and a
  capped limit (1–500).
- **Output:** `JobSchedule[]`.
- **Expected error behavior:** returns `[]` on read failure or no matches;
  never throws — the caller wraps results in the existing response shape.
- **Current Base44 mapping:**
  `svc.entities.JobSchedule.filter(filter, sortField, limit)`.
- **Future-provider responsibility:** provide a filtered read over the
  schedule record type with the same filter/sort/limit semantics.

**Contract boundary statement:** The provider contract does NOT own role
policy, tenant policy, input bounds, response shape, or redaction policy.
Those remain application/domain responsibilities (see "Responsibility split").

### Responsibility split

**A. Base44 runtime/bootstrap (provider-specific, not portable):**

- `Deno.serve(async (req) => ...)`
- `createClientFromRequest(req)`
- the request-bound Base44 client
- `base44.asServiceRole` (trusted datastore actor)

**B. Provider capabilities (the minimal contract above):**

- current user lookup (`getCurrentUser`)
- membership reads (`verifyOrganizationMembership`,
  `listActiveOrganizationMemberships`)
- schedule filtering (`filterJobSchedules`)

**C. Portable application orchestration (function-specific, not provider
contract):**

- input parsing and bounds (`scope` / `scheduleType` / `sort` allow-lists,
  limit cap 1–500)
- `READ_ROLES` gate
- platform-scope role gate (`core_developer` / `super_admin`)
- explicit organization membership gate
- own-organization restriction (no explicit org → restrict to caller's orgs;
  none → `{ schedules: [] }`)
- filter construction
- sort selection
- limit cap
- response construction (`{ schedules: safe[] }`)

**D. Pure domain/security logic (portable, already packaged where applicable):**

- `redactSecretKeys` (recursive secret masking)
- safe error text normalization (`safeMsg`, 200-char cap)

**Boundary statement:** The provider contract does not own role policy, tenant
policy, input bounds, response shape, or redaction policy. These rules remain
application/domain responsibilities.

### Proposed future pilot shape (NOT executed in Wave 10.4A.2)

Future implementation shape of `listJobSchedules/entry.ts`, documented only:

1. Base44 bootstrap creates a local adapter object that implements the minimal
   provider contract against the Base44 client.
2. A provider-neutral orchestration function receives: the parsed input, the
   provider capabilities, and the explicit user context.
3. The orchestration returns a provider-neutral result (schedule list + status
   + error code), owning role/tenant/input-bound/response policy.
4. `entry.ts` converts the provider-neutral result into the existing HTTP
   response (status codes, response shape, redaction).

**Base44 isolation boundary constraints (must hold):**

- adapter and pilot orchestration may initially remain in the same `entry.ts`
- no cross-folder local imports
- no shared backend interface file
- no mass refactor of other functions
- no second npm package until real reuse is demonstrated across multiple
  functions

### Redaction decision (NOT executed in Wave 10.4A.2)

The future pilot MAY replace its inline recursive `redact` helper with
`redactSecretKeys` from the exact pinned package
`npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/safe-data`.

This is NOT executed in Wave 10.4A.2.

Before any future migration, exact behavioral parity must be proven for:

- recursion depth
- array handling
- object handling
- secret key vocabulary
- null/primitive behavior
- source object not mutated

Do not assume parity solely because the names are similar. The migration is a
separate, explicitly-approved step.

### Pilot acceptance criteria (for a future implementation step)

- exact HTTP statuses unchanged (401 / 403 / 500 / 200)
- exact response shape unchanged (`{ schedules: [] }`)
- explicit `organizationId` without membership → 403
- platform scope without an allowed role → 403
- no organization memberships → `{ schedules: [] }`
- input allow-lists unchanged (`scope`, `scheduleType`, `sort`)
- limit remains capped 1–500
- sort behavior unchanged (allow-listed field, default `nextRunAt`)
- payload secrets remain redacted
- no writes
- no audit/event records
- no persistent test records
- no frontend changes
- rollback by restoring one `entry.ts` file

### Package decision (official)

**No new npm package is justified at this stage.**

Reason (updated after Wave 10.4A.5 — two pilots now demonstrate the same
provider-neutral architecture pattern):

- orchestration policy remains function-specific (READ_ROLES vs FULL_ROLES,
  status allow-lists, sort/limit defaults, output projection all differ per
  function)
- two pilots now demonstrate the same architecture pattern
  (`listJobSchedules`, `listBackgroundJobs`) — reusable architecture is
  proven, but reusable application code is not automatically justified
- provider capabilities are narrow and entity-specific
  (`filterJobSchedules`, `filterBackgroundJobs`); no generic CRUD
- reusable pure redaction / sanitization already exists in
  `@ppankov/pgp-core-domain@0.1.0-alpha.1` (safe-data module) — parity
  migration is a separate, explicitly-approved step, not a packaging decision
- reusable *architecture pattern* (adapter factory shape, provider-neutral
  orchestration shape, thin HTTP handler) is now proven across two
  functions; reusable *code package* is not — they are not the same thing

Re-evaluate a shared application/provider package only after the pattern is
demonstrated across more functions and after concrete duplication cost
outweighs the function-specific policy cost. Same-file pattern remains
correct for now.

### Wave 10.4A.3 — Single-function Local Provider Pilot — COMPLETE

**Changed function:** `base44/functions/listJobSchedules/entry.ts` (only).

**Implementation:**

- A same-file Base44 adapter factory `createBase44Provider(base44)` exposes
  exactly four provider-neutral capabilities: `getCurrentUser()`,
  `verifyOrganizationMembership(userId, organizationId)`,
  `listActiveOrganizationMemberships(userId)`, and
  `filterJobSchedules(filter, sortField, limit)`. No generic CRUD; the raw
  Base44 client, `svc`, and entity namespaces are not exposed outside the
  adapter.
- A provider-neutral orchestration function `executeListJobSchedules(input,
  user, provider)` owns all application policy: `READ_ROLES` gate,
  platform-scope gate, explicit-organization membership gate, own-orgs
  restriction, input allow-lists, filter construction, sort selection, limit
  cap (1–500), response shape, and inline payload redaction. It references
  only the plain input, the explicit user context, and the four provider
  capabilities — never `base44`, `svc`, entities, `Deno`, or `req`.
- The `Deno.serve` handler is thin: create the Base44 client, create the
  adapter, resolve the current user via `getCurrentUser()`, parse the request
  body, call the orchestration, and convert its `{ status, body }` result to
  the existing `Response`.
- Base44 bootstrap (`createClientFromRequest`, `base44.auth.me()`,
  `base44.asServiceRole`, entity calls) stays local to the entry file.

**Runtime behavior preserved:** exact HTTP statuses, exact response body
shapes, exact error messages, input allow-lists, limit cap (1–500), sort
behavior, tenant/membership policy, and payload redaction — all unchanged.

**Inline redaction intentionally retained:** the existing inline `redact()`
helper is unchanged. Redaction parity migration to
`@ppankov/pgp-core-domain` `redactSecretKeys` is a separate,
explicitly-approved step (not executed in this wave).

**Boundaries:**

- no shared backend module (adapter + orchestration live in the same entry.ts)
- no interface file outside entry.ts
- no new npm package; `@ppankov/pgp-core-domain` unchanged
- no other backend function changed (1 of 59)
- no frontend / entity / RLS / Phase 2–9 changes

**Rollback boundary:** restore only
`base44/functions/listJobSchedules/entry.ts` and revert this documentation
delta. No package, schema, frontend, or datastore rollback.

**Verification:** static parity (HTTP contract, tenant policy, redaction
helper unchanged). Runtime behavior preserved by construction; the
provider-neutral orchestration reproduces the original control flow and
response shapes exactly. No persistent test records created.

### Next decision gate

- **Wave 10.4A.6 (two-pilot architecture evaluation) or Wave 10.4B
  (multi-function rollout) — NOT STARTED / REQUIRES EXPLICIT APPROVAL.**
  The second-function pilot (Wave 10.4A.5) is complete, so the
  provider-neutral orchestration contract is now demonstrated across two
  functions (`listJobSchedules`, `listBackgroundJobs`).

### Wave 10.4A verification (cumulative through Wave 10.4A.5)

- Files changed (runtime): 2 — `base44/functions/listJobSchedules/entry.ts`
  (Wave 10.4A.3 single-function pilot) and
  `base44/functions/listBackgroundJobs/entry.ts` (Wave 10.4A.5 second-function
  pilot). 10.4A.1 and 10.4A.2 changed 0 runtime files (documentation only);
  10.4A.4 changed 0 runtime files (discovery only).
- Other backend functions: unchanged.
- TypeScript interface files created: 0.
- Shared local backend modules created: 0.
- npm packages created/published: 0.
- `@ppankov/pgp-core-domain`: unchanged.
- Frontend / entities / RLS / Phase 2–9 docs: unchanged.
- Runtime functions executed (read-only): Wave 10.4A.3 —
  `listJobSchedules({})` → 200 `{ schedules: [] }`; Wave 10.4A.5 —
  `listBackgroundJobs({})` → 200 `{ jobs: [] }` and
  `listBackgroundJobs({status:"__invalid_status__"})` → 400
  `{ error: "invalid status filter" }` (compile + module load + orchestration
  execute; no records created).
- GitHub write operations: 0.

**Final result:** Wave 10.4A.5 second-function local provider pilot complete;
HTTP and application contract parity preserved across two functions.

---

## Wave 10.4A.5 — Second-function Local Provider Pilot

**Section status:** COMPLETE.

**Date:** 2026-07-20.

**Phase status at execution:** "Phase 10 — IMPLEMENTATION, Wave 10.4 pilot."
This wave applied the proven same-file provider-neutral architecture pattern
from `listJobSchedules` (Wave 10.4A.3) to `listBackgroundJobs`, without
changing runtime, security, or HTTP contract.

### Changed function

`base44/functions/listBackgroundJobs/entry.ts` (only).

### Local Base44 adapter

`createBase44Provider(base44)` — same-file factory that owns all Base44
access and exposes exactly four provider-neutral capabilities:

- `getCurrentUser()` → `base44.auth.me()`
- `verifyOrganizationMembership(userId, orgId)` → active
  `OrganizationMember` membership or `null`
- `listActiveOrganizationMemberships(userId)` → active membership
  `organization_id[]`
- `filterBackgroundJobs(filter, sortField, limit)` →
  `base44.asServiceRole.entities.BackgroundJob.filter(...)`

No other capabilities. The raw Base44 client, `svc`, and entity namespaces
are not exposed outside the adapter.

### Provider-neutral orchestration

`executeListBackgroundJobs(input, user, provider)` — owns all application
policy and references only the plain input, the explicit user context, the
four provider capabilities, and the local pure security helpers. It has
zero references to `base44` / `svc` / `.entities` /
`createClientFromRequest` / `Deno` / `req` / `auth.me` / `asServiceRole`.

Orchestration responsibilities:

- `READ_ROLES` gate → 403 "Not permitted to read jobs"
- `FULL_ROLES` payload/result projection (role-dependent visibility)
- scalar/array status validation against `ALLOWED_STATUS` → 400
  "invalid status filter"
- platform-scope gate → 403 "Not permitted to read platform jobs"
- explicit-membership gate → 403 "Not a member of this organization"
- own-organizations restriction (no explicit org, non-platform scope →
  caller's orgs; none → 200 `{ jobs: [] }`)
- filter construction (scope / organizationId / jobDefinitionId /
  jobScheduleId / handlerKey / status)
- sort allow-list (`ALLOWED_SORT`, default `-createdAt`)
- limit cap (1–500)
- payload/result `redact()` for full roles, null for non-full roles
- `sanitizeErrorText()` on `lastError`
- response body construction `{ jobs: safe[] }`

### Shared capabilities with listJobSchedules

Exactly 3 (unchanged shape): `getCurrentUser`,
`verifyOrganizationMembership`, `listActiveOrganizationMemberships`.

### Entity-specific capability

Exactly 1: `filterBackgroundJobs(filter, sortField, limit)`. No generic
CRUD methods (`listEntity` / `filterEntity` / `getEntity` / `createEntity`
/ `updateEntity` / `deleteEntity`): 0.

### Role-dependent projection parity

- `FULL_ROLES` = `{core_developer, admin, super_admin}` — unchanged.
- Full roles: `payload` and `result` returned through `redact()` (recursive
  secret masking, depth cap 12, arrays/objects/null/primitives, `"[redacted]"`
  placeholder, source not mutated).
- Non-full roles: `payload = null`, `result = null` (metadata retained,
  content dropped).
- `lastError` always sanitized via `sanitizeErrorText()` (regex
  `SECRET_TEXT_KEY` key=value masking, `BEARER_TEXT` Bearer masking, 500-char
  cap) — unchanged for both full and non-full roles.

### Status validation parity

- Scalar `status` not in `ALLOWED_STATUS` → 400 `{ error: "invalid status filter" }`.
- Array `status` with any member not in `ALLOWED_STATUS` → 400
  `{ error: "invalid status filter" }`.
- Valid scalar → `filter.status = input.status`.
- Valid array → `filter.status = { $in: input.status }`.
- `ALLOWED_STATUS` = `{queued,leased,running,retry_wait,succeeded,cancelled,
  dead_letter}` — unchanged.

### Inline security helpers intentionally retained

`SECRET_KEYS`, `redact()`, `SECRET_TEXT_KEY`, `BEARER_TEXT`,
`sanitizeErrorText()`, `safeMsg()` — all unchanged inline. No import from
`@ppankov/pgp-core-domain` added in this wave. Redaction / sanitization
parity migration to the npm package is a separate, explicitly-approved
step (same constraint as Wave 10.4A.3 for `listJobSchedules`).

### Thin HTTP handler

`Deno.serve` is thin: `createClientFromRequest(req)` →
`createBase44Provider(base44)` → `provider.getCurrentUser()` → parse JSON
body (`.catch(() => ({}))` as before) → `executeListBackgroundJobs(body,
user, provider)` → `Response.json(result.body, { status: result.status })`
→ outer catch → 500 `safeMsg`. No framework, classes, or DI container.

### Static verification

- provider capabilities: exactly 4
- shared capabilities with first pilot: exactly 3
- entity-specific capabilities: exactly 1 (`filterBackgroundJobs`)
- Base44 references inside orchestration: 0
- generic CRUD methods: 0
- raw provider exposure: 0
- writes: 0
- audit/event writes: 0
- function-to-function calls: 0
- new imports: 0
- new files: 0
- other backend functions changed: 0
- frontend / entity / RLS / package changes: 0
- GitHub writes: 0

### Safe runtime checks (read-only, no persistent records)

- `listBackgroundJobs({})` → **200 `{ jobs: [] }`** (own-orgs restriction;
  current caller has no active org memberships → empty result).
- `listBackgroundJobs({ status: "__invalid_status__" })` → **400
  `{ error: "invalid status filter" }`** (status validation gate fires
  before any datastore access; no records created).

Both responses match the pre-refactor contract exactly. No jobs, users,
roles, organizations, or memberships created or modified.

### Behavioral parity matrix

28 scenarios compared before/after (unauthenticated, role outside
READ_ROLES, platform scope without platform role, explicit orgId without
membership, own active memberships, no memberships, valid org filter,
jobDefinitionId/jobScheduleId/handlerKey filters, valid scalar status, valid
status array, invalid scalar status, invalid status array member, valid
sort, invalid sort fallback, limit below 1, limit above 500, empty
datastore result, FULL_ROLES payload/result visibility, non-FULL payload/
result nulling, payload/result secret redaction, lastError sanitization,
provider/datastore error, exact success response, exact error response
shapes). All scenarios: **PASS / STATIC** (control flow, error messages,
status codes, response shapes, projection, redaction, and sanitization
reproduce the original exactly by construction) except the two safe runtime
checks above which are **PASS / RUNTIME** (confirmed). Runtime mutation
paths were not executed.

### No package

No new npm package created. `@ppankov/pgp-core-domain` unchanged. The
second pilot remains same-file (adapter + orchestration in the same
entry.ts). Package decision A (from Wave 10.4A.4) holds: a shared
application package is reconsidered only after a successful second-pilot
implementation; reusable *architecture pattern* is now demonstrated across
two functions, but reusable *code* packaging remains unjustified at 2
functions.

### Rollback boundary

Restore `base44/functions/listBackgroundJobs/entry.ts` to its pre-Wave-10.4A.5
form and revert this documentation delta. No package, schema, frontend, or
datastore rollback. `listJobSchedules/entry.ts` is not touched by this wave.

### Frozen contracts verification

Untouched: `listJobSchedules`, other backend functions, frontend, adapters,
AuthContext, App.jsx, entities, RLS, app `package.json`, Phase 2–9 docs.
Only `base44/functions/listBackgroundJobs/entry.ts` and this spec document
changed in Wave 10.4A.5.

**Final result:** Wave 10.4A.5 second-function local provider pilot complete;
HTTP and application contract parity preserved across `listJobSchedules` and
`listBackgroundJobs`.

---

## Wave 10.4A.6 — Two-pilot Architecture Evaluation

**Section status:** COMPLETE (analysis + documentation-only pass).

**Date:** 2026-07-20.

**Phase status at evaluation:** "Phase 10 — IMPLEMENTATION, Wave 10.4 pilot."
This wave evaluates the architectural outcomes of the two successful
provider-neutral backend pilots (Wave 10.4A.3 `listJobSchedules`,
Wave 10.4A.5 `listBackgroundJobs`) and formulates a bounded decision gate
for the next step. No runtime code, backend function, package, frontend,
entity, RLS, or Phase 2–9 file was changed.

### Two pilots evaluated

- `base44/functions/listJobSchedules/entry.ts` — `createBase44Provider` +
  `executeListJobSchedules` + 4 capabilities (Wave 10.4A.3).
- `base44/functions/listBackgroundJobs/entry.ts` — `createBase44Provider` +
  `executeListBackgroundJobs` + 4 capabilities (Wave 10.4A.5).

### Two-pilot comparison

| Aspect | Classification |
|---|---|
| Adapter factory shape (`createBase44Provider(base44)`) | A. structurally identical |
| Orchestration signature `(input, user, provider) → {status, body}` | A. structurally identical |
| Thin HTTP handler (create client → adapter → getCurrentUser → parse → execute → Response.json → catch 500) | A. structurally identical |
| `getCurrentUser` / `verifyOrganizationMembership` / `listActiveOrganizationMemberships` | A. structurally identical (shared capabilities) |
| Platform-scope gate (core_developer/super_admin) | A. structurally identical |
| Own-organization restriction (non-super_admin, non-platform → caller's orgs; none → empty list) | A. structurally identical |
| Sort allow-list + limit cap (1–500) | A. structurally identical (shape); values function-specific (B) |
| `safeMsg` 200-char error cap | A. structurally identical |
| `redact()` recursive secret masking | A. structurally identical (same vocabulary/depth/placeholder) |
| Input allow-lists (scope/scheduleType vs status/sort fields) | B. semantically reusable, function-specific values |
| Filter construction (fields differ: jobDefinitionId/jobScheduleId/handlerKey/status vs jobDefinitionId/scheduleType/enabled) | B. function-specific |
| Entity-specific filter capability (`filterJobSchedules` vs `filterBackgroundJobs`) | B. function-specific (entity-specific, by design) |
| Output mapping (`{schedules: redact(payload)}` vs `{jobs: FULL_ROLES projection + redact + sanitizeErrorText}`) | B. function-specific |
| Role-dependent visibility (listBackgroundJobs `FULL_ROLES` payload/result projection) | D. unique to listBackgroundJobs |
| Status validation with 400 branch (listBackgroundJobs scalar/array `ALLOWED_STATUS`) | D. unique to listBackgroundJobs |
| `sanitizeErrorText` on lastError (listBackgroundJobs) | D. unique to listBackgroundJobs |
| `scheduleType` once/interval allow-list (listJobSchedules) | C. unique to listJobSchedules |
| Rollback boundary (single entry.ts each) | A. structurally identical |

### Shared capabilities (confirmed reusable contract)

All three have identical contract and semantics across both pilots:

- `getCurrentUser()` — input: none; output: `{id, role} | null`; null when
  unauthenticated (never throws); Base44 mapping `base44.auth.me()`; tenant
  responsibility: none (identity only); **reusable contract: yes**; **reusable
  code: yes** (byte-identical adapter bodies).
- `verifyOrganizationMembership(userId, orgId)` — input: userId, orgId;
  output: active membership record `| null`; null when no/empty orgId or no
  active member (never throws); Base44 mapping
  `asServiceRole.entities.OrganizationMember.filter({user_id, organization_id})`
  → first active; tenant responsibility: explicit-membership gate; **reusable
  contract: yes**; **reusable code: yes** (byte-identical adapter bodies).
- `listActiveOrganizationMemberships(userId)` — input: userId; output:
  `organization_id[]` (empty on no memberships or read failure, never
  throws); Base44 mapping
  `asServiceRole.entities.OrganizationMember.filter({user_id, status:"active"})`
  → map `organization_id`; tenant responsibility: own-orgs restriction;
  **reusable contract: yes**; **reusable code: yes** (byte-identical adapter
  bodies).

Entity-specific capabilities remain separate — `filterJobSchedules(...)`,
`filterBackgroundJobs(...)`. No generic `filterEntity(...)` proposed.

### Code reuse conclusion

Reusable *contract*: confirmed for the three shared capabilities. Reusable
*code*: the three shared capability adapter bodies are byte-identical across
both files, but Base44 isolated-function deployment forbids cross-folder
local imports (`ISOLATE_INTERNAL_FAILURE`), so the duplication is
structurally forced, not a packaging choice. Reusable *architecture pattern*
(adapter factory shape, orchestration shape, thin handler) is proven across
two functions. Reusable *application code package* is **not** automatically
justified by reusable architecture — the orchestration policies remain
function-specific.

### Duplication assessment

| Duplicated element | Classification |
|---|---|
| Base44 adapter bootstrap (`createBase44Provider` factory + 3 shared capabilities) | acceptable same-file duplication (Base44 isolation forces it; 3 capabilities byte-identical) |
| Membership read implementations (verifyOrganizationMembership, listActiveOrganizationMemberships) | acceptable same-file duplication (byte-identical; forced by isolation) |
| Orchestration skeleton (role gate → input validation → platform gate → org scoping → filter → projection → response) | acceptable same-file duplication (shape shared, policy function-specific) |
| HTTP mapping (Deno.serve thin handler + safeMsg catch) | acceptable same-file duplication (byte-near-identical; minimal) |
| `safeMsg` | existing `@ppankov/pgp-core-domain` responsibility (not yet imported; parity migration separate step) |
| `redact` / `sanitizeErrorText` / secret vocabulary | existing `@ppankov/pgp-core-domain` responsibility (safe-data module; parity migration separate step) |
| Function-specific policy (filter fields, status validation, FULL_ROLES projection, scheduleType allow-list, sort defaults, output shape) | must remain local (function-specific by design) |

### Package decision

**A. No new package — same-file pattern remains correct.**

Evaluated separately:

1. **Provider-neutral contract package** (the 3 shared capability
   signatures): not justified at 2 functions — the contract is 3 small
   signatures; a package would add dependency + version coordination overhead
   without removing the function-specific orchestration, which is the bulk of
   each function.
2. **Base44 adapter package** (the `createBase44Provider` factory + 3 shared
   capability implementations): technically possible via exact-version `npm:`
   (proven by Wave 10.3B), but the 3 capability bodies are small and
   byte-identical duplication is forced by Base44 isolation. A package becomes
   attractive only when >2 functions share the adapter and the duplication
   cost exceeds version-coordination cost.
3. **Application orchestration package**: not justified — orchestration is
   function-specific by construction; packaging it would either be a thin
   skeleton (low value) or leak function-specific policy (wrong boundary).
4. **Existing pure-domain package reuse** (`@ppankov/pgp-core-domain`): the
   safe-data module already owns `redact`/`sanitizeErrorText` semantics; parity
   migration of the inline helpers is a separate, explicitly-approved step per
   function — not a packaging decision and not assumed automatic parity.

Re-evaluate packaging only after the pattern is demonstrated across more
functions and concrete duplication cost outweighs function-specific policy
cost.

### Third-pilot decision

**A. No third pilot needed — two pilots sufficiently prove the read-only,
single-entity pattern.**

Both pilots are read-only, single-entity, tenant-membership-scoped, bounded
input, single-file rollback. A third pilot candidate `listWorkflows` would
test a *different* pattern class (multi-entity orchestration: 3 entity
reads + in-memory filtering + instance-view branching). That is a separate
architecture question, not a prerequisite for selective rollout of the
*already-proven* read-only single-entity pattern. Selecting `listWorkflows`
now would conflate two distinct pattern classes and risk premature generic
abstraction. It is not selected automatically; it remains a documented
forward-plan candidate for a future multi-entity pattern wave, not this
gate.

### Proposed Wave 10.4B boundary

**A. Selective rollout only to structurally similar read-only protected-list
functions** (not all 59 functions; not a mass refactor).

Selection criteria (a function must satisfy all):

- read-only (no create/update/delete/bulk writes)
- tenant membership scoped (OrganizationMember membership/own-orgs)
- no writes, no audit/event writes, no function-to-function calls
- bounded input (allow-listed filter fields + sort/limit caps)
- narrow entity-specific capability (entity-specific filter name, no generic
  CRUD)
- safe read-only runtime verification possible (empty/invalid-input paths
  return pre-datastore, no persistent records)
- single-file rollback boundary

Functions satisfying all criteria are rollout candidates; functions with
multi-entity orchestration, mutations, fn-to-fn calls, or connectors are
excluded from Wave 10.4B and remain candidates for future pattern waves.
Wave 10.4B does not enumerate or modify all functions in this step; it
remains a bounded, explicitly-approved selective rollout.

### Risks

- Selective rollout could drift toward generic CRUD if entity-specific
  capability naming is not enforced per function (mitigation: entity-specific
  `filter<Entity>` names mandatory; no `filterEntity`).
- Inline `redact`/`sanitizeErrorText` duplication grows with each rolled-out
  function until parity migration to `@ppankov/pgp-core-domain` is explicitly
  approved (mitigation: parity migration is a separate per-function gate, not
  bundled into rollout).
- Base44 isolation forces same-file duplication; a premature package could
  introduce version-coordination overhead before the duplication cost
  justifies it (mitigation: package decision A holds; reconsider after more
  functions).
- Multi-entity functions (e.g. `listWorkflows`) are excluded from Wave 10.4B
  and must not be forced into the single-entity pattern (mitigation: separate
  future pattern wave).

### Rollback

Documentation-only pass. Rollback = revert the Wave 10.4A.6 documentation
delta (this section + the stale-heading/package-decision corrections). No
runtime, package, frontend, entity, RLS, or Phase 2–9 rollback. No changes
to `listJobSchedules` or `listBackgroundJobs`.

**Final result:** Wave 10.4A.6 two-pilot architecture evaluation complete.
The provider-neutral architecture pattern is proven across two read-only
single-entity functions; no new package is justified; no third pilot is
required for this pattern class; Wave 10.4B (selective rollout) is the
recommended bounded next step, subject to explicit approval.

---

## Wave 10.4B.1 — Selective Rollout Inventory and Plan

**Section status:** COMPLETE (discovery + planning + documentation-only pass).
**Date:** 2026-07-22. No runtime code, function, package, frontend, entity, RLS,
or Phase 2–9 file changed.

### Inventory methodology

Reference: `listJobSchedules`, `listBackgroundJobs` (unchanged). Static scan of
all 59 backend functions (42 mutating auto-excluded; 17 read-only inspected
against the hard filter). Attributes per function: read-only/mutating,
entities, Member usage, writes, fn-to-fn, integrations, bounds, redaction,
safe-check feasibility.

### Hard eligibility filter (all must hold)

read-only; tenant-membership-scoped (OrganizationMember); no writes; no
audit/event writes; no fn-to-fn calls; no connectors/email/AI/integrations;
bounded input or clearly limitable; one main business entity + OrganizationMember;
narrow entity-specific read capability (no generic CRUD); safe runtime check
without test records; single-file rollback.

### Excluded pattern classes

mutating; scheduler/worker (`processBackgroundJobs`, `runSchedulerTick`);
multi-entity orchestration (`listWorkflows`, `listConnectors`, `listPlugins`,
`listWorkflowStepRuns`); connector functions; audit/event-write functions;
functions requiring role/membership mutation; pilots; `listWorkflows` (excluded).

### Static scan — read-only functions (17)

| Function | entities (business + Member) | Member-scoped | multi-entity | eligible |
|---|---|---|---|---|
| getOrganizations | Organization + Member | yes | no (1) | **YES** |
| other 16 read-only fns | 1–5 business ± Member | mixed | multi-entity or no Member | no |

### Deep inspection — shortlist (1 candidate)

Only `getOrganizations` passed the hard filter (5-candidate cap not reached).

1. **Function/entities:** `getOrganizations`; Organization (main) +
   OrganizationMember (2 total). **Auth:** `auth.me()`→401 if null; no
   READ_ROLES gate; role branch: admin/super_admin→all orgs, others→
   membership-restricted (dead branches preserved exactly). **Tenant:**
   super_admin/admin→`Organization.list()`; others→
   `OrganizationMember.filter({user_id,status:'active'})`→orgIds→
   `Organization.filter({id:{$in:orgIds}}`; empty→`{organizations:[]}`.
2. **Input/output/redaction:** NO input (no `req.json()`); output
   `{status:'ok',organizations:safeOrg[]}`; `safeOrg` projects fixed fields,
   `settings` through recursive `redact` (SECRET_KEYS, depth 12,
   `'[redacted]'`), `safeMsg` 200-char on 500.
3. **Capabilities:** `getCurrentUser()` [shared, byte-identical];
   `listActiveOrganizationMemberships(userId)` [shared, byte-identical];
   `filterOrganizations(filter)` [entity-specific NEW; admin→`{}`, others→
   `{id:{$in:orgIds}}`]. 2 shared + 1 entity-specific = 3 (matches pilots).
4. **Orchestration:** null→401; admin/super_admin→`filterOrganizations({})`;
   else→`listActiveOrganizationMemberships`; empty→`{organizations:[]}`;
   else→`filterOrganizations({id:{$in:orgIds}})`; map `safeOrg`; response. 0
   Base44 refs inside orchestration.
5. **Safe checks/rollback/risk:** `getOrganizations` (no body) → 200
   `{organizations:[]}` (no memberships) or org list (admin). 0 records.
   Rollback: single `entry.ts`. Risk: LOW. Eligibility: YES.

### Ranked shortlist (1 candidate)

| pri | function | reason | entity capability | files | parity-matrix | runtime checks | risk | rollback | deps |
|---|---|---|---|---|---|---|---|---|---|
| 1 | getOrganizations | only read-only fn passing all hard criteria; 1 business entity + Member; no input; reuses 2 shared capabilities byte-identical; adds 1 narrow entity-specific read; LOW risk | `filterOrganizations(filter)` | 1 | ~14 scenarios | 1 read-only | LOW | single entry.ts | none |

No second/third candidate — the other 16 read-only functions are multi-entity or
not tenant-membership-scoped; shortlist of 1 is honest (none added to fill slots).

### Recommended batch size

**A. Implement one function per explicitly approved sub-wave.** Only one safe
candidate exists, so batch B (two functions) does not apply; batch C (stop) is
rejected (safe LOW-risk candidate exists). No mass rollout.

### Provider contract rules (for future implementation)

Shared capabilities may repeat same-file (Base44 isolation). Entity reads use
entity-specific names; generic `filterEntity`/`listEntity`/`getEntity` forbidden.
Raw Base44/`svc`/entity-namespace exposure outside adapter forbidden;
orchestration owns all policy, provider owns infrastructure only. Inline
redaction migration to `@ppankov/pgp-core-domain` is a separate gate; no new
package in Wave 10.4B; exact parity required (no bundled behavioral changes).

### Implementation acceptance template (reusable, documentation-only)

For each future candidate confirm: contract frozen before edit; exactly one
runtime function changed; same-file adapter; provider-neutral orchestration;
0 Base44 refs inside orchestration; 0 generic CRUD; HTTP parity; tenant-policy
parity; redaction parity; static parity matrix; safe read-only runtime check;
0 persistent records; single-file rollback; explicit approval before next
candidate. (Documentation template, not shared code.)

### Package decision

No new npm package in Wave 10.4B (holds Wave 10.4A.6 decision A). Reconsider only
after the pattern is demonstrated across more functions and duplication cost
exceeds function-specific policy cost.

### Risk controls

One function per approved sub-wave; entity-specific naming enforced; inline
redaction migration is a separate per-function gate; static parity matrix
required before runtime check; multi-entity detail aggregations and
platform-scoped Event Bus reads excluded (future separate pattern waves);
`listWorkflowStepRuns` excluded (WorkflowInstance join = multi-entity).

### Next decision gate

**Wave 10.4B.2 — first selective rollout candidate implementation
(`getOrganizations`) — REQUIRES EXPLICIT APPROVAL.** STOP alternative rejected
(safe candidate exists). Multi-entity detail-aggregation and platform-scoped
role-gated pattern waves remain separate future candidates, NOT part of 10.4B.

### Statuses after this pass

Wave 10.4 — IN PROGRESS. Wave 10.4B.1 — PLANNING COMPLETE. Wave 10.4B
implementation — NOT STARTED. Phase 10 frozen snapshot — NOT CREATED. Selected
functions are NOT marked as implemented.

**Final result:** Wave 10.4B.1 selective rollout planning complete.

---

## Wave 10.4B.2 — getOrganizations — First Selective Rollout — COMPLETE

**Changed function:** `base44/functions/getOrganizations/entry.ts` (only).
**Adapter:** `createBase44Provider(base44)` — 3 capabilities:
`getCurrentUser`, `listActiveOrganizationMemberships`, `filterOrganizations`.
**Orchestration:** `executeGetOrganizations(user, provider)` — 0 Base44 refs.
**Datastore parity:** empty filter → `Organization.list()` (admin); non-empty →
`Organization.filter(filter)` (restricted); call order unchanged.
**Parity:** HTTP 401/200/500, tenant/membership policy, safeOrg projection,
settings redaction, dedup, empty-membership no-org-call — all unchanged.
**Matrix:** 14 scenarios + 10 assertions — PASS / STATIC; 4 runtime-confirmed via 1 check (non-admin user, no active memberships, exact 200 `{ organizations: [] }`, no Org call on empty path); admin `list()` branch NOT runtime-executed; super_admin STATIC. **Imports:** new imports added 0; total 1 (pre-existing `@base44/sdk`).
**Runtime check:** actual non-admin caller → 200 `{ organizations: [] }`;
0 persistent records. **Rollback:** single `entry.ts`. **No package/generic CRUD.**
**Next gate:** Wave 10.4B.3 selective rollout verification & closure — APPROVAL.