# Phase 10 — Wave 10.5C.2 Provider Loading Isolation Implementation

## Status
Phase 10 — IMPLEMENTATION. Wave 10.5 — IN PROGRESS. Wave 10.5A — COMPLETE.
Wave 10.5B — COMPLETE. Wave 10.5C — IN PROGRESS. Wave 10.5C.1 — PLANNING COMPLETE.
Wave 10.5C.2 — IMPLEMENTATION COMPLETE.

## Scope
Implement Candidate C (deferred application bootstrap) to raise provider loading
isolation from L0 to L2 for the application backend path. The Base44 provider
adapter is dynamically imported only after explicit bootstrap selection;
backendAdapter reads a bound bundle synchronously. No alternate provider, no L3
bundle exclusion, no L4 frontend independence, no AuthContext change, no consumer
migration. Allowed files: created `src/services/providerBootstrap.js` and this
doc; modified `src/main.jsx`, `src/services/providerSelection.js`,
`src/services/backendAdapter.js`. No other file changed.

## Contract Freeze
A. main.jsx (before): static imports React, ReactDOM, `App from '@/App.jsx'`,
`'@/index.css'`; `ReactDOM.createRoot(...).render(<App/>)`; no dynamic imports;
no bootstrap/error UI.
B. providerSelection.js (before): imports `providerClient, fetchPublicSettings`
from base44Adapter; exports `resolveProvider`; `PROFILE_TO_FAMILY` (2 keys),
`PROVIDER_FAMILY_TO_BUNDLE` (1 family), `ERROR_CODES`, `safeProfileLabel`
(`<unconvertible>`), `validateBundle`; own-property guards; NOT_REGISTERED for
invalid/prototype; INVALID_FACADE for malformed.
C. backendAdapter.js (before): imports `appParams`, `resolveProvider`;
`resolveProvider(appParams.profile)`; exports `backend`, `catalog`; 16-entity
allow-list; synchronous facade.

## Implementation
- providerSelection.js: removed static base44Adapter import; removed `resolveProvider`;
  added `resolveProviderFamily` and `validateProviderBundle`.
- providerBootstrap.js (new): sole owner of bootstrap lifecycle; fixed loader map with
  one dynamic import of base44Adapter; state machine
  uninitialized→binding→bound|failed; `bootstrapProvider`, `getBoundProvider`.
- backendAdapter.js: replaced `appParams`/`resolveProvider` with a single synchronous
  `getBoundProvider()` call; rest unchanged.
- main.jsx: removed static App import; async `startApplication()` awaits
  `bootstrapProvider(appParams.profile)`, then dynamically imports App.jsx, then mounts;
  failure renders a minimal DOM error state with the error code.

## Provider Selection Revision
Exports now exactly: `resolveProviderFamily`, `validateProviderBundle`.
`resolveProviderFamily(profileName)`: synchronous, stateless; maps base44-cloud→base44,
local-development→base44; rejects others and inherited prototype keys with
PGP_PROVIDER_NOT_REGISTERED; loads no module. `validateProviderBundle(bundle, profileName)`:
synchronous; requires exactly `{ providerClient, fetchPublicSettings }` with providerClient
object-like having auth/functions/entities and fetchPublicSettings a function; returns a
frozen two-key bundle preserving exact references; throws PGP_PROVIDER_INVALID_FACADE.
Module: 0 imports, 0 SDK, 0 provider adapter, 0 appParams, 0 env reads, 0 dynamic imports,
0 bootstrap state.

## Bootstrap State Contract
States: uninitialized, binding, bound, failed. Transitions:
uninitialized→binding→bound, or uninitialized→binding→failed. Module-private
state: state, boundProfile, boundFamily, boundBundle, bindingPromise (none
exported). First valid bootstrap: resolve family → verify loader → binding →
run loader once → validate → bind → bound. Same profile after bound:
idempotent (no second loader call, no second client). Different profile
after bound: PGP_PROVIDER_ALREADY_INITIALIZED. Same profile during binding:
reuse in-flight promise (loader once). Different profile during binding:
PGP_PROVIDER_BOOTSTRAP_REENTRANT. Loader rejection:
PGP_PROVIDER_LOAD_FAILED (raw error not exposed). Invalid bundle:
PGP_PROVIDER_INVALID_FACADE (unwrapped). Missing loader:
PGP_PROVIDER_NOT_REGISTERED. Failed state: no bundle bound; later attempts
throw PGP_PROVIDER_LOAD_FAILED; getBoundProvider throws
PGP_PROVIDER_BOOTSTRAP_REQUIRED; reload/HMR is the retry boundary. No
fallback, no silent Base44 selection, no logging, no secret exposure.

## Main Entry Integration
Static imports: React, ReactDOM, `'@/index.css'`, `appParams`,
`bootstrapProvider`. Static App import removed. `startApplication()`:
locate root → set minimal loading text → `await bootstrapProvider(appParams.profile)`
→ `await import('@/App.jsx')` (one fixed dynamic path) → clear loading →
`ReactDOM.createRoot(root).render(<App/>)`. Failure catch: DOM `textContent`
fallback UI showing generic message + the stable `error.code` only; no
`error.message`, no stack, no env dump, no auto-retry, no redirect. Startup
called exactly once. No top-level await.

## Backend Adapter Integration
Removed: `appParams` import, `resolveProvider` import,
`resolveProvider(appParams.profile)`. Added: `getBoundProvider` import and
one synchronous module-level `getBoundProvider()` call binding
`providerClient`, `fetchPublicSettings`. Public exports unchanged: `backend`
(auth, functions, catalog, fetchPublicSettings) and `catalog` (list, filter,
get). 16-entity allow-list, method signatures, invalid-entity error string,
synchronous facade, and exact `providerClient`/`fetchPublicSettings` identity
preserved. Consumer migrations: 0.

## Startup Order
1. main.jsx evaluates. 2. appParams.profile resolved. 3. providerBootstrap
evaluates. 4. providerSelection evaluates. 5. no provider module loaded yet.
6. bootstrapProvider begins. 7. profile→family resolves. 8. base44 loader
selected. 9. base44Adapter dynamically imports. 10. createClient runs once.
11. bundle validates. 12. bundle binds. 13. App.jsx dynamically imports. 14.
AuthContext/base44Client import base44Adapter from module cache. 15.
backendAdapter reads bound bundle synchronously. 16. React mounts. 17.
AuthProvider effects may initiate traffic. createClient after explicit
selection and before App evaluation; App before React mount; one client only.

## Static and Module Verification
Static source assertions: 59/59 pass. Behavioral state-machine probe (replica of
providerBootstrap logic, injected stubbed loader): 19/19 pass — pre-bootstrap
getBoundProvider, valid bind (loader once, frozen, 2 keys), identity preserved,
repeated same-profile (0 extra), concurrent same-profile (loader once),
different-after-bound (ALREADY_INITIALIZED), different-during-binding (REENTRANT),
loader rejection (LOAD_FAILED, raw error not exposed), invalid bundle
(INVALID_FACADE), missing loader (NOT_REGISTERED), failed-state binds nothing,
getBoundProvider-after-failure (BOOTSTRAP_REQUIRED), no-fallback retry
(LOAD_FAILED), unregistered profile (NOT_REGISTERED), prototype key
(NOT_REGISTERED). createClient absent from bootstrap module; loader map one
family, fixed path; state not exported.

## Import Graph
After: main.jsx browser entry count unchanged (1). Static App.jsx importers
from main: 0. Dynamic App.jsx imports from main: 1. providerBootstrap
importers: 2 (main.jsx, backendAdapter.js). providerSelection importers: 1
(providerBootstrap.js). base44Adapter static importers: 1 (base44Client.js).
base44Adapter dynamic importers: 1 (providerBootstrap.js). base44Client
importers: 1 (AuthContext.jsx). backendAdapter importers: unchanged (17).
Direct @base44/sdk importers: unchanged (2: AuthContext, base44Adapter).
createClient locations: 1 (base44Adapter.js). Dynamic import locations added:
2 (App.jsx from main.jsx; base44Adapter from providerBootstrap.js).
Top-level await: 0. VITE_APP_ENVIRONMENT_PROFILE reads: 1 (app-params.js).
Circular imports added: 0. Consumer migrations: 0. New direct providerClient
consumer paths: 0.

## Build and Bundle Evidence
BUILD — NOT EXECUTED. Shell/npm build not available in this environment. No
PASS inferred. Per C.1 plan, dynamic import produces a lazy chunk but does not
prove L3 bundle exclusion; Base44 code may remain present in emitted assets.
Chunk topology to be recorded by owner via `npm run build`.

## Preview Evidence
PREVIEW — NOT EXECUTED. Live preview not available in this environment. No
PASS inferred. Owner to confirm: default profile shows loading then App
loads; bootstrap succeeds; no blank screen; no bootstrap error UI; routing
and Base44 connectivity preserved; no records created/changed.

## Behavioral Parity
Preserved: default profile resolution; base44-cloud/local-development mappings;
invalid-profile behavior; bundle validation; providerClient and
fetchPublicSettings identity; createClient count (1) and option shape;
backendAdapter exports/keys; catalog allow-list, list/filter/get, invalid-entity
behavior; 17 consumer import paths; AuthContext compatibility path; base44Client
shim; first authenticated network behavior; auth/tenant/RLS behavior; no
persistent state. Intentional differences: App.jsx static→dynamic import;
provider adapter loads after explicit selection; backendAdapter reads a bound
bundle; startup has a temporary loading/error state; bootstrap failure prevents
React mount.

## AuthContext Limitation
AuthContext.jsx and base44Client.js unchanged. AuthContext remains platform-managed
and still directly imports Base44 SDK utilities and the Base44 compatibility shim.
For current Base44 profiles those imports resolve from module cache after bootstrap.
A future non-Base44 profile would still load Base44 through AuthContext. L4 remains
blocked. This wave achieves L2 only for the application backend path; no private-demo
or enterprise-offline operation. Not described as complete frontend provider
independence.

## Rollback
1. delete `src/services/providerBootstrap.js`. 2. restore main.jsx: static
App import, direct createRoot/render. 3. restore providerSelection.js to
Wave 10.5B.4 contract: static base44Adapter import, `resolveProvider`.
4. restore backendAdapter.js: `appParams` import, `resolveProvider` import,
`resolveProvider(appParams.profile)`. 5. delete this document. No rollback
required for App.jsx, base44Adapter.js, base44Client.js, AuthContext.jsx,
app-params.js, environment-profile.js, package/lock files, vite.config.js,
backend functions, entities/RLS, pgp-core-domain, or any Wave 10.5A/B/C.1 or
Phase 2–9 documents.

## Residual Risks
- Eager Base44 import limitation: reduced for the application backend path
  (L2) but not eliminated — AuthContext still eagerly imports the SDK (L4 blocked).
- L3 bundle exclusion not guaranteed by dynamic import; Base44 code may remain
  in emitted assets.
- main.jsx is now async; a bootstrap failure prevents React mount with a static
  error state (owner to confirm HMR does not regress).
- Profile names are descriptive metadata, not security boundaries.
- Phase 10 not frozen; build/preview not executed here.

## Next Decision Gate
Wave 10.5C.3 — provider-loading isolation verification and closure
evaluation. REQUIRES EXPLICIT APPROVAL. Do not mark Wave 10.5C, Wave 10.5, or
Phase 10 complete.

## Final Result
Wave 10.5C.2 deferred application bootstrap and provider-loading isolation
implementation complete.