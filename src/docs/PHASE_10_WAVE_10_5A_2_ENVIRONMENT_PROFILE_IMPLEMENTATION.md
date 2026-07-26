# Phase 10 — Wave 10.5A.2 Environment Profile Implementation

**Document type:** Authoritative implementation record for Wave 10.5A.2. Supplements the 10.5A.1 planning document; does not modify or weaken any Phase 2–9 frozen contract or existing Phase 10 architecture rule.
**Date:** 2026-07-25.

## Status

| Field | Value |
|---|---|
| Phase | 10 — IMPLEMENTATION |
| Wave 10.5A.1 (planning) | COMPLETE |
| Wave 10.5A.2 (this implementation) | IMPLEMENTATION COMPLETE |
| Wave 10.5 implementation | IN PROGRESS (1 approved build/environment candidate complete) |
| Private demo | NOT IMPLEMENTED |
| Enterprise offline | NOT IMPLEMENTED |
| Phase 10 frozen snapshot | NOT CREATED |
| Next gate | Wave 10.5A.3 verification & closure — REQUIRES EXPLICIT APPROVAL |

## Scope

Approved candidate `environment-profile-descriptor` implemented. Files created: `src/lib/environment-profile.js`, this document. Files modified: `src/lib/app-params.js` (one import + one field). Not modified: `PHASE_10_PORTABILITY_SPEC.md`, `PHASE_10_WAVE_10_4B_CLOSURE_EVALUATION.md`, `PHASE_10_WAVE_10_5_BUILD_ENVIRONMENT_PROFILES.md`, `base44Adapter.js`, `backendAdapter.js`, `base44Client.js`, `vite.config.js`, `package.json`, `package-lock.json`, backend functions, entities, RLS, `pgp-core-domain`, Phase 2–9 docs. No provider switching, no private-demo, no enterprise-offline, no Docker, no config-file loading, no secrets, no UI controls, no telemetry, no deployment, no persistent records, no GitHub operations.

## Contract Freeze

`src/lib/app-params.js` (pre-edit) recorded contract:

- Imports: 0.
- Exports: `appParams` (named), spread from `getAppParams()` → `{ appId, token, fromUrl, functionsVersion, appBaseUrl }`.
- Env reads: `VITE_BASE44_APP_ID`, `VITE_BASE44_FUNCTIONS_VERSION`, `VITE_BASE44_APP_BASE_URL` (via `import.meta.env`).
- URL params: `app_id`, `access_token`, `clear_access_token`, `from_url`, `functions_version`, `app_base_url`.
- localStorage: `base44_*` keys (read + write); `access_token` stripped from URL via `removeFromUrl: true`.
- Precedence per field: URL param → env default (stored) → stored value → null.
- Consumers: `src/services/base44Adapter.js` is the only importer; it destructures `const { appId, token, functionsVersion, appBaseUrl } = appParams` and passes those named fields explicitly to `createClient({ appId, token, functionsVersion, serverUrl: '', requiresAuth: false, appBaseUrl })`. The object is **destructured, not spread** into `createClient`.

**Integration shape decision:** because `base44Adapter.js` destructures named fields (no `...appParams` spread), adding a `profile` field to the `appParams` object cannot leak into Base44 `createClient` options. The smallest safe shape is therefore adding `profile` to the existing exported `appParams` object — no separate named export needed. `base44Adapter.js` is not modified (no workaround required).

## Implementation

`src/lib/environment-profile.js` — pure, provider-independent module. 0 imports, 0 `import.meta.env`/`process.env` reads, 0 localStorage/URL access, 0 fetch, 0 `@base44/sdk`/Deno references, 0 secret loading, 0 provider construction (verified by stripped-comment source scan). Public API: `KNOWN_PROFILES`, `DEFAULT_ENVIRONMENT_PROFILE`, `ENVIRONMENT_PROFILE_ERROR_CODES`, `resolveActiveProfile(rawProfile)`, `describeProfile(profileName)`. Internal `DESCRIPTORS` map is not exported.

`KNOWN_PROFILES` is an `Object.freeze`-d array in exact order: `base44-cloud`, `local-development`, `private-demo`, `enterprise-offline-future`. `DEFAULT_ENVIRONMENT_PROFILE` = `base44-cloud`. Each descriptor is `Object.freeze`-d with fields `id`, `implementationStatus`, `providerFamily`, `selectable`. No credentials, URLs, tokens, provider instances, datastore config, or `offline`/`airGapped` flags.

`src/lib/app-params.js` — added `import { resolveActiveProfile } from '@/lib/environment-profile';` and one field `profile: resolveActiveProfile(import.meta.env.VITE_APP_ENVIRONMENT_PROFILE)` in the returned params object. All existing fields, keys, precedence, and access-token behavior unchanged.

## Resolution Contract

`resolveActiveProfile(rawProfile)` behavior (verified by inline probe):

| Input | Result |
|---|---|
| `undefined` | `base44-cloud` |
| `null` | `base44-cloud` |
| `""` | `base44-cloud` |
| whitespace-only | `base44-cloud` |
| `"base44-cloud"` | `base44-cloud` |
| `"local-development"` | `local-development` |
| `"private-demo"` | throw `PGP_ENV_PROFILE_NOT_IMPLEMENTED` |
| `"enterprise-offline-future"` | throw `PGP_ENV_PROFILE_NOT_IMPLEMENTED` |
| unknown string | throw `PGP_ENV_PROFILE_UNKNOWN` |
| non-string non-null | throw `PGP_ENV_PROFILE_UNKNOWN` |

No silent downgrade to `base44-cloud` for private-demo, enterprise-offline, or unknown input.

## App-Params Integration

New browser-visible non-secret env reference: `VITE_APP_ENVIRONMENT_PROFILE`, read only in `src/lib/app-params.js`. Absent variable → `resolveActiveProfile(undefined)` → `base44-cloud` → exact current Base44 behavior. Profile is not stored in localStorage, not read from the URL, not logged automatically, not exposed via a UI selector. No `.env` file added. `base44Adapter.js` and `backendAdapter.js` unchanged — profile selection does not select or construct a provider.

## Static Verification

Inline non-persistent probe (Node `vm` sandbox, real module source with ESM export transformed to a return; no probe file left in repo). 47 assertions; all PASS except 5 false positives that matched purity-contract comment text (re-verified against comment-stripped source). Results:

| # | Check | Result | Evidence |
|---|---|---|---|
| 1-4 | vocabulary 4, order exact, frozen, default base44-cloud | PASS / STATIC | inline probe |
| 5-10 | undefined/null/empty/whitespace→default; base44-cloud/local-development resolve | PASS / STATIC | inline probe |
| 11-12 | private-demo/enterprise throw NOT_IMPLEMENTED | PASS / STATIC | inline probe |
| 13-14 | unknown string & non-string throw UNKNOWN | PASS / STATIC | inline probe |
| 15 | error codes exact (`PGP_ENV_PROFILE_UNKNOWN`, `PGP_ENV_PROFILE_NOT_IMPLEMENTED`), frozen, Error instances | PASS / STATIC | inline probe |
| 16-18 | describeProfile returns all 4; descriptors frozen; fields exact (`id, implementationStatus, providerFamily, selectable`) | PASS / STATIC | inline probe |
| 19-21 | 0 imports; 0 import.meta.env/process.env/localStorage/URL/fetch/@base44/sdk/Deno in code; 0 secret-like descriptor keys | PASS / STATIC | comment-stripped source scan |
| 22 | exactly one `VITE_APP_ENVIRONMENT_PROFILE` read in app-params | PASS / STATIC | source scan |
| 23 | profile not stored to localStorage | PASS / STATIC | source scan |
| 24 | profile not read from URL | PASS / STATIC | source scan |
| 25 | profile not passed to createClient (base44Adapter destructures, no `...appParams` spread) | PASS / STATIC | `base44Adapter.js` source |
| 26 | existing app-param fields + access_token removeFromUrl + clear_access_token preserved | PASS / STATIC | `app-params.js` source |
| 27 | no provider switch (createClient options unchanged: `requiresAuth:false`, `serverUrl:''`) | PASS / STATIC | `base44Adapter.js` source |
| 28 | no offline/private capability marked implemented | PASS / STATIC | descriptors `NOT_IMPLEMENTED` |

Unexecuted behavior is not labeled runtime-confirmed.

## Build and Preview Evidence

- Module-level assertions: EXECUTED (inline non-persistent probe, 47 assertions, see Static Verification).
- `npm run build`: NOT EXECUTED (agent sandbox has no npm/shell runtime).
- Preview: NOT EXECUTED (agent sandbox cannot drive the live Preview). Static evidence above is the available verification; build/preview to be confirmed by the repository owner in the real Base44 Preview.

## Behavioral Parity

With `VITE_APP_ENVIRONMENT_PROFILE` absent: resolved profile = `base44-cloud`; Base44 adapter remains the only provider; `createClient` arguments unchanged (`appId, token, functionsVersion, serverUrl:'', requiresAuth:false, appBaseUrl`); auth, app ID, app base URL, functions-version, access-token, localStorage, and URL-cleanup behavior unchanged; Dashboard routing/loading unchanged; no network call added; no persistent state added.

## Security Boundaries

Profile names are descriptive configuration metadata only. They are NOT authorization, tenant isolation, RLS, license enforcement, provider security, or deployment proof. Server authorization and tenant enforcement remain mandatory; environment configuration does not weaken RLS or application checks. Selecting `private-demo`/`enterprise-offline-future` fails fast — no false offline/private deployment claim is possible.

## Rollback

Rollback requires only: (1) delete `src/lib/environment-profile.js`; (2) revert the two Wave 10.5A.2 edits in `src/lib/app-params.js` (the import line and the `profile` field); (3) delete this document. No rollback required for `package.json`, `package-lock.json`, `base44Adapter.js`, `backendAdapter.js`, backend functions, entities, RLS, `pgp-core-domain`, Phase 2–9 docs, 10.4 docs, or the 10.5A.1 planning document.

## Residual Risks

- A future consumer could spread `...appParams` into a Base44 call, leaking `profile` as an unknown option (mitigation: documented contract — destructuring only; `base44Adapter.js` unchanged).
- Profile names could be misused as a security boundary (mitigation: documented Security Boundaries).
- `npm run build` and Preview not executed in this environment — to be confirmed by the repository owner.
- Base44 build plugin, runtime, auth, datastore, and RLS remain the only provider; no alternate provider exists.
- Phase 10 is not frozen.

## Next Decision Gate

**Wave 10.5A.3 — environment-profile implementation verification and closure evaluation — REQUIRES EXPLICIT APPROVAL.** Not started by this wave. Wave 10.5 is not marked complete; Phase 10 is not marked frozen.

## Final Result

**Wave 10.5A.2 environment-profile descriptor implementation complete.**