# Phase 10 — Wave 10.6.1 Frontend Provider Independence Plan

## Status
Phase 10 — IMPLEMENTATION. Wave 10.5 — COMPLETE. Wave 10.6 — IN PROGRESS. Wave 10.6.1 — PLANNING COMPLETE. Frontend provider-specific surface — INVENTORIED. L3 build-boundary contract — PLANNED, NOT IMPLEMENTED. AuthContext consumer contract — MAPPED. Application-owned auth boundary — PLANNED, NOT IMPLEMENTED. Alternate/private/offline — NOT IMPLEMENTED. L3/L4 — NOT IMPLEMENTED. Phase 10 frozen snapshot — NOT CREATED.

## Scope
Discovery, architecture analysis and contract planning only. Determine the complete set of remaining frontend dependencies blocking L3 (unselected-provider bundle exclusion) and L4 (frontend without Base44 auth/SDK/compat/build paths). Inventory every Base44-specific frontend import/configuration edge; classify the Base44 Vite plugin role; extract the AuthContext contract and consumer surface; compare build/auth-boundary candidates; select one bounded Wave 10.6.2 candidate. No build targets implemented, no AuthContext modified, no consumers migrated, no alternate provider, no Wave 10.6.2 started. Exactly one document created; no existing file modified.

## Method
Source inspection of index.html, main.jsx, App.jsx, the four provider-service modules, base44Adapter/base44Client, AuthContext, app-params, environment-profile, function-call, package.json, vite.config.js, package-lock existence. Local package inspection of node_modules/@base44/vite-plugin (dist + entry) and @base44/sdk (package + dist/utils/axios-client). Targeted keyword scan over 144 src files + root config, classifying active vs comment-only (comment-line heuristic). AuthContext consumer extraction via import-statement + useAuth-destructuring parse. No web research; repository + local packages only. No build executed.

## Provider-Specific Surface
| Surface | File/symbol | Edge | Load | Ownership | Editable | L3 | L4 |
|---|---|---|---|---|---|---|---|
| A runtime | base44Adapter createClient | SDK ctor | post-bootstrap | APP-OWNED | yes | yes | yes |
| A runtime | providerBootstrap base44 loader | dyn import | bootstrap | APP-OWNED | yes | yes | no |
| A runtime | base44Client shim | re-export | App-load | APP-OWNED | yes | yes | yes |
| B auth | AuthContext AuthProvider/useAuth | React ctx | App-load | PLATFORM | no | yes | yes |
| B auth | createAxiosClient deep SDK | HTTP client | App-load | PLATFORM | no | yes | yes |
| B auth | base44.auth.me/logout/redirect | SDK auth | App-load | PLATFORM | no | yes | yes |
| B auth | public-settings axios req | bootstrap | App-load | PLATFORM | no | yes | yes |
| C config | appParams appId/token/fnsVer/baseUrl | config/token | main+adapter+auth | APP-OWNED | yes | yes | yes |
| C config | VITE_BASE44_* / token localStorage | env+storage | main+adapter | APP-OWNED | yes | yes | yes |
| D build | vite-plugin (alias @/ + HTML inject) | build tool | build | PACKAGE | config-only | yes | yes |
| D build | legacySDK/notifiers/visualEdit | build/dev | build/dev | PACKAGE | config-only | partial | partial |
| E static | index.html favicon base44.com + title | branding | static | APP-OWNED | yes | yes | yes |
| E static | ui/image.jsx base44.com host | runtime URL | render | PLATFORM | no | no | yes |
| F facade | backendAdapter/Selection/providerBootstrap | L2 boundary | bootstrap | APP-OWNED | yes | no | no |

Active file counts: @base44 4, base44 11, createClient 1, createAxiosClient 2, providerClient 5, AuthContext 26, useAuth 26, appParams 4. Comment-only (source comments): Base44 8, base44Client 2, base44Adapter 2, providerBootstrap 2, providerSelection 1. Direct @base44/sdk importers 2 (AuthContext.jsx, base44Adapter.js). Plugin refs 2 (vite.config.js, package.json). Provider static URLs 2 (index.html favicon, ui/image.jsx host). No import.meta.glob/resolve.alias/manualChunks/rollupOptions in app config (alias is plugin-owned).

## Current Blocker Graph
A. Backend provider: providerBootstrap → dynamic import → base44Adapter → @base44/sdk. Runtime post-selection; emitted lazy chunk; NOT excluded from non-Base44 build (L3 gap).
B. Auth compat: App → AuthContext → base44Client → base44Adapter. Static at App-load (base44Adapter in cache from bootstrap); always present.
C. Direct auth SDK: App → AuthContext → @base44/sdk/dist/utils/axios-client. Static deep import; independently emittable; always present.
D. Build tool: vite.config.js → @base44/vite-plugin → alias + HTML injections. Always enabled; owns @/; cannot be removed without replacing alias.
E. Config: main/AuthContext/base44Adapter → appParams → VITE_BASE44_* + token/URL semantics. Provider-specific (appId/token/functionsVersion/serverUrl/requiresAuth:false).
Phases: A/C/E runtime+emitted; B runtime+emitted; D build+dev+production. A replaceable via loader registry; B/C need auth-boundary (facade/alias); D needs build-target config; E needs app-param boundary. D + B/C prevent an SDK-free non-Base44 build.

## Ownership and Mutability
- base44Adapter/backendAdapter/providerBootstrap/providerSelection/base44Client/appParams/main/App/index.html: APPLICATION-OWNED, editable.
- AuthContext.jsx: PLATFORM-MANAGED (auth provider scaffold; imports SDK directly; constraint documented since Wave 10.5). Safe to import and re-export; NOT safe to modify directly.
- @base44/vite-plugin / @base44/sdk: PACKAGE-OWNED; editable only via config/alias.
- ui/image.jsx base44 host: PLATFORM-MANAGED (shadcn image component).
- Plugin entry internals beyond verified symbols: UNKNOWN (full transform set not exhaustively read; no virtual modules detected; jsx-processor exists for visual edit).
AuthContext blocker classification: PLATFORM-MANAGED HARD BLOCKER for direct modification; BUILD-ALIASABLE / FACADE-ABLE without modifying it. A platform-managed file is NOT selected for direct modification.

## Runtime Profile vs Build Target
Runtime environment profile (VITE_APP_ENVIRONMENT_PROFILE): base44-cloud, local-development, private-demo, enterprise-offline-future — descriptive browser-visible configuration; maps to provider family base44→base44; NOT a security boundary; does NOT guarantee bundle exclusion. Provider family: base44-cloud→base44, local-development→base44. Build target: a future trusted compile-time selection determining provider modules/auth implementation/enabled Vite plugins/aliases/permitted runtime profiles/emitted provider dependencies. A browser-controlled VITE_* value must NOT be the sole authority for L3. The two concepts are distinct and must not be conflated.

## L3 Proof Standard
L3 = UNSELECTED PROVIDER BUNDLE EXCLUSION. Proof for a non-Base44 build requires: (1) base44Adapter absent from build graph; (2) base44Client shim absent; (3) Base44 AuthContext absent; (4) direct @base44/sdk imports absent; (5) @base44/vite-plugin disabled or proven not to inject Base44 runtime code; (6) emitted JS/CSS/sourcemaps contain no Base44 runtime/provider code; (7) initial entry has no static/dynamic Base44 import; (8) no runtime fallback can load Base44; (9) incompatible runtime profiles fail deterministically; (10) package deps may remain in package.json only if deployment contract permits — alone does not prove emitted-code exclusion. Distinguish: not evaluated / not requested by browser / emitted lazy-shared chunk / absent from emitted assets / absent from deployment deps. Dynamic import alone proves none of the final three.

## L4 Proof Standard
L4 = COMPLETE FRONTEND CLOUD-PROVIDER INDEPENDENCE. Requires provider-neutral boundaries for: backend access; auth context; current-user resolution; login redirect; logout; token acquisition/storage; public app settings; HTTP client creation; files/storage; provider-specific browser URLs; provider-specific SDK utilities; build plugin and HTML transforms. Must preserve: AuthProvider/useAuth consumer contract or versioned replacement; React context identity; current Base44 behavior for Base44 builds; error/loading states; navigation/logout; no auth/tenant/RLS weakening; no provider fallback; no raw SDK exposure.

## AuthContext Contract
Exports `{ AuthProvider, useAuth }`. AuthProvider props `{ children }`. useAuth returns `{ user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, authChecked, appPublicSettings, logout, navigateToLogin, checkUserAuth, checkAppState }`; throws outside provider. Context default undefined. useEffect → checkAppState on mount: creates createAxiosClient (baseURL /api/apps/public, X-App-Id=appParams.appId, token=appParams.token), GET public-settings, then checkUserAuth (base44.auth.me) if token. logout → base44.auth.logout(href); navigateToLogin → base44.auth.redirectToLogin(href). Uses appParams (appId, token) + base44Client (base44). Direct SDK: createAxiosClient from @base44/sdk/dist/utils/axios-client. Module-scope refs: createContext() only; all base44.auth calls inside functions (no module-scope auth). Direct SDK assumptions: axios-client utility + auth SDK object shape.

## Auth Consumer Surface
Direct AuthContext importers: 25. AuthProvider consumers: 1 (App.jsx). useAuth consumers: 25. Normalized surface:
| Contract member | Consumers | Module-scope | Render-time | Effect/event |
|---|---|---|---|---|
| AuthProvider | 1 (App) | yes (App tree) | yes | no |
| user | 24 | no | yes | no |
| isAuthenticated | 1 (ProtectedRoute) | no | yes | no |
| isLoadingAuth | 2 (App, ProtectedRoute) | no | yes | no |
| isLoadingPublicSettings | 1 (App) | no | yes | no |
| authError | 2 (App, ProtectedRoute) | no | yes | no |
| authChecked | 1 (ProtectedRoute) | no | yes | no |
| appPublicSettings | 0 external | — | — | — |
| logout | 1 (UserMenu) | no | no | event |
| navigateToLogin | 1 (App) | no | no | event |
| checkUserAuth | 1 (ProtectedRoute) | no | no | effect |
| checkAppState | 0 external | — | — | — |
Field union: 9. 24/25 consumers read only `user`. Consumers rely on stable names/behavior, not on context object identity (consumed via useAuth hook = the identity surface). Imports are mechanically migratable (single specifier change). A re-export facade preserves exact AuthProvider/useAuth references → React context identity; a delegating wrapper would not.

## App Parameters and Token Semantics
appParams fields: appId (BASE44-SPECIFIC/PUBLIC), token (BASE44-SPECIFIC/SECURITY-SENSITIVE — access_token URL param stripped + localStorage base44_access_token/token), fromUrl (GENERIC), functionsVersion (BASE44-SPECIFIC), appBaseUrl (BASE44-SPECIFIC), profile (PROFILE-SPECIFIC via VITE_APP_ENVIRONMENT_PROFILE). URL parsing (URLSearchParams) + localStorage token handling + clear_access_token cleanup are Base44-specific. Public env reads: VITE_BASE44_APP_ID, VITE_BASE44_FUNCTIONS_VERSION, VITE_BASE44_APP_BASE_URL, VITE_APP_ENVIRONMENT_PROFILE. Provider-neutral in name only; behavior Base44-specific. A future provider-independent frontend needs (A) one generic app-config module with provider extensions AND (C) a separate token/auth bootstrap config. Do not move secrets into VITE_*. FUTURE EXTRACTION REQUIRED for appId/token/functionsVersion/appBaseUrl when a non-Base44 build is targeted.

## Vite Plugin and Build Pipeline
@base44/vite-plugin 1.0.30 (production dep). VERIFIED from dist/index.js: `vitePlugin(opts)` returns a plugin array (name "base44") whose `config` hook sets `resolve.alias = { "@/": "/src/" }` — THE PLUGIN OWNS THE @/ ALIAS. htmlInjectionsPlugin injects into index.html (4 html, 3 inject refs) — production-impacting. visualEditPlugin/errorOverlayPlugin + hmrNotifier/navigationNotifier/analyticsTracker are dev/preview integrations gated by opts + sandbox detection (process.env.MODAL_SANDBOX_ID); all opts currently true in vite.config.js. legacySDKImports (currently false) would `define` process.env.VITE_BASE44_* globals. No virtual modules detected. jsx-processor.js handles visual-edit JSX transform (dev/preview). Production-impact: HTML injections enter production; dev integrations are opt/sandbox-gated. Disablement feasibility: plugin CANNOT be removed without replacing resolve.alias (@/) — breaks every @/ import; HTML injections must also be gated. A non-Base44 build therefore requires a build-target config (conditional or separate) providing the alias and omitting Base44 HTML injections — not mere plugin removal. Plugin selection resolved before source-graph construction. Plugin internals beyond alias+HTML+dev-integrations: UNKNOWN (full transform set not exhaustively read).

## Build-Boundary Candidates
| Candidate | L3 | Auth isolation | Plugin exclusion | Migration | Determinism | Risk | Decision |
|---|---|---|---|---|---|---|---|
| A runtime dynamic imports (current) | none | no | no | 0 | low | low | CURRENT — L2 only |
| B conditional vite.config + trusted build target | high | via alias | conditional | low | high | medium | RECOMMENDED (future) |
| C separate vite configs per target | high | via alias | per-config | low | high | med-high (drift) | DEFERRED (drift) |
| D build-specific entry points | high | per-entry | per-entry | medium | medium | high (dup) | REJECTED (duplication) |
| E define constants for DCE | unproven | partial | no | 0 | low | high | REJECTED as proof (tree-shaking≠exclusion) |
| F package conditional exports | high | high | high | high | high | high (complex) | DEFERRED (not justified now) |

## Auth-Boundary Candidates
| Candidate | Identity | Migration | L4 | Platform risk | Rollback | Decision |
|---|---|---|---|---|---|---|
| A exact-path alias @/lib/AuthContext | safe (same module) | 0 | medium | low | alias removal | VIABLE (defers ownership) |
| B app-owned AuthContext facade (re-export) | safe (same refs) | 25 mechanical | high | low | import-only + delete | SELECTED for 10.6.2 |
| C generic AuthContext + provider auth driver | safe (new ctx) | 25 + driver | highest | medium | large | DEFERRED (post-facade) |
| D fork/copy platform AuthContext | unsafe (drift) | 25 | medium | high | large | REJECTED |
| E separate provider-specific App roots | safe | high | low | high | large | REJECTED |
| F generic DI framework | n/a | high | low | high (no need) | large | REJECTED |

## Recommended Target Architecture
Trusted build target (compile-time, non-VITE authority) → immutable target manifest → allowed runtime profiles → Vite plugin set → provider-loader → auth implementation → app-parameters → main bootstrap → App through application-owned facades. Base44 build: current plugin + base44 loader + platform AuthContext (via facade) + Base44 appParams/behavior preserved. Future private/offline builds: alternate loader/auth/appParams via the same facades; plugin excluded/replaced; incompatible profiles fail deterministically; no fallback; source-graph exclusion via build-target config (Candidate B); emitted-build verification via graph/asset inspection (L3 standard). Not adopted in 10.6.1; evidence-supported, not implemented.

## First Implementation Candidate
Selected: APPLICATION-OWNED AUTH IMPORT FACADE (auth Candidate B). Goal: one stable application-owned auth import boundary without modifying platform-managed AuthContext, preserving exact React context identity and Base44 behavior. Files created: `src/auth/AuthContextFacade.jsx` (direct re-export of exact `AuthProvider`, `useAuth` from `@/lib/AuthContext`, no wrappers). Files modified: 25 AuthContext consumers (import specifier `@/lib/AuthContext` → `@/auth/AuthContextFacade`; logic unchanged). Consumer count: 25. Public exports: `{ AuthProvider, useAuth }`. Identity contract: re-export preserves exact symbol + context identity. Behavior parity: AuthProvider/useAuth, login/logout/current-user/public-settings, error/loading states unchanged. Non-goals: no build-target, no plugin change, no alternate auth, no L3/L4 claim, no AuthContext.jsx edit. Verification: static scan (0 remaining `@/lib/AuthContext` app importers), identity assertion (same references), default Base44 Preview passes. Rollback: revert 25 specifiers + delete facade (import-only). Next dependency: enables future build-target auth alias (L4) without touching platform AuthContext. Achieved level: L2 maintained + one application-owned auth import boundary (L4 prerequisite). Unachieved: L3, L4. Selected because all 25 consumers are editable application-owned files, re-export preserves identity, migration is mechanical, rollback bounded, no platform validator rejects a normal app import path.

## Acceptance Criteria
Auth facade candidate (Wave 10.6.2, not implemented here): platform AuthContext unchanged; facade exports exact symbols via direct re-export; React context identity preserved (Object.is(facade.AuthProvider, AuthContext.AuthProvider)); all 25 direct application imports migrated (0 remaining `@/lib/AuthContext` app importers); no consumer behavior changes; no Base44 SDK import added by facade; no second AuthProvider/context; no provider/client duplication; login/logout/current-user/public-settings unchanged; no auth/tenant/RLS changes; default Base44 Preview passes; rollback import-only + facade deletion; L3/L4 remain NOT IMPLEMENTED. Build-target descriptor criteria (not selected): trusted build target distinct from runtime profile; immutable mapping; incompatible combinations fail; no provider loading/plugin/alternate change; no L3 claim; no browser-controlled authority; bounded rollback. No criteria marked implemented in 10.6.1.

## Residual Risks
- L4 hard blocker unchanged: AuthContext stays platform-managed, directly imports Base44 SDK axios utility + auth SDK; the facade relocates the import boundary, does not remove the SDK edge. L4 needs a future auth driver (Candidate C) + build-target auth alias.
- L3 not proven: dynamic import excludes base44Adapter from eager evaluation but the plugin still owns @/ and injects HTML; a non-Base44 build needs a build-target config (Candidate B/C) not yet implemented. Build/chunk topology not inspected.
- Plugin internals partially UNKNOWN: full transform set not exhaustively read; no virtual modules detected but behavior beyond alias+HTML not fully characterized.
- appParams token/appId semantics are Base44-specific; future extraction (A+C) is non-trivial (security-sensitive token handling).
- 25-consumer migration, though mechanical, is a wider surface than prior waves; rollback discipline required.
- ui/image.jsx base44.com host is platform-managed, out of scope for the facade; an L4 build must address it separately.

## Next Decision Gate
Wave 10.6.2 — selected bounded frontend-independence boundary implementation: APPLICATION-OWNED AUTH IMPORT FACADE (create src/auth/AuthContextFacade.jsx re-exporting exact AuthProvider/useAuth; migrate 25 consumer imports to the facade; preserve identity and Base44 behavior; no build/plugin/auth-provider changes). REQUIRES EXPLICIT APPROVAL. Do not mark Wave 10.6 complete. Do not mark Phase 10 complete or frozen.

## Final Result
Wave 10.6.1 frontend provider-independence blocker discovery and contract planning complete.