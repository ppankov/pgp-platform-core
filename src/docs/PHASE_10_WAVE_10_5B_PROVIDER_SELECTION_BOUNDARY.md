# Phase 10 — Wave 10.5B Provider Selection Boundary

**Document authority:** Authoritative planning record for Wave 10.5B.1. Supplements Wave 10.5A records without modifying or weakening Phase 2–9 frozen contracts or existing Phase 10 architecture rules. Planning only — no runtime code, no provider selection implemented, no alternate provider.
**Date:** 2026-07-25.

## Status

| Field | Value |
|---|---|
| Phase | 10 — IMPLEMENTATION |
| Wave 10.5A | COMPLETE |
| Wave 10.5B.1 (this planning) | PLANNING COMPLETE |
| Wave 10.5B implementation | NOT STARTED |
| Provider selection | NOT IMPLEMENTED |
| Alternate provider | NOT IMPLEMENTED |
| Private demo / Enterprise offline | NOT IMPLEMENTED |
| Phase 10 frozen snapshot | NOT CREATED |
| Next gate | Wave 10.5B.2 provider-selection boundary implementation — REQUIRES EXPLICIT APPROVAL |

## Scope

Discovery + contract planning only. Establish the current frontend provider graph, freeze the public adapter contracts, classify provider bypasses, analyze eager/lazy initialization, evaluate boundary candidates, and select one bounded Wave 10.5B.2 implementation candidate. No source changes, no build/Preview, no dependencies, no records, no GitHub operations.

## Method

Targeted source inspection of the required files plus a filesystem scan of all 142 frontend source files (`src/**/*.{js,jsx,ts,tsx}`) for: `backendAdapter`, `base44Adapter`, `base44Client`, `@base44/sdk`, `createClient(`, `appParams`, `environment-profile`, `VITE_APP_ENVIRONMENT_PROFILE`, dynamic `import(`, React context/Provider, and direct `base44.*` usage. Counts are actual search results, not inferred.

## Current Module Graph

| Module | Imports | Exports | Init / side effects | Consumers | Portability role |
|---|---|---|---|---|---|
| `src/lib/environment-profile.js` | 0 | `KNOWN_PROFILES`, `DEFAULT_ENVIRONMENT_PROFILE`, `ENVIRONMENT_PROFILE_ERROR_CODES`, `resolveActiveProfile`, `describeProfile` | none (pure) | `app-params.js` only | profile descriptor (Wave 10.5A) |
| `src/lib/app-params.js` | `environment-profile` | `appParams` (`{appId,token,fromUrl,functionsVersion,appBaseUrl,profile}`) | eager: `getAppParams()` runs at import; reads `import.meta.env`, URL, localStorage; strips `access_token` from URL | `base44Adapter.js`, `AuthContext.jsx` | boot-param + profile resolution |
| `src/services/base44Adapter.js` | `@base44/sdk` (`createClient`, `createAxiosClient`), `app-params` | `providerClient`, `fetchPublicSettings()` | **EAGER**: top-level `const { appId, token, functionsVersion, appBaseUrl } = appParams; createClient({...})` runs at import; one singleton | `backendAdapter.js`, `base44Client.js` (shim) | canonical Base44 provider implementation |
| `src/services/backendAdapter.js` | `base44Adapter` | `backend` (`{auth, functions, catalog, fetchPublicSettings}`), `catalog` (`{list, filter, get}`) | synchronous; no `createClient`; delegates to `providerClient` | 17 frontend files | **authoritative provider-neutral facade** |
| `src/api/base44Client.js` | `base44Adapter` | re-exports `providerClient as base44` | none (shim) | `AuthContext.jsx` only | COMPATIBILITY SHIM |
| `src/lib/AuthContext.jsx` | `base44Client` (`base44`), `@base44/sdk/dist/utils/axios-client` (`createAxiosClient`), `app-params` | `AuthProvider`, `useAuth` | platform-managed; uses `base44.auth.*` + `createAxiosClient` | `App.jsx`, `ProtectedRoute`, etc. | platform-managed direct bypass |

Findings: `createClient(` is called in exactly **1** frontend file (`base44Adapter.js`); no other frontend file constructs a Base44 client. Exactly **1** Base44 client singleton (`providerClient`) exists. `appParams.profile` is resolved at `app-params.js` import time, which runs **before** `base44Adapter.js` reads `appParams` — so the profile is available before provider construction today (though `base44Adapter.js` does not yet consume it). No circular imports exist (edge direction: app-params → environment-profile; base44Adapter → app-params; backendAdapter → base44Adapter; base44Client → base44Adapter; consumers → backendAdapter).

## Public Contract Freeze

**A. backendAdapter.js** — exports `backend` object (`{ auth, functions, catalog, fetchPublicSettings }`) and `catalog` object (`{ list(entityName, opts), filter(entityName, filters, opts), get(entityName, id) }`). All synchronous; consumers rely on singleton identity of `backend.auth` / `backend.functions` (direct references to `providerClient.auth` / `providerClient.functions`). Methods are not invoked at import time by consumers. Changing `backend` to a Promise/async would break all 17 consumers (they `await backend.*` per call but import `backend` synchronously). Frozen: synchronous facade, stable export identity.

**B. base44Adapter.js** — exports `providerClient` (Base44 client instance, constructed eagerly) and `fetchPublicSettings()` (async). `createClient` options frozen: `{ appId, token, functionsVersion, serverUrl: '', requiresAuth: false, appBaseUrl }`. Owns auth/entities/functions access via `providerClient`; `catalog` is built in `backendAdapter` over `providerClient.entities`. Top-level initialization has side effects (client construction + axios client on demand).

**C. base44Client.js** — location `src/api/base44Client.js`; re-exports `providerClient as base44` from `base44Adapter`; **1** active importer (`AuthContext.jsx`); it bypasses `backendAdapter` (platform-managed); still required for compatibility because AuthContext is platform-managed and blocked from migration (Wave 10.1 documented blocker).

## Provider Bypass Inventory

| Path | Classification | Count |
|---|---|---|
| `backendAdapter.js` importers | AUTHORITATIVE PROVIDER-NEUTRAL PATH | 17 |
| `base44Adapter.js` importers | PROVIDER IMPLEMENTATION INTERNAL | 2 (`backendAdapter.js`, `base44Client.js`) |
| `base44Client.js` importers | COMPATIBILITY SHIM | 1 (`AuthContext.jsx`) |
| direct `@base44/sdk` frontend importers | DIRECT PROVIDER BYPASS (platform-managed) | 2 (`base44Adapter.js` intended; `AuthContext.jsx` platform-managed blocker) |
| `createClient(` outside `base44Adapter.js` | — | 0 |
| `VITE_APP_ENVIRONMENT_PROFILE` reads | — | 1 (`app-params.js` only) |
| `environment-profile` importers outside def | — | 1 (`app-params.js`) |
| dynamic `import(` in frontend | — | 0 |
| direct `base44.entities/auth/functions` usage | DIRECT PROVIDER BYPASS | `AuthContext.jsx` (platform-managed, via shim) + `base44Client.js` (re-export statement only) |

Bypasses that would bypass future provider selection: `AuthContext.jsx` (platform-managed, not migratable without a platform change). Not migrated in this wave; out of scope for Wave 10.5B.2 because both currently selectable profiles resolve to the Base44 adapter anyway, so the AuthContext shim continues to resolve to the same singleton.

## Selection Boundary Requirements

The future boundary must: receive an already-resolved profile (never read `import.meta.env`/`process.env`/URL/localStorage); never load secrets, perform auth/tenant decisions, weaken RLS, use profile names as a security boundary, or silently fall back to Base44; use an explicit allow-listed provider-family mapping; prevent duplicate provider/client construction; preserve the existing `backendAdapter` public contract and all consumer import paths; expose no raw SDK/provider namespace or generic CRUD; reject unregistered provider families with a stable non-secret error; avoid user-controlled provider-module-path construction and hostname detection; not place selection at individual call sites. Current mappings to preserve: `base44-cloud` → base44 adapter; `local-development` → base44 adapter; `private-demo` / `enterprise-offline-future` → NOT IMPLEMENTED (already rejected by `resolveActiveProfile`, never reach selection).

## Eager-Import Analysis

`base44Adapter.js` is imported **statically** by `backendAdapter.js` (top-level `import`), and `base44Adapter.js` constructs `providerClient` at module top level. Therefore any consumer importing `backend` triggers Base44 client construction at import time. No dynamic `import(` exists anywhere in frontend source. Classification: **BLOCKED BY EAGER PROVIDER IMPORT/INITIALIZATION** — a future portability limitation (a private-demo / enterprise-offline build cannot currently avoid constructing a Base44 client), not a current regression. Not solved in this wave; documented as residual. `appParams.profile` is, however, resolved before `base44Adapter` runs, so the profile is available to a selector at construction time.

## Candidate Comparison

| Candidate | Consumer compat | Init safety | Offline suitability | Scope/risk | Decision |
|---|---|---|---|---|---|
| A. Selection inside `backendAdapter.js` | preserved (sync facade, same imports) | safe (profile already resolved) | still eager (static import of base44Adapter) | small — 1 file edited | **SELECTED** |
| B. Selection inside `base44Adapter.js` | preserved | safe | still eager | couples selection into provider adapter (rejected by spec) | REJECTED |
| C. Bootstrap/context injection (`main.jsx`/`App.jsx`/context) | breaks 17 consumers (they import `backend` directly, not via context) | mass migration risk | could be lazy | large — mass consumer migration | REJECTED |
| D. Selection at call sites | breaks all call sites | spread selection logic | per-call overhead | large — 17 consumers edited | REJECTED |

## Recommended Contract

**Authoritative boundary:** a new small module `src/services/providerSelection.js`. `backendAdapter.js` imports `resolveProvider` from it instead of importing `providerClient`/`fetchPublicSettings` directly from `base44Adapter.js`.

- **Input:** `profileName` (string, already resolved by `resolveActiveProfile` via `app-params.js`). The selector never reads `import.meta.env`.
- **Registry/mapping ownership:** selector owns an immutable allow-listed map `{ "base44-cloud": "base44", "local-development": "base44" }`. No user-controlled module paths; family is a fixed string.
- **Factory/instance ownership:** selector imports `base44Adapter` statically (for the first wave) and returns `{ providerClient, fetchPublicSettings }` for family `base44`. One Base44 client instance preserved (re-export of the existing singleton).
- **Selection timing:** synchronous, at `backendAdapter.js` module load (profile already resolved). The first selector **can and must remain synchronous** — both selectable profiles map to the same Base44 adapter, so no dynamic import is needed. A future lazy/dynamic transition (for offline builds) is a separate later gate.
- **Returned shape:** `{ providerClient, fetchPublicSettings }` (identical to what `backendAdapter` imports today).
- **Singleton rules:** `providerClient` identity unchanged; `backend.auth`/`backend.functions`/`catalog` reference the same instance.
- **Failure behavior:** selectable profile with no registered family → throw `Error` with `code: "PGP_PROVIDER_NOT_REGISTERED"`. Profiles already rejected by `resolveActiveProfile` (private-demo/enterprise/unknown) never reach the selector.
- **Public exports preserved:** `backendAdapter` still exports `backend` + `catalog` with the same shape.
- **Relationships:** `base44Adapter.js` unchanged; `base44Client.js` shim unchanged (AuthContext still resolves to the same `providerClient`); `app-params.js` unchanged.

## Error Ownership

- **environment-profile layer** (unchanged): unknown profile → `PGP_ENV_PROFILE_UNKNOWN`; known but NOT_IMPLEMENTED → `PGP_ENV_PROFILE_NOT_IMPLEMENTED`. (No alteration to existing codes.)
- **provider-selection layer** (proposed): selectable profile with no registered provider family → `PGP_PROVIDER_NOT_REGISTERED`; provider factory returns invalid facade → `PGP_PROVIDER_INVALID_FACADE`; duplicate provider initialization, if detectable → `PGP_PROVIDER_DUPLICATE_INIT`. Requirements: no secrets, no env dumps, no silent fallback, no raw provider exceptions exposed without sanitization, fail before normal application traffic when possible.

## Provider Facade Contract

Minimum existing public facade a future provider must satisfy (from `backendAdapter` exports + consumer usage):

| Area | Current Base44 impl | Used by consumers | Required for first selector | Required for future alternate provider | Gap |
|---|---|---|---|---|---|
| `backend.auth` | `providerClient.auth` (`me`, `isAuthenticated`, `logout`, `redirectToLogin`, `updateMe`) | yes (auth pages, ProtectedRoute via AuthContext) | yes (passthrough) | yes | identity migration is out of scope |
| `backend.functions` | `providerClient.functions.invoke` (callFn) | yes (17 consumers via `callFn`) | yes (passthrough) | yes | function runtime is Base44-hosted |
| `backend.catalog` | `list/filter/get` over `providerClient.entities` with Template A/C allow-list (16 entities) | yes (engine widgets, lifecycle/job pages) | yes (passthrough) | yes (needs equivalent filtered read) | datastore RLS migration is Class D |
| `backend.fetchPublicSettings` | `base44Adapter.fetchPublicSettings` (axios) | yes (AuthContext bootstrap) | yes (passthrough) | yes | auth bootstrap is provider-specific |

No universal CRUD interface invented. No local datastore/auth designed.

## First Implementation Candidate

**Candidate name:** `provider-selection-boundary` (Wave 10.5B.2).
**Files created:** `src/services/providerSelection.js`.
**Files modified:** `src/services/backendAdapter.js` (replace its `base44Adapter` import with a `resolveProvider(appParams.profile)` call; the rest of the file unchanged).
**Exported API:** `resolveProvider(profileName) -> { providerClient, fetchPublicSettings }`.
**Mapping contract:** `{ "base44-cloud": "base44", "local-development": "base44" }` → base44 adapter; unregistered family → `PGP_PROVIDER_NOT_REGISTERED`.
**Initialization contract:** synchronous; statically imports `base44Adapter` (eager Base44 construction retained — documented residual limitation); one `providerClient` singleton re-exported.
**Stable error contract:** `PGP_PROVIDER_NOT_REGISTERED` (and proposed `PGP_PROVIDER_INVALID_FACADE` / `PGP_PROVIDER_DUPLICATE_INIT` reserved).
**Acceptance criteria:** as in §15.
**Static verification:** source scan for: exactly one `resolveProvider` import in `backendAdapter`; `createClient` still only in `base44Adapter`; no new `@base44/sdk` importer; `profile` not reaching `createClient`; mapping immutable; unregistered family throws expected code.
**Build/Preview:** `npm run build` + Preview with profile absent → base44-cloud → identical behavior (to be confirmed by repository owner).
**Rollback boundary:** delete `providerSelection.js` + revert `backendAdapter.js` import change. No other rollback.
**Residual limitation:** Base44 import remains eager; offline/private builds still cannot avoid Base44 construction (future lazy/dynamic gate).
**Non-goals:** no alternate provider, no dynamic import, no AuthContext migration, no UI selector, no env changes, no generic CRUD, no auth/tenant/RLS changes.

## Acceptance Criteria

(Wave 10.5B.2 must satisfy; not yet implemented in B.1.) `backendAdapter` consumer API unchanged; consumer import paths unchanged; `createClient` options unchanged; Base44 client count = 1; base44-cloud behavior unchanged; local-development remains Base44-backed; private-demo/enterprise-offline remain NOT IMPLEMENTED; no provider selected from URL/localStorage/hostname; no silent Base44 fallback; no raw Base44 client exposure; no generic CRUD; no auth/tenant/RLS changes; no backend-function changes; no package dependency; no persistent records; bounded rollback; build + Preview testable.

## Residual Risks

- Base44 import remains eager — offline/private builds still construct Base44 (future lazy/dynamic transition gate, separate from B.2).
- `AuthContext.jsx` direct bypass (platform-managed) is not covered by the selection boundary; continues to resolve to the same Base44 singleton (acceptable while only Base44 is selectable).
- `npm run build` and Preview not executable in the planning environment; repository owner must confirm in B.2.
- Profile names must remain descriptive metadata, not a security boundary.
- Phase 10 is not frozen; environment portability is not complete.

## Next Decision Gate

**Wave 10.5B.2 — provider-selection boundary implementation — REQUIRES EXPLICIT APPROVAL.** Must not implement an alternate provider. Wave 10.5 is not complete; Phase 10 is not frozen.

## Final Result

**Wave 10.5B.1 provider-selection boundary planning complete.** Planning decision: A (PLANNING COMPLETE). One bounded Wave 10.5B.2 candidate (`providerSelection.js` + `backendAdapter.js` import swap) selected; synchronous facade preserved; no alternate provider proposed.