# Phase 10 — Wave 10.5B.3 Provider Selection Closure Evaluation

**Document authority:** Authoritative closure record for Wave 10.5B. Supplements Wave 10.5B.1 planning and Wave 10.5B.2 implementation records without modifying or weakening Phase 2–9 frozen contracts or existing Phase 10 architecture rules.
**Date:** 2026-07-25.

## Status

| Field | Value |
|---|---|
| Phase | 10 — IMPLEMENTATION |
| Wave 10.5A | COMPLETE |
| Wave 10.5B.1 (planning) | COMPLETE |
| Wave 10.5B.2 (implementation) | IMPLEMENTATION COMPLETE |
| Wave 10.5B.3 (this verification) | VERIFICATION COMPLETE |
| Wave 10.5B | INCOMPLETE — BOUNDED CORRECTION REQUIRED |
| Provider-selection boundary | CORRECTION REQUIRED |
| Alternate / private-demo / enterprise-offline | NOT IMPLEMENTED |
| Eager Base44 import limitation | REMAINS |
| Phase 10 frozen snapshot | NOT CREATED |
| Next gate | Bounded Wave 10.5B.2 correction — REQUIRES EXPLICIT APPROVAL |

## Scope

New document created: this file. Existing files modified: 0. No implementation, repair, rollback, or Wave 10.5C work performed. Two bounded selector error-contract defects were discovered and recorded; no correction was applied.

## Method

Source-level contract comparison of `providerSelection.js`, `backendAdapter.js`, `base44Adapter.js`, `base44Client.js`; independent non-persistent Node `vm` module probe with stubbed valid/invalid Base44 bundles (source transformed ESM→return; no probe file persisted); comment-stripped forbidden-reference scan; targeted frontend import-graph scan; `createClient` option comparison; build/Preview attempted where supported. Every conclusion classified per actual executed evidence only.

## Evidence Reviewed

`src/services/providerSelection.js`, `src/services/backendAdapter.js`, `src/services/base44Adapter.js`, `src/api/base44Client.js`, `src/lib/AuthContext.jsx`, `src/lib/app-params.js`, `src/lib/environment-profile.js`, `src/docs/PHASE_10_WAVE_10_5B_PROVIDER_SELECTION_BOUNDARY.md`, `src/docs/PHASE_10_WAVE_10_5B_2_PROVIDER_SELECTION_IMPLEMENTATION.md`, `package.json`, `vite.config.js`; targeted searches across 142 frontend files.

## Selector Verification

- **Public export contract:** exactly one export `resolveProvider`; no `providerClient`/mappings/error-code/validation/default/raw-namespace exports. Imports only `{ providerClient, fetchPublicSettings }` from `@/services/base44Adapter`. No `appParams`/`environment-profile`/`backendAdapter`/`base44Client`/`AuthContext`/`@base44/sdk` import; no `createClient`; no dynamic import; no env read. MODULE PASS.
- **Mapping contract:** `PROFILE_TO_FAMILY` frozen, exactly 2 keys (`base44-cloud`, `local-development`) both → `base44`; `PROVIDER_FAMILY_TO_BUNDLE` frozen, exactly 1 family `base44` → frozen `{ providerClient, fetchPublicSettings }`. No aliases/wildcard/URL/hostname/localStorage/user-path. MODULE PASS.
- **Valid profile matrix:** `base44-cloud` and `local-development` resolve; both results exactly 2 keys, frozen, same `providerClient` identity, same `fetchPublicSettings` identity; no clone/proxy; synchronous. MODULE PASS.
- **Invalid profile matrix (must be NOT_REGISTERED):** PASS for `private-demo`, `enterprise-offline-future`, `unknown-profile`, `""`, `"   "`, `undefined`, `null`, `42`, `true`, `false`, `[1,2]`, `{}`, `Symbol('x')`, `"prototype"`. **FAIL** for `"__proto__"`, `"constructor"`, `"toString"`, `"hasOwnProperty"` — these resolve `PROFILE_TO_FAMILY[key]` to an inherited Object.prototype member (truthy), then look up a missing bundle and throw `PGP_PROVIDER_INVALID_FACADE` instead of `PGP_PROVIDER_NOT_REGISTERED`. Bounded prototype-key handling defect.
- **Safe error-string conversion:** **FAIL** for (A) `Object.create(null)`, (B) object whose `toString()` throws, (C) object whose `Symbol.toPrimitive` throws. `selectionError` calls `String(profileName)` unguarded; a non-string input with no/throwing conversion escapes as a raw `TypeError`/`Error` (e.g. "Cannot convert object to primitive value") instead of a `PGP_PROVIDER_NOT_REGISTERED` Error. Bounded unsafe error-string-conversion defect.
- **Invalid facade matrix:** MODULE PASS for null/undefined providerClient, primitive providerClient, missing `auth`/`functions`/`entities`, non-function `fetchPublicSettings` (all `PGP_PROVIDER_INVALID_FACADE`, Error instances, no dump/fallback). Bundle-array/extra-keys/missing-key shape branches verified STATIC PASS via `validateBundle` (`Object.keys` length===2 + both keys present).

## Integration Verification

`backendAdapter.js`: imports `appParams`; imports `resolveProvider`; calls it exactly once with `appParams.profile` (full `appParams` not passed); no `import.meta.env`/URL/localStorage/hostname; destructures `providerClient`/`fetchPublicSettings`; synchronous. Exports `backend` + `catalog` unchanged. `backend` keys `{ auth, functions, catalog, fetchPublicSettings }` unchanged; `backend.auth === providerClient.auth`, `backend.functions === providerClient.functions`, `fetchPublicSettings` identity preserved. `catalog` keys `{ list, filter, get }` unchanged; signatures unchanged; allow-list (16 entities) unchanged; invalid-entity error string unchanged; `catalog` still delegates to `providerClient.entities`. Consumer migrations: 0. STATIC PASS + MODULE PASS.

## Import Graph Verification

`providerSelection` importers = 1 (`backendAdapter.js`). `base44Adapter` importers = 2 (`providerSelection.js`, `base44Client.js`). `base44Client` importers = 1 (`AuthContext.jsx`). `backendAdapter` importers = 17 (unchanged). Direct `@base44/sdk` importers = 2 (`AuthContext.jsx` platform-managed, `base44Adapter.js` intended). `createClient(` locations = 1 (`base44Adapter.js`). `VITE_APP_ENVIRONMENT_PROFILE` reads = 1 (`app-params.js`). Dynamic `import(` = 0. New circular imports = 0. New direct `providerClient` consumer paths = 0. Graph confirmed: `environment-profile → app-params → backendAdapter → providerSelection → base44Adapter`; compatibility `AuthContext → base44Client → base44Adapter`; both resolve to the same Base44 singleton. STATIC PASS.

## Build and Preview Evidence

- `npm run build`: NOT EXECUTED (agent sandbox has no npm/shell runtime).
- Preview: NOT EXECUTED (sandbox cannot drive the live Base44 Preview). Repository owner to confirm: with `VITE_APP_ENVIRONMENT_PROFILE` absent/default, the app loads, no blank screen, no provider-selection error (default profile resolves to `base44-cloud`), Dashboard/routing preserved, no records changed. Normal path is unaffected by the bounded defects (default profile is always a valid string from `environment-profile.js`).

## Evidence Classification

- Selector export contract: MODULE PASS.
- Mapping contract: MODULE PASS.
- Valid profile matrix: MODULE PASS.
- Invalid profile matrix (14/18): MODULE PASS; (4 prototype keys): MODULE FAIL.
- Safe error-string conversion: MODULE FAIL (3/3).
- Invalid facade matrix: MODULE PASS + STATIC PASS.
- backendAdapter integration / public contract / catalog: STATIC PASS + MODULE PASS.
- Import graph: STATIC PASS.
- Base44 client contract (`createClient` count=1, options unchanged, singleton=1, no Proxy/clone, profile not passed): STATIC PASS.
- Build: NOT EXECUTED. Preview: NOT EXECUTED.
- Eager-import limitation: STATIC PASS (preserved, not a regression).

## Closure Decision

**B. WAVE 10.5B INCOMPLETE — BOUNDED CORRECTION REQUIRED.**

Rationale: the normal `base44-cloud`/`local-development` path is intact and verified; no application regression is demonstrated (default profile is always a valid string resolved by `environment-profile.js`, so the failing inputs are defense-in-depth only). Single Base44 client identity, `createClient` options, backendAdapter public contract, catalog contract, and import graph all pass. Two bounded selector error-contract defects exist: (1) inherited prototype-key handling (`__proto__`/`constructor`/`toString`/`hasOwnProperty` → `PGP_PROVIDER_INVALID_FACADE` instead of `PGP_PROVIDER_NOT_REGISTERED`); (2) unsafe `String()` conversion in `selectionError` (raw `TypeError`/`Error` escapes for `Object.create(null)` and throwing-conversion objects). Neither weakens auth/tenant/RLS or runtime behavior.

## Architecture Conclusions

- Environment-profile boundary: IMPLEMENTED / VERIFIED.
- Provider-selection boundary: CORRECTION REQUIRED (bounded).
- Current Base44 profile mapping (`base44-cloud`, `local-development` → `base44`): VERIFIED.
- Provider singleton identity: VERIFIED.
- backendAdapter public facade: PRESERVED.
- Provider bypass expansion: 0 (AuthContext platform-managed bypass unchanged, resolves to same singleton).
- Silent fallback to Base44: 0 (none detected).
- Alternate provider / private demo / enterprise offline: NOT IMPLEMENTED.
- Eager Base44 import limitation: REMAINS.
- Profile names as security boundary: PROHIBITED.
- Environment portability: NOT COMPLETE.

## Rollback or Correction Assessment

Full rollback remains sufficient (delete `providerSelection.js` + restore `backendAdapter.js` pre-Wave-10.5B.2 import + delete Wave 10.5B.2 doc + this doc). Not recommended — normal path is intact.

Bounded correction (recommended for Wave 10.5B.2-correction) touches only `src/services/providerSelection.js` + one correction/verification document. `backendAdapter.js` unchanged (integration not implicated). Smallest corrections: (a) use a null-prototype object (`Object.create(null)`) or `Map` for the profile lookup, or guard with `Object.prototype.hasOwnProperty.call(PROFILE_TO_FAMILY, profileName)` so inherited prototype keys cannot be accepted — fixes defect 1; (b) wrap the `String(profileName)` conversion in `selectionError` with a try/catch falling back to a fixed label (e.g. `"unconvertible"`) so a non-string with no/throwing conversion still yields a `PGP_PROVIDER_NOT_REGISTERED` Error — fixes defect 2. Both preserve the public contract, error codes, mapping, and all passing matrix cases; they only change the failing defense-in-depth inputs to the required stable error.

## Residual Risks

- Bounded defects remain until correction is approved; not a runtime regression (default profile is always valid).
- Eager Base44 import limitation remains; offline/private builds still construct Base44.
- `AuthContext.jsx` platform-managed bypass not covered by the boundary.
- Build and Preview not executed in this environment; repository owner must confirm.
- Profile names remain descriptive metadata, not a security boundary.
- Phase 10 is not frozen; environment portability is not complete.

## Next Decision Gate

**Bounded Wave 10.5B.2 correction (planning + implementation) — REQUIRES EXPLICIT APPROVAL.** Touches only `providerSelection.js` + a correction document; `backendAdapter.js` unchanged. After correction passes, re-run this closure and, if A, proceed to Wave 10.5C.1 (provider-loading isolation / lazy-bootstrap discovery, planning-only). Wave 10.5B is not marked complete; Wave 10.5 is not marked complete; Phase 10 is not marked frozen.

## Final Result

**Wave 10.5B.3 verification complete — bounded correction required.**