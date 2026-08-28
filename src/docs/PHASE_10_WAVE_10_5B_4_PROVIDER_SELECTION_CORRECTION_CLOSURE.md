# Phase 10 — Wave 10.5B.4 Provider Selection Correction and Closure

**Document authority:** Authoritative current closure record for Wave 10.5B after bounded correction. Supplements and supersedes only the Wave 10.5B.3 closure decision, preserving that document as historical evidence. Does not modify or weaken Phase 2–9 frozen contracts or existing Phase 10 architecture rules.
**Date:** 2026-07-25.

## Status

| Field | Value |
|---|---|
| Phase | 10 — IMPLEMENTATION |
| Wave 10.5A | COMPLETE |
| Wave 10.5B.1 (planning) | COMPLETE |
| Wave 10.5B.2 (implementation) | COMPLETE |
| Wave 10.5B.3 (verification) | COMPLETE (bounded correction required at that point) |
| Wave 10.5B.4 (this correction + re-verification) | CORRECTION AND RE-VERIFICATION COMPLETE |
| Wave 10.5B | COMPLETE |
| Provider-selection boundary | IMPLEMENTED AND VERIFIED |
| Current Base44 mappings | VERIFIED |
| Provider singleton identity | VERIFIED |
| Alternate provider / private demo / enterprise offline | NOT IMPLEMENTED |
| Eager Base44 import limitation | REMAINS |
| Phase 10 frozen snapshot | NOT CREATED |
| Next gate | Wave 10.5C.1 (planning-only) — REQUIRES EXPLICIT APPROVAL |

## Scope

Modified exactly: `src/services/providerSelection.js`. Created exactly: this document. No other file changed. No alternate provider, no lazy/dynamic loading, no new profiles, no new mappings, no factory, no cache, no Proxy/clone, no backendAdapter/AuthContext/shim changes, no deps, no records, no GitHub operations. Wave 10.5B.3 record preserved as history.

## Defects Corrected

1. **Inherited prototype-key handling:** `__proto__`, `constructor`, `toString`, `hasOwnProperty` (and `prototype`) previously resolved `PROFILE_TO_FAMILY[key]` to an inherited Object.prototype member (truthy), then looked up a missing bundle and threw `PGP_PROVIDER_INVALID_FACADE`. A missing provider-family registration was also misclassified as `INVALID_FACADE`. Both now throw `PGP_PROVIDER_NOT_REGISTERED`.
2. **Unsafe `String(profileName)` conversion:** `selectionError` called `String(value)` unguarded; `Object.create(null)`, throwing `toString()`, and throwing `Symbol.toPrimitive` let a raw `TypeError`/`Error` escape. Now a guarded `safeProfileLabel` helper catches every conversion exception and returns the fixed label `<unconvertible>`, so `selectionError` always returns an Error with the requested `.code`.

## Implementation

Correction A (own-property lookup): before indexing `PROFILE_TO_FAMILY`, `resolveProvider` requires `Object.prototype.hasOwnProperty.call(PROFILE_TO_FAMILY, profileName)`; before indexing `PROVIDER_FAMILY_TO_BUNDLE`, it requires `Object.prototype.hasOwnProperty.call(PROVIDER_FAMILY_TO_BUNDLE, family)`. A missing profile and a missing family registration both throw `PGP_PROVIDER_NOT_REGISTERED`; only a registered family whose bundle fails structural validation throws `PGP_PROVIDER_INVALID_FACADE`. Smallest safe change; mapping architecture (frozen plain objects) preserved; no `Map`/registry introduced.
Correction B (safe label): an internal `safeProfileLabel(value)` wraps `String(value)` in `try/catch`, returning `"<unconvertible>"` on any throw. Used only inside `selectionError`; not exported; no logging, no object/env/stack dump.

## Verification Method

Independent non-persistent Node `vm` module probe with stubbed valid/invalid Base44 bundles (source transformed ESM→return; no probe file persisted); comment-stripped forbidden-reference scan; targeted frontend import-graph scan; `createClient`/singleton contract comparison; build/Preview attempted where supported. Every conclusion classified from actual executed evidence only.

## Selector Verification

- **Export contract:** exactly one export `resolveProvider`; no other exported symbols; imports only `{ providerClient, fetchPublicSettings }` from `@/services/base44Adapter`; no `appParams`/`environment-profile`/`backendAdapter`/`base44Client`/`AuthContext`/`@base44/sdk` import; no `createClient`; no dynamic import; no env read; `DUPLICATE_INIT` not implemented. MODULE PASS.
- **Mapping contract:** `PROFILE_TO_FAMILY` frozen, exactly 2 keys (`base44-cloud`, `local-development`) both → `base44`; `PROVIDER_FAMILY_TO_BUNDLE` frozen, exactly 1 family `base44`. MODULE PASS.
- **A. Valid profiles:** `base44-cloud` + `local-development` resolve; both exactly 2 keys; frozen; same `providerClient` identity; same `fetchPublicSettings` identity; no new client constructed; synchronous. MODULE PASS.
- **B. Invalid profiles (17 inputs):** all throw `PGP_PROVIDER_NOT_REGISTERED` (Error instances) — `private-demo`, `enterprise-offline-future`, `unknown-profile`, `""`, `"   "`, `undefined`, `null`, `42`, `true`, `false`, `[1,2]`, `{}`, `Symbol('x')`, `"__proto__"`, `"constructor"`, `"prototype"`, `"toString"`, `"hasOwnProperty"`. None produce `PGP_PROVIDER_INVALID_FACADE`, `TypeError`, successful resolution, or Base44 fallback. MODULE PASS.
- **C. Unconvertible values (3):** `Object.create(null)`, throwing `toString()`, throwing `Symbol.toPrimitive` → each an `Error` with `code === PGP_PROVIDER_NOT_REGISTERED` and message containing `<unconvertible>`; no raw conversion exception escapes. MODULE PASS.
- **D. Invalid registered facade (7 runtime + 4 static):** null/undefined/primitive `providerClient`, missing `auth`/`functions`/`entities`, non-function `fetchPublicSettings` → `PGP_PROVIDER_INVALID_FACADE` (Error instances, no dump/fallback). Array bundle / extra keys / missing `providerClient` / missing `fetchPublicSettings` → STATIC PASS via `validateBundle` (`keys.length !== 2` + both-key `includes` guards). Ownership remains distinct: prototype keys → NOT_REGISTERED; registered-but-malformed bundles → INVALID_FACADE. MODULE PASS + STATIC PASS.

## Integration and Import Graph

`backendAdapter.js` unchanged (still imports `appParams` + `resolveProvider`, calls once with `appParams.profile`, synchronous; `backend`/`catalog` exports, keys, allow-list, identity all unchanged). `base44Adapter.js` unchanged; `base44Client.js` unchanged; `AuthContext.jsx` unchanged. Import-graph scan (142 frontend files): `providerSelection` importers = 1 (`backendAdapter.js`); `base44Adapter` importers = 2 (`providerSelection.js`, `base44Client.js`); `base44Client` importers = 1 (`AuthContext.jsx`); `backendAdapter` importers = 17 (unchanged); `createClient(` locations = 1 (`base44Adapter.js`); `@base44/sdk` importers = 2 (unchanged); `VITE_APP_ENVIRONMENT_PROFILE` reads = 1 (`app-params.js`); dynamic `import(` = 0; circular imports added = 0; new provider bypass paths = 0; consumer migrations = 0. Graph resolves to the same Base44 singleton. STATIC PASS.

## Build and Preview Evidence

- `npm run build`: NOT EXECUTED (agent sandbox has no npm/shell runtime).
- Preview: NOT EXECUTED (sandbox cannot drive the live Base44 Preview). Default profile resolves to `base44-cloud` (valid string from `environment-profile.js`), so the corrected paths (prototype keys + unconvertible labels) are defense-in-depth and cannot fire in normal flow; repository owner to confirm: app loads, no blank screen, no provider-selection error, Dashboard/routing preserved, no data modified.

## Behavioral Parity

Unchanged: `backendAdapter.js`, `backend` exports, `catalog` exports + 16-entity allow-list, `backend.auth`/`backend.functions`/`fetchPublicSettings` identity, `createClient` options, Base44 singleton, `base44-cloud`/`local-development` behavior, AuthContext shim path, network behavior, auth/tenant/RLS, persistent state, eager initialization. Permitted behavior changes (all verified): inherited prototype keys now return `PGP_PROVIDER_NOT_REGISTERED`; unconvertible values now return stable `PGP_PROVIDER_NOT_REGISTERED` errors; a missing provider-family registration returns `PGP_PROVIDER_NOT_REGISTERED` rather than being misclassified as `INVALID_FACADE`.

## Closure Decision

**A. WAVE 10.5B COMPLETE.**

All previously passing checks remain passing; all 4 prototype-key failures corrected; all 3 safe-conversion failures corrected; valid-profile behavior unchanged; invalid registered facades still produce `INVALID_FACADE`; `backendAdapter.js` unchanged; single-client and import-graph contracts pass; no silent fallback; no new defect discovered; no rollback required. Build/Preview unavailable and recorded as NOT EXECUTED; all available independent evidence passes.

## Architecture Conclusions

- Environment-profile boundary: IMPLEMENTED / VERIFIED.
- Provider-selection boundary: IMPLEMENTED AND VERIFIED.
- Current Base44 profile mapping: VERIFIED.
- Provider singleton identity: VERIFIED.
- backendAdapter public facade: PRESERVED.
- Provider bypass expansion: 0 (AuthContext platform-managed bypass unchanged, resolves to same singleton).
- Silent fallback to Base44: 0.
- Alternate provider / private demo / enterprise offline: NOT IMPLEMENTED.
- Eager Base44 import limitation: REMAINS.
- Profile names as security boundary: PROHIBITED.
- Environment portability: NOT COMPLETE.

## Rollback Assessment

Correction rollback: revert the Wave 10.5B.4 changes in `providerSelection.js` (restore the unguarded `String(profileName)` and the direct `PROFILE_TO_FAMILY[profileName]` / `PROVIDER_FAMILY_TO_BUNDLE[family]` indexing) and delete this document. No other file rollback required. Full Wave 10.5B rollback (delete `providerSelection.js` + restore `backendAdapter.js` pre-10.5B.2 + delete 10.5B.2/10.5B.3/10.5B.4 docs) remains documented but is not required — decision A.

## Residual Risks

- Eager Base44 import limitation remains; offline/private builds still construct Base44 (future Wave 10.5C, planning-only).
- `AuthContext.jsx` platform-managed bypass not covered by the boundary; resolves to the same Base44 singleton (acceptable while only Base44 is selectable).
- Build and Preview not executed in this environment; repository owner must confirm.
- Profile names remain descriptive metadata, not a security boundary.
- Phase 10 is not frozen; environment portability is not complete.

## Next Decision Gate

**Wave 10.5C.1 — provider-loading isolation and lazy-bootstrap discovery and contract planning — REQUIRES EXPLICIT APPROVAL.** Must remain planning-only; must not implement an alternate provider. Wave 10.5 is not marked complete; Phase 10 is not marked frozen.

## Final Result

Wave 10.5B.4 bounded provider-selection correction complete. Wave 10.5B closure decision: A — COMPLETE.