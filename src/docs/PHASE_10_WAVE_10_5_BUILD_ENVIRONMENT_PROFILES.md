# Phase 10 — Wave 10.5 Build and Environment Profiles

**Document type:** Bounded discovery, inventory, and contract-planning pass.
**Date:** 2026-07-24.

## Status

| Field | Value |
|---|---|
| Phase | 10 — IMPLEMENTATION |
| Wave 10.4A (provider-neutral pilots) | COMPLETE |
| Wave 10.4B (selective rollout) | COMPLETE |
| Wave 10.4B.3 closure | A / COMPLETE |
| Read-only single-entity provider-neutral pattern | PROVEN |
| Wave 10.5 | IN PROGRESS |
| Wave 10.5A.1 (this pass) | PLANNING COMPLETE |
| Wave 10.5 implementation | NOT STARTED |
| Private demo | NOT IMPLEMENTED |
| Enterprise offline | NOT IMPLEMENTED |
| Phase 10 frozen snapshot | NOT CREATED |
| Next gate | Wave 10.5A.2 first implementation — REQUIRES EXPLICIT APPROVAL |

## Scope

Bounded discovery and contract planning for a new architecture class — Build and Environment Profiles. Not performed: environment switching, self-hosted provider, Docker/deployment infrastructure, runtime/frontend code changes, package changes, env-var addition, .env creation, secret exposure, deployment execution, migrations, persistent records, Wave 10.5A.2. `PHASE_10_PORTABILITY_SPEC.md`, `PHASE_10_WAVE_10_4B_CLOSURE_EVALUATION.md`, and Phase 2–9 docs are not modified.

## Method

Static inspection of build/config/bootstrap files only; targeted reference scan (`import.meta.env`, `process.env`, runtime token/URL storage, hard-coded URLs, build/preview/deploy scripts, runtime detection, feature flags). No live network calls, no business entities, no full 59-function scan. Every statement carries its evidence path.

## Current Build Inventory

| Area | Current mechanism | Evidence | Portability implication |
|---|---|---|---|
| Package manager | npm (`package-lock.json`) | `package.json`, lock present | standard, portable |
| App framework | React 18.2 + Vite 6.1 | `package.json` deps | portable (Class A) |
| Build tool | Vite + `@base44/vite-plugin` + `@vitejs/plugin-react` | `vite.config.js` | Base44 build coupling (Class D) |
| Scripts | dev, build, lint, lint:fix, typecheck, preview | `package.json` | no `deploy` script |
| Dev command | `vite` (or `base44 dev` per README) | `package.json`, `README.md` | standard Vite |
| Production build | `vite build` | `package.json` | standard Vite artifact |
| Preview command | `vite preview` | `package.json` | standard |
| Deploy command | none in repo; publish via `base44 dashboard` | `README.md` | Base44-managed deploy |
| Frontend output dir | `./dist` | `base44/config.jsonc` | standard Vite artifact |
| Frontend Base44 bootstrap | `createClient({appId,token,functionsVersion,serverUrl:'',requiresAuth:false,appBaseUrl})` | `src/services/base44Adapter.js` | provider-specific, single adapter |
| Backend function runtime | `Deno.serve` + `createClientFromRequest` from `npm:@base44/sdk` | `base44/functions/getOrganizations/entry.ts` | Deno Deploy + SDK (Class D) |
| Provider selection | none — Base44 is the only adapter; no flag, no switch | `src/services/base44Adapter.js` | no selection mechanism exists |
| Configuration sources | `import.meta.env` (VITE_*), `process.env` (BASE44_LEGACY_SDK_IMPORTS), URL params + localStorage, `base44/config.jsonc` | `src/lib/app-params.js`, `vite.config.js` | mixed build-time + runtime |
| External-network assumptions | Base44 hosted backend (auth/datastore/functions/file/email/connectors); `base44.com` favicon | `src/services/base44Adapter.js`, `index.html` | mandatory outbound for current op |

Note: backend functions import `npm:@base44/sdk@0.8.38` (exact) while the frontend depends on `@base44/sdk@^0.8.40` (`package.json`) — a version discrepancy, classified UNKNOWN / requires confirmation; not acted on here.

## Environment Reference Inventory

| Reference | Location | Build/runtime | Secret | Browser-visible | Required today | Notes |
|---|---|---|---|---|---|---|
| `VITE_BASE44_APP_ID` | `src/lib/app-params.js` | build-time | no | yes | yes | public build configuration |
| `VITE_BASE44_APP_BASE_URL` | `src/lib/app-params.js` | build-time | no | yes | yes | provider configuration |
| `VITE_BASE44_FUNCTIONS_VERSION` | `src/lib/app-params.js` | build-time | no | yes | optional | deployment metadata |
| `BASE44_LEGACY_SDK_IMPORTS` | `vite.config.js` | build-time | no | no | optional | build flag |
| `?access_token` / `base44_access_token` (localStorage) | `src/lib/app-params.js` | runtime | yes (session token) | yes (localStorage/URL) | yes (runtime auth) | private session token, stripped from URL after read |
| `base44_app_id`/`base44_app_base_url`/`base44_functions_version`/`base44_from_url` (localStorage) | `src/lib/app-params.js` | runtime | no | yes | optional cache | provider configuration cache |
| `npm:@base44/sdk@0.8.38` | `base44/functions/*/entry.ts` | build-time (function deploy) | no | no | yes | package/build-time only |
| `https://base44.com/logo_v2.svg` | `index.html` | runtime (favicon) | no | yes | optional | hard-coded public URL (cosmetic) |
| `docs.base44.com` / `app.base44.com/support` | `README.md` | n/a (docs) | no | no | optional | documentation links |

No `.env`, `.env.local`, or `.env.example` file exists in the repo. No `Dockerfile`, compose, `vercel.json`, `netlify.toml`, or `.github/workflows`. Secret values are not reproduced; only variable names.

## Profile Contracts

### A. base44-cloud

Current production provider profile. Base44 frontend/backend provider active; Base44 auth/datastore/RLS active; external network required; Base44 deployment/runtime available; current behavior preserved. This is the only profile with repository-evidenced ACTIVE capabilities.

### B. local-development

Developer workstation profile (contract only). Still uses the Base44 provider for API/auth/datastore (`npm run dev` or `base44 dev`); frontend served by the Vite dev server; backend dependency is the hosted Base44 backend (or local Base44 dev backend via `base44 dev`); outbound network required to reach Base44; safe developer configuration via `.env.local` (`VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL`); production secrets prohibited in browser code. No local backend is evidenced — `base44 dev` starts the Base44-managed local backend, not an alternate provider.

### C. private-demo

Future independently deployable demonstration profile. Contract target: local frontend, local application API, local datastore, local authentication, local file storage, optional local OCR, no mandatory Base44 runtime, operation inside a customer LAN, internet not required during normal demonstrated workflows. Every capability is FUTURE / NOT IMPLEMENTED.

### D. enterprise-offline-future

Future air-gapped target. Contract target: no mandatory outbound network; no cloud identity dependency; no external datastore dependency; no public CDN dependency; no online license-server dependency; offline installation and signed update bundles; local backup and restore; explicit integration allow-list. The entire profile is ARCHITECTURAL TARGET / NOT IMPLEMENTED.

## Capability Matrix

Status values: ACTIVE, REQUIRED, OPTIONAL, PROHIBITED, FUTURE, NOT IMPLEMENTED, UNKNOWN.

| Capability | base44-cloud | local-development | private-demo | enterprise-offline-future |
|---|---|---|---|---|
| frontend hosting | ACTIVE | ACTIVE (Vite) | NOT IMPLEMENTED | NOT IMPLEMENTED |
| application API | REQUIRED (Base44 fns) | REQUIRED (Base44 fns) | NOT IMPLEMENTED | NOT IMPLEMENTED |
| authentication | ACTIVE (Base44 auth) | REQUIRED | NOT IMPLEMENTED | NOT IMPLEMENTED |
| tenant isolation | ACTIVE (RLS+fns) | REQUIRED | NOT IMPLEMENTED | NOT IMPLEMENTED |
| datastore | ACTIVE (Base44) | REQUIRED | NOT IMPLEMENTED | NOT IMPLEMENTED |
| file storage | ACTIVE (UploadFile) | OPTIONAL | NOT IMPLEMENTED | NOT IMPLEMENTED |
| scheduler | ACTIVE (Base44) | REQUIRED | NOT IMPLEMENTED | NOT IMPLEMENTED |
| background jobs | ACTIVE (Base44) | REQUIRED | NOT IMPLEMENTED | NOT IMPLEMENTED |
| OCR | NOT IMPLEMENTED | NOT IMPLEMENTED | FUTURE | FUTURE |
| email | ACTIVE (SendEmail) | OPTIONAL | NOT IMPLEMENTED | NOT IMPLEMENTED |
| external integrations | OPTIONAL (connectors) | OPTIONAL | NOT IMPLEMENTED | NOT IMPLEMENTED (allow-list FUTURE) |
| audit logging | ACTIVE (append-only) | REQUIRED | NOT IMPLEMENTED | NOT IMPLEMENTED |
| backup/restore | NOT IMPLEMENTED | NOT IMPLEMENTED | FUTURE | FUTURE |
| outbound internet | REQUIRED | REQUIRED | OPTIONAL | PROHIBITED |
| update delivery | ACTIVE (Base44 publish) | NOT IMPLEMENTED | FUTURE | FUTURE (signed bundles) |
| secrets source | ACTIVE (Base44 platform) | REQUIRED (Base44) | NOT IMPLEMENTED | NOT IMPLEMENTED |
| provider implementation status | ACTIVE (Base44 only) | ACTIVE (Base44 only) | NOT IMPLEMENTED | NOT IMPLEMENTED |

No capability is marked ACTIVE without repository evidence. `base44-cloud` is the only profile with ACTIVE provider implementation.

## Build-Time and Runtime Boundary

Build-time configuration may contain only: public frontend configuration, public feature declarations, non-secret build metadata, and (when safe) the selected frontend adapter/profile identifier. Runtime server configuration owns: credentials, signing keys, database/SMTP/provider/encryption credentials, license verification keys/paths, and external integration credentials.

Rules: secrets must not enter `import.meta.env` unless intentionally public; frontend variables must be treated as browser-visible; profile names must not be used as a security boundary; server authorization and tenant enforcement remain mandatory; environment configuration must not weaken RLS or application checks. (The current `access_token` lives in URL/localStorage at runtime, not in build-time `import.meta.env` — consistent with this boundary.)

## Configuration Precedence

Proposed minimal future precedence contract (not implemented): (1) explicit runtime process configuration; (2) mounted/local deployment configuration; (3) profile defaults; (4) safe application defaults.

Prohibited: silent fallback from private/offline profile to Base44 cloud; silent fallback to localhost production services; secrets embedded in frontend build output; profile auto-detection based only on hostname; production start with incomplete mandatory configuration.

## Fail-Fast Contract

A future profile loader must detect: unknown profile name; missing mandatory provider configuration; secret declared in a public/frontend configuration area; private-demo selecting Base44-only capabilities without explicit bridge mode; enterprise-offline selecting mandatory outbound integrations; incomplete datastore/auth/file-storage provider set; contradictory settings; unsafe production defaults. Expected failure behavior: startup failure before serving traffic; clear non-secret diagnostic; stable error identifier; no secret value in logs; no automatic downgrade to another profile. The validator is not created in this wave.

## Network Dependencies

| Dependency | Class | Evidence | Blocker for |
|---|---|---|---|
| Base44 hosted backend (auth/datastore/functions/file/email/connectors) | required for current Base44 operation | `src/services/base44Adapter.js`, `base44/functions/*/entry.ts` | private-demo, enterprise-offline |
| `base44.com` favicon | optional (cosmetic) | `index.html` | enterprise-offline (hard-coded public URL) |
| npm registry | package/build-time only | `package.json`, `npm:@base44/sdk` function imports | enterprise-offline (offline dependency packaging) |
| `docs.base44.com` / `app.base44.com/support` | development-only (docs) | `README.md` | none (not runtime) |

No live network calls were performed. Blockers for private-demo: no local API/datastore/auth/file/scheduler provider exists. Blockers for enterprise-offline: no air-gapped auth/datastore, no offline dependency packaging, no signed update bundles, hard-coded public favicon/CDN URLs.

## Gap Analysis

| Gap | Classification |
|---|---|
| Alternate frontend backendAdapter/provider selection | REQUIRED FOR PRIVATE DEMO |
| Alternate backend application provider | REQUIRED FOR PRIVATE DEMO |
| Local auth provider | REQUIRED FOR PRIVATE DEMO |
| Local datastore provider | REQUIRED FOR PRIVATE DEMO |
| Local tenant enforcement | REQUIRED FOR PRIVATE DEMO |
| Local file-storage provider | REQUIRED FOR PRIVATE DEMO |
| Local scheduler/background worker | REQUIRED FOR PRIVATE DEMO |
| Local OCR | OPTIONAL (private-demo optional) / FUTURE |
| Build artifact packaging | REQUIRED ONLY FOR ENTERPRISE OFFLINE |
| Runtime configuration loader | REQUIRED FOR PRIVATE DEMO |
| Configuration schema validation | REQUIRED FOR PRIVATE DEMO |
| Offline dependency packaging | REQUIRED ONLY FOR ENTERPRISE OFFLINE |
| Backup/restore | REQUIRED ONLY FOR ENTERPRISE OFFLINE |
| Update signing and verification | REQUIRED ONLY FOR ENTERPRISE OFFLINE |
| Profile descriptor / vocabulary | ALREADY PARTIALLY PREPARED (this wave defines it; impl next) |
| Provider-neutral backend pattern (multi-entity, mutating) | NOT EVALUATED |

No full implementations are designed here.

## First Implementation Candidate

**Candidate:** `environment-profile-descriptor` — a small typed/validated environment-profile descriptor with `base44-cloud` as the exact default/current behavior.

**Shape (planning only):** explicit known profile vocabulary (`base44-cloud`, `local-development`, `private-demo`, `enterprise-offline-future`); public/non-secret metadata only; no secret loading; no provider migration; no deployment changes; no automatic offline claim; default resolves to `base44-cloud`; unknown name fails fast.

**Expected files:** new `src/lib/environment-profile.js` (profile vocabulary + `resolveActiveProfile` + `describeProfile`); one read site in `src/lib/app-params.js` exposing `profile` (default `base44-cloud`); this doc updated with implementation evidence. No change to `base44Adapter.js`, `backendAdapter.js`, entities, RLS, or backend functions.

**Acceptance criteria:** `KNOWN_PROFILES` contains exactly the four names; `resolveActiveProfile(undefined)` returns `base44-cloud`; unknown name throws with a stable error identifier; no `@base44/sdk`/`fetch`/`Deno` import in the module; current Base44 production behavior byte-unchanged (base44-cloud default, no provider switch); frontend build/preview unchanged.

**Static verification:** import the module; assert default = base44-cloud; assert unknown throws; assert 0 forbidden patterns; assert 0 network/SDK references.

**Safe runtime/build verification:** `npm run build` succeeds; preview loads Dashboard unchanged. (Cannot run npm in the agent sandbox; to be confirmed by the repository owner in the real Preview.)

**Rollback boundary:** delete `src/lib/environment-profile.js` and revert the single `app-params.js` read line. No package/schema/frontend-consumer/RLS/backend rollback.

**Risks:** a future consumer could misuse the profile name as a security boundary (mitigation: documented rule — profile names are not a security boundary; server auth/RLS mandatory); a new `VITE_PGP_PROFILE`-style var could leak into the browser bundle (mitigation: only the non-secret profile name is exposed).

**Non-goals:** no provider switching, no offline mode, no Docker, no env-var enforcement beyond the profile name, no schema validation of provider config, no wiring into `base44Adapter.js` in this candidate.

## Risks

- Base44 build plugin (`@base44/vite-plugin`) is build-time coupling beyond standard Vite — a no-Base44 build profile is not yet defined.
- Base44 runtime/auth/datastore/RLS remain the only provider; no alternate provider exists.
- `base44 dev` starts a Base44-managed local backend, not an alternate local provider — local-development still depends on Base44.
- Backend `npm:@base44/sdk@0.8.38` vs frontend `^0.8.40` version discrepancy is unresolved.
- Profile names must never become a security boundary.
- Phase 10 is not frozen.

## Next Decision Gate

**Wave 10.5A.2 — first build/environment profile implementation (`environment-profile-descriptor`) — REQUIRES EXPLICIT APPROVAL.** Not started by this pass.

## Final Result

**Wave 10.5A.1 build and environment profile planning complete.** Planning result: A.