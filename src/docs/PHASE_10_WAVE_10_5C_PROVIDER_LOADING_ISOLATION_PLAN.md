# Phase 10 — Wave 10.5C Provider Loading Isolation Plan

**Документна власт:** Авторитетен планов запис за Wave 10.5C.1. Не модифицира Phase 2–9 замразени договори или съществуващи Phase 10 правила. Само планиране.
**Дата:** 2026-07-25.

## Status

Phase 10 — IMPLEMENTATION. Wave 10.5A COMPLETE, Wave 10.5B COMPLETE, Wave 10.5C IN PROGRESS, Wave 10.5C.1 PLANNING COMPLETE. Provider-loading isolation implementation NOT STARTED. Alternate/private-demo/enterprise-offline NOT IMPLEMENTED. Eager Base44 import limitation REMAINS. Phase 10 frozen snapshot NOT CREATED. Next gate: Wave 10.5C.2 — REQUIRES EXPLICIT APPROVAL.

## Scope

Създаден точно 1 нов документ (този). 0 съществуващи файла модифицирани. Инспектирани: `main.jsx`, `App.jsx`, `providerSelection.js`, `backendAdapter.js`, `base44Adapter.js`, `base44Client.js`, `AuthContext.jsx`, `app-params.js`, `environment-profile.js`, `function-call.js`, `package.json`, `vite.config.js`, Wave 10.5A/B docs. Не инспектирани backend функции или entity схеми. 0 build/Preview.

## Method

Източник-ниво инспекция на стартови модули; целевено търсене в 143 frontend файла; анализ на ESM реда на оценяване; сравнение на кандидати; класификация на нива изолация. Всеки извод от реални броячи.

## Current Startup Timeline

Установено от `main.jsx` + графа:

1. Browser entry: `index.html` → `/src/main.jsx` (единствен entry).
2. `main.jsx` оценка: `import App from '@/App.jsx'` (статичен) → целият App подграф се оценява ПРЕДИ `createRoot`.
3. `App.jsx` оценка: AuthProvider (AuthContext, 25 импортера), 17 backendAdapter консуматора.
4. `AuthContext` оценка: `import { base44 } from '@/api/base44Client'` → `base44Client` → `base44Adapter`.
5. `base44Adapter` оценка: `import { createClient } from '@base44/sdk'` + `createAxiosClient` + `appParams`.
6. `appParams` оценка: `resolveActiveProfile(...)` → профил разрешен (`base44-cloud` по подразбиране).
7. **`createClient()` изпълнение** (redove 21–28 в `base44Adapter.js`) — клиент конструиран ПО ВРЕМЕ на модулна оценка (eager), ПРЕДИ React mount.
8. `backendAdapter` оценка: `providerSelection` (импортира `base44Adapter` — кеширан) → `resolveProvider(appParams.profile)` връща същия singleton.
9. Всички модули оценени; SDK зареден; клиент конструиран.
10. React mount: `createRoot(...).render(<App/>)`.
11. AuthProvider `useEffect` → `checkAppState()` → първи мрежов трафик СЛЕД mount.

Различаване: модулно зареждане (2–9) → клиент construction (7) → React рендиране (10) → удостоверен трафик (11). `createClient()` в модулна оценка, не при mount.

## Eager Loading Roots

Три независими пътя (verified):

**A. Backend path:** consumer → `backendAdapter` → `providerSelection` → `base44Adapter` → `@base44/sdk`/`createClient`. Статичен, 17 консуматора. SDK load + клиент construction при оценка; мрежов трафик само при method invocation; portability blocker (application-owned).

**B. Auth compatibility path:** App/AuthProvider → `AuthContext` → `base44Client` → `base44Adapter` → SDK. Статичен, 25 AuthContext импортера, 1 `base44Client` импортер. Същият singleton (кеширан от A или B); blocker (platform-managed AuthContext + application-owned base44Client).

**C. Direct SDK utility path:** `AuthContext` → `@base44/sdk/dist/utils/axios-client` (`createAxiosClient`). Статичен, 2 импортера (AuthContext, base44Adapter). Platform-managed blocker.

**Критично:** Премахване САМО на статичния `backendAdapter` път НЕ предотвратява Base44 — `AuthContext` продължава да зарежда `base44Client` → `base44Adapter` → SDK. Двата пътя споделят 1 `providerClient` singleton (1 `createClient` локация).

## Isolation Level Classification

| Ниво | Статус |
|---|---|
| L0 eager single-provider | CURRENT |
| L1 deferred client init | достижим backend path |
| L2 selected provider module loading | цел за C.2 (backend path) |
| L3 unselected bundle exclusion | НЕ достъпимо в C.2 |
| L4 пълна frontend независимост | БЛОКИРАН от AuthContext |

Текуще: L0. Максимум променяйки само application-owned adapter файлове: L2 backend path (AuthContext path остава eager). Блокирано от AuthContext/base44Client/direct SDK: L4 (и L3 за пълно exclusion). private-demo изисква L3/L4 (НЕ достъпимо). enterprise-offline изисква L4.

## Consumer Contract Freeze

Запазва се (C.2): `backendAdapter` авторитетен consumer път; експортира `backend` + `catalog`; `backend` ключове `auth, functions, catalog, fetchPublicSettings` (sync за 17); `catalog` ключове `list, filter, get` + 16-entity allow-list; consumer пътища непроменени; без generic CRUD; без raw SDK; 1 provider bundle; 1 Base44 клиент; без silent fallback; без profile от URL/hostname/localStorage; профилните имена НЕ са security boundary; без auth/tenant/RLS отслабване.

Identity предположения (от графа): 0 консуматора destructuring `backend.auth`/`backend.functions` на модулно ниво (`destructureBackend=0`). 6 `backend.auth` (property access), 2 `backend.functions`, 12 `backend.catalog` — всички property access. Консуматорите изискват stable method availability, не задължително exact identity. Въпреки това плановият договор запазва exact `providerClient` identity (без Proxy/clone) — не се отслабва без доказателство.

## Async Bootstrap Compatibility

Въпрос: Може ли `main.jsx` да остане единствената async граница при 17 синхронни консуматора? **Отговор: YES.**

Доказателство: `main.jsx` е единствен entry (`createRoot=1`). `backendAdapter` се зарежда САМО през App подграфа (17 консуматора, transitive на App). Ако `main.jsx` динамично импортира App СЛЕД `await bootstrapProvider(appParams.profile)`, `backendAdapter` се оценява СЛЕД bootstrap → чете bound bundle синхронно → sync facade запазен, 17 консуматора непроменени.

Условия: (1) provider bundle bound ПРЕДИ `backendAdapter` оценка; (2) App динамично импортиран само след успешен bootstrap; (3) bootstrap неуспих предотвратява React mount (loading/error UI в main); (4) HMR — Vite поддържа динамичен импорт; (5) повторен bootstrap idempotent/throw; (6) module-cache — динамичен импорт кешира base44Adapter, същия singleton; (7) circular import 0 риск (main → providerBootstrap → динамичен base44Adapter; App → backendAdapter → providerSelection → getBoundProvider, без статичен edge към base44Adapter).

## AuthContext Blocker

Platform-managed (валидатор блокира модификация — Wave 10.1). Статично импортира `base44Client` → `base44Adapter` → SDK. Директно импортира `createAxiosClient` от SDK (red 4). Забавеният App import забавя тези модули след bootstrap, но AuthContext продължава да статично ги импортира → SDK се зарежда (след bootstrap) за всеки base44 профил. Бъдещ non-Base44 provider пак ще зареди Base44 чрез AuthContext. L4 НЕ е възможно без replace/wrap/alias/conditional exclude на AuthContext.

**Класификация: HARD BLOCKER FOR FULL FRONTEND ISOLATION (L4).** За L2 backend-path НЕ е blocker (зарежда SDK след bootstrap — приемливо за base44 профили). Backend-only improvement НЕ е пълна frontend изолация.

## Candidate Comparison

| Candidate | Sync | Identity | Module isolation | Exclusion | AuthCtx | Риск | Decision |
|---|---|---|---|---|---|---|---|
| A. Async resolveProvider в backendAdapter | НЕ | да | частична | не | – | висок (чупи 17) | REJECT |
| B. Top-level await в backendAdapter | НЕ | да | частична | не | – | висок (чупи sync) | REJECT |
| C. Bootstrap в main + динамичен App | ДА | ДА | ДА (L2 backend) | не | не променя | среден (3–4 файла) | ACCEPT |
| D. Build-time alias / entry | ДА | ДА | ДА (L3) | ДА | изисква Vite промяна | висок | FUTURE |
| E. Hybrid C+D | ДА | ДА | L2 сега, L3/L4 по-късно | по-късно | запазва blocker | bounded | LONG-TERM |

Отхвърлени: call-site selection; user dynamic paths; generic DI; масова миграция; raw client; silent fallback; преструване че AuthContext решен.

## Recommended Loading Contract

Candidate C (без имплементация тук):

- Bootstrap entry: `src/main.jsx` (единствена async граница).
- Profile input: `appParams.profile` (вече разрешен).
- Loader map: `Object.freeze({ base44: async () => ({ providerClient, fetchPublicSettings }) })` през `await import('@/services/base44Adapter')` — 1 family, без user paths, без env reads.
- Loader return: `Promise<{ providerClient, fetchPublicSettings }>`.
- Validation timing: по време на bootstrap, преди binding (повтаря `validateBundle` / `PGP_PROVIDER_INVALID_FACADE`).
- Singleton ownership: `providerBootstrap.js` (module-level bound bundle); `base44Adapter` продължава да притежава `providerClient` (1 createClient).
- Init state: `uninitialized | binding | bound | failed`.
- Repeated bootstrap: idempotent ако същия профил; иначе `PGP_PROVIDER_ALREADY_INITIALIZED` (RESERVED).
- Failure: `PGP_PROVIDER_LOAD_FAILED`; main улавя → loading/error UI; React НЕ се монтира.
- App import: само след успешен bootstrap (`await import('@/App.jsx')`).
- backendAdapter оценка: след App импорт → след bootstrap; чете bound bundle sync.
- Identity: запазва се (същия `providerClient`; без Proxy/clone).
- No construction before selection; no fallback; no env reads в loader; no user import paths.
- Relationships: `providerSelection` губи статичен `base44Adapter` импорт; добавя `getBoundProvider()` (`PGP_PROVIDER_BOOTSTRAP_REQUIRED`). `backendAdapter` замества `resolveProvider(appParams.profile)` с `getBoundProvider()`. `base44Adapter` непроменен (зарежда се динамично). `AuthContext`/`base44Client` непроменени (оценяват след bootstrap чрез забавения App).
- Achieved: L2 backend path. Unachieved: L3, L4; AuthContext продължава да зарежда SDK.

## Error Ownership

Запазени: `PGP_ENV_PROFILE_UNKNOWN`, `PGP_ENV_PROFILE_NOT_IMPLEMENTED`, `PGP_PROVIDER_NOT_REGISTERED`, `PGP_PROVIDER_INVALID_FACADE`.

- `PGP_PROVIDER_BOOTSTRAP_REQUIRED` — REQUIRED (getBoundProvider преди bootstrap).
- `PGP_PROVIDER_LOAD_FAILED` — REQUIRED (динамичен импорт/validation неуспех).
- `PGP_PROVIDER_ALREADY_INITIALIZED` — RESERVED (повторен bootstrap с различен профил).
- `PGP_PROVIDER_BOOTSTRAP_REENTRANT` — RESERVED (конкурентен bootstrap; defensive).

Без secrets/dumps/raw exceptions; deterministic failure преди mount; без fallback.

## Build and Bundle Analysis

`package.json`/`vite.config.js`: Vite `^6.1.0` (VERIFIED); `type: module` (VERIFIED); build target НЕ зададен (UNKNOWN WITHOUT BUILD); TLA поддържан за entry (VERIFIED) но НЕ за backendAdapter (чупи sync); dynamic import VERIFIED (0 текущи); `@/` alias VERIFIED; manual chunks НЕ (NOT CONFIGURED); optimizeDeps НЕ (UNKNOWN); SSR НЕ (NOT CONFIGURED); `@base44/vite-plugin` VERIFIED.

Различаване: lazy chunk от динамичен импорт — VERIFIED механизъм; runtime non-loading преди bootstrap — VERIFIED; пълно exclusion от build — НЕ гарантирано (трябва build-time alias); пълно отсъствие provider зависимости — L4 НЕ достъпимо. Динамичен импорт ≠ bundle exclusion. Да се провери в C.2. Build НЕ изпълнен тук.

## First Implementation Candidate

Candidate C — Deferred application bootstrap (за Wave 10.5C.2):

- Име: Deferred application bootstrap.
- Achieved level: L2 backend path (explicitly NOT L3/L4).
- Files created: `src/services/providerBootstrap.js`.
- Files modified: `src/main.jsx` (async bootstrap → динамичен App); `src/services/providerSelection.js` (премахва статичен base44Adapter импорт; добавя `getBoundProvider()` + `PGP_PROVIDER_BOOTSTRAP_REQUIRED`); `src/services/backendAdapter.js` (`resolveProvider(appParams.profile)` → `getBoundProvider()`).
- Prohibited: `base44Adapter.js`, `base44Client.js`, `AuthContext.jsx`, `app-params.js`, `environment-profile.js`, `function-call.js`, `vite.config.js`, `package.json`, backend функции, entities/RLS, pgp-core-domain, 17 консуматора, Phase 2–9 docs, Wave 10.5A/B docs.
- Public API: `providerBootstrap.bootstrapProvider(profile)` → `Promise<void>`; `providerSelection.getBoundProvider()` → `{ providerClient, fetchPublicSettings }` (throw `PGP_PROVIDER_BOOTSTRAP_REQUIRED` ако unbound); `backendAdapter` exports непроменени.
- Init state: `uninitialized → binding → bound` (или `failed`); idempotent re-bind същия профил.
- Loader map: `Object.freeze({ base44: async () => ({ providerClient, fetchPublicSettings }) })` през `await import('@/services/base44Adapter')`.
- Binding contract: bootstrap валидира bundle (повтаря `validateBundle`), freeze, записва в module state.
- Error contract: `PGP_PROVIDER_BOOTSTRAP_REQUIRED`, `PGP_PROVIDER_LOAD_FAILED` (REQUIRED); `PGP_PROVIDER_ALREADY_INITIALIZED`, `PGP_PROVIDER_BOOTSTRAP_REENTRANT` (RESERVED).
- Consumer changes: 0.
- Identity changes: 0 (същия `providerClient`; `createClient` options непроменени; клиенти=1).
- Build verification: `npm run build` в C.2; проверка отделен chunk за base44Adapter.
- Preview verification: app зарежда, без blank screen, без bootstrap error, Dashboard/routing запазени, без записи променени.
- Chunk inspection: потвърди base44Adapter в отделен chunk; chunk не се зарежда преди bootstrap.
- Rollback: revert `main.jsx` (синхронен App импорт + createRoot); изтрий `providerBootstrap.js`; възстанови `providerSelection.js` (статичен base44Adapter + `resolveProvider`); възстанови `backendAdapter.js` (`resolveProvider(appParams.profile)`). Bounded — без други файлове.
- AuthContext residual blocker: запазва (HARD L4; не blocker за L2).
- Non-goals: НЕ alternate provider; НЕ решава eager loading напълно (AuthContext все още зарежда SDK); НЕ L3/L4; НЕ private-demo/enterprise; НЕ AuthContext промяна; НЕ generic CRUD; НЕ auth/tenant/RLS; НЕ нови зависимости.

## Acceptance Criteria

C.2 трябва да удовлетвори (НЕ маркирани тук): без статичен `base44Adapter` импорт от `providerSelection`; без `createClient` преди explicit selection; fixed allow-listed loader; provider зарежда точно веднъж; `backendAdapter` API непроменен; 17 консуматора непроменени; `backend`/`catalog` sync след bootstrap; клиенти=1; `createClient` options непроменени; `base44-cloud` непроменен; `local-development` Base44-backed; private-demo/enterprise NOT IMPLEMENTED; без alternate provider; без user dynamic path; без silent fallback; без generic CRUD; без auth/tenant/RLS; без нова зависимост; bootstrap неуспих предотвратява mount; bounded rollback; build/Preview тестваеми; chunk инспектируем; AuthContext blocker запазен.

## Residual Risks

Eager limitation REMAINS за AuthContext (L4 блокиран). `main.jsx` async — bootstrap fail спира mount (loading/error UI задължителен). HMR entry-async — да се провери в C.2. Dynamic chunk ≠ bundle exclusion (L3 изисква build-time alias). AuthContext platform-managed — L4 изисква platform промяна. Profile names — descriptive, не security. Phase 10 НЕ замразен. Build/Preview не изпълнени тук.

## Next Decision Gate

Wave 10.5C.2 — bounded provider-loading isolation implementation — REQUIRES EXPLICIT APPROVAL. Само Candidate C; без alternate provider; без AuthContext промяна.

## Final Result

Wave 10.5C.1 provider-loading isolation planning complete.