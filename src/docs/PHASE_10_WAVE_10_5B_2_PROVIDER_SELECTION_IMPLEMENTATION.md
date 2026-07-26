# Phase 10 — Wave 10.5B.2 Provider Selection Implementation

**Document authority:** Authoritative implementation record for Wave 10.5B.2. Supplements the Wave 10.5B.1 planning record without modifying or weakening Phase 2–9 frozen contracts or existing Phase 10 architecture rules.
**Date:** 2026-07-25.

## Status

| Field | Value |
|---|---|
| Phase | 10 — IMPLEMENTATION |
| Wave 10.5A | COMPLETE |
| Wave 10.5B.1 (planning) | COMPLETE |
| Wave 10.5B.2 (this implementation) | IMPLEMENTATION COMPLETE |
| Wave 10.5B implementation | IN PROGRESS (provider-selection boundary implemented for current Base44-backed profiles) |
| Provider-selection boundary | IMPLEMENTED |
| Alternate provider | NOT IMPLEMENTED |
| Private demo / Enterprise offline | NOT IMPLEMENTED |
| Eager Base44 import limitation | REMAINS |
| Phase 10 frozen snapshot | NOT CREATED |
| Next gate | Wave 10.5B.3 verification & closure — REQUIRES EXPLICIT APPROVAL |

## Scope

Files created: `src/services/providerSelection.js`, this document. Files modified: `src/services/backendAdapter.js` (import swap + one `resolveProvider` call). Not modified: `base44Adapter.js`, `base44Client.js`, `AuthContext.jsx`, `app-params.js`, `environment-profile.js`, `main.jsx`, `App.jsx`, `vite.config.js`, `package.json`, `package-lock.json`, backend functions, entities, RLS, `pgp-core-domain`, Phase 2–9 docs, Wave 10.4/10.5A/10.5B.1 docs. No alternate provider, no dynamic/lazy import, no private-demo, no enterprise-offline, no DI/context, no generic CRUD, no consumer migration, no auth/tenant/RLS changes, no package deps, no records, no GitHub operations.

## Contract Freeze

Pre-edit `backendAdapter.js` recorded: imports `{ providerClient, fetchPublicSettings }` from `@/services/base44Adapter`; exports `backend` (`{ auth, functions, catalog, fetchPublicSettings }`) and `catalog` (`{ list, filter, get }`); synchronous; `assertReadable` rejects Template B / unknown names against the 16-entity Template A + Template C allow-list (`ApplicationDefinition`…`AuditKnowledgeArticle`, `PlatformRole`, `Permission`, `RolePermission`); `backend.auth === providerClient.auth`, `backend.functions === providerClient.functions`; `catalog` delegates to `providerClient.entities[entityName]`; `createClient` only in `base44Adapter.js`; one Base44 singleton; 17 frontend importers (all import `backend`); `base44Adapter` importers 2 (`backendAdapter`, `base44Client`); `base44Client` importers 1 (`AuthContext`, platform-managed). Nothing in this contract was changed except the source of the `providerClient`/`fetchPublicSettings` binding.

## Implementation

`providerSelection.js` — internal module exporting exactly one public symbol `resolveProvider(profileName)`. Imports only `{ providerClient, fetchPublicSettings }` from `@/services/base44Adapter` (allowed). Contains an immutable `PROFILE_TO_FAMILY` (2 keys) and immutable `PROVIDER_FAMILY_TO_BUNDLE` (1 family `base44`); a `validateBundle` structural check; and `resolveProvider`. No `createClient`, no `@base44/sdk` direct import, no appParams/environment-profile import, no dynamic import, no clone/Proxy/wrapper of `providerClient`. Internal `ERROR_CODES` not exported. `PGP_PROVIDER_DUPLICATE_INIT` not implemented (reserved in planning only — no second `createClient` path exists and JS module caching preserves the singleton).

`backendAdapter.js` — replaced the single `base44Adapter` import with `import { appParams } from '@/lib/app-params'` + `import { resolveProvider } from '@/services/providerSelection'` and `const { providerClient, fetchPublicSettings } = resolveProvider(appParams.profile)`. The remainder of the file (allow-list, `assertReadable`, `catalog`, `backend`) is unchanged. `resolveProvider` is called exactly once at module init; only `appParams.profile` (string) is passed.

## Mapping Contract

Profile → family (immutable, exactly 2 keys): `base44-cloud` → `base44`; `local-development` → `base44`. No aliases, hostname/URL/localStorage/wildcard/default mappings. Family → bundle (immutable, exactly 1 family): `base44` → frozen `{ providerClient, fetchPublicSettings }` — the existing Base44 singleton, not cloned. Any profile absent from the mapping (private-demo, enterprise-offline-future, unknown string, undefined, null, non-string) throws `PGP_PROVIDER_NOT_REGISTERED`. `resolveProvider` never silently falls back to Base44; in normal flow unknown/NOT_IMPLEMENTED profiles are already rejected earlier by `environment-profile.js` (`resolveActiveProfile`), so the selector provides defense in depth only.

## Backend Adapter Integration

`resolveProvider(appParams.profile)` is called once at module load; `appParams.profile` is already resolved to `base44-cloud` when `VITE_APP_ENVIRONMENT_PROFILE` is absent. The destructured `providerClient` and `fetchPublicSettings` are the same singleton/function references previously imported directly. `backend.auth` / `backend.functions` / `backend.fetchPublicSettings` identity preserved; `catalog` still delegates to `providerClient.entities`. No `import.meta.env` read added to `backendAdapter`; no URL/localStorage/hostname auto-detection.

## Import Graph

Verified AFTER (filesystem scan of 142 frontend files): `providerSelection` importers = 1 (`backendAdapter.js`); `base44Adapter` importers = 2 (`providerSelection.js`, `base44Client.js`); `base44Client` importers = 1 (`AuthContext.jsx`); `createClient(` locations = 1 (`base44Adapter.js`); direct `@base44/sdk` importers = 2 (unchanged); `VITE_APP_ENVIRONMENT_PROFILE` reads = 1 (`app-params.js`); dynamic `import(` = 0; new circular imports = 0. Graph: `environment-profile → app-params → backendAdapter → providerSelection → base44Adapter`; and separately `AuthContext → base44Client → base44Adapter`. Both paths resolve to the same `providerClient` singleton.

## Static and Module Verification

Inline non-persistent Node `vm` probe (stubbed Base44 bundle; source transformed ESM→return; no probe file persisted) + import-graph scan: 55 assertions, 55 PASS, 0 FAIL. Highlights: exports exactly one public symbol (`resolveProvider`); mapping exactly 2 keys, frozen; family map exactly `base44`, frozen; `base44-cloud`/`local-development` resolve to the same `providerClient` and `fetchPublicSettings` identity; returned bundle exactly 2 keys, frozen; private-demo/enterprise/unknown/undefined/null/non-string/object/boolean all throw `PGP_PROVIDER_NOT_REGISTERED` (Error instances, exact `.code`, no env dump); invalid-facade cases (non-function `fetchPublicSettings`, missing `auth`/`functions`/`entities`, null `providerClient`) throw `PGP_PROVIDER_INVALID_FACADE`; no `appParams`/`environment-profile`/`backendAdapter`/`base44Client`/`AuthContext`/`@base44/sdk` import in selector; no `createClient`, no dynamic import, no env read; `backendAdapter` calls `resolveProvider` once with `appParams.profile`; exports (`backend`, `catalog`) and allow-list unchanged; synchronous. Classification: STATIC / MODULE.

## Build and Preview Evidence

- Module-level probe: EXECUTED (55 assertions, see above).
- `npm run build`: NOT EXECUTED (agent sandbox has no npm/shell runtime).
- Preview: NOT EXECUTED (sandbox cannot drive the live Base44 Preview). Repository owner to confirm with `VITE_APP_ENVIRONMENT_PROFILE` absent/default (base44-cloud → identical behavior).

## Behavioral Parity

BEFORE vs AFTER: backendAdapter import contract — STATIC PASS (sync facade preserved); backend export shape (`auth, functions, catalog, fetchPublicSettings`) — STATIC PASS; catalog export shape (`list, filter, get`) — STATIC PASS; `backend.auth`/`backend.functions`/`fetchPublicSettings` identity — MODULE PASS (same singleton returned via selector); catalog allow-list + list/filter/get/invalid-entity behavior — STATIC PASS; `createClient` call count = 1, options byte-for-byte unchanged — STATIC PASS; providerClient singleton count = 1 — STATIC PASS; base44-cloud/local-development behavior — MODULE PASS; private-demo/enterprise-offline — NOT_REGISTERED (MODULE PASS, defense in depth); AuthContext shim path — STATIC PASS (unchanged, resolves to same singleton); consumer import paths (17) — STATIC PASS (unchanged); network/auth/tenant/RLS/persistent state — STATIC PASS (no change); eager initialization — STATIC PASS (unchanged / preserved limitation). BUILD / PREVIEW — NOT EXECUTED. Eager initialization has NOT been removed.

## Security Boundaries

Profile names remain descriptive configuration metadata only — not authorization, tenant isolation, RLS, licensing, security bypass, or deployment proof. The selector never reads env/URL/localStorage, loads no secrets, performs no auth/tenant decisions, weakens no RLS, exposes no raw SDK/provider namespace or generic CRUD, and never silently falls back to Base44. Errors are Error instances with a stable `.code`, no secrets, no env/provider dumps. Server authorization and tenant enforcement remain mandatory.

## Eager-Import Limitation

This wave creates a provider-selection boundary but does **not** solve the eager Base44 import limitation. `base44Adapter` is still statically imported by `providerSelection`, which is statically imported by `backendAdapter`; `providerClient` is still constructed at module top level. Private/offline builds still cannot avoid loading Base44 in this wave. Removing this requires a future lazy/dynamic transition gate, separate from Wave 10.5B.2.

## Rollback

Rollback requires only: (1) delete `src/services/providerSelection.js`; (2) restore `src/services/backendAdapter.js` to its pre-Wave-10.5B.2 form (re-instate `import { providerClient, fetchPublicSettings } from '@/services/base44Adapter'`, remove the `appParams`/`resolveProvider` imports and call); (3) delete this document. No rollback required for `base44Adapter.js`, `base44Client.js`, `AuthContext.jsx`, `app-params.js`, `environment-profile.js`, `package.json`/lock, backend functions, entities, RLS, `pgp-core-domain`, Phase 2–9 docs, Wave 10.4/10.5A/10.5B.1 docs.

## Residual Risks

- Eager Base44 import remains; offline/private builds still construct Base44 (future lazy/dynamic gate).
- `AuthContext.jsx` direct bypass (platform-managed) is not covered by the boundary; continues to resolve to the same Base44 singleton (acceptable while only Base44 is selectable).
- `npm run build` and Preview not executed in this environment; repository owner must confirm.
- Profile names must not be treated as a security boundary.
- Phase 10 is not frozen; environment portability is not complete.

## Next Decision Gate

**Wave 10.5B.3 — provider-selection implementation verification and closure evaluation — REQUIRES EXPLICIT APPROVAL.** Wave 10.5B is not marked complete; Wave 10.5 is not marked complete; Phase 10 is not marked frozen.

## Final Result

**Wave 10.5B.2 provider-selection boundary implementation complete.**