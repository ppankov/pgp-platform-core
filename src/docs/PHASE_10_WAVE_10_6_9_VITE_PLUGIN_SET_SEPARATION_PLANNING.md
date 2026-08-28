# Phase 10 — Wave 10.6.9 Vite Plugin-Set Separation Planning

## 1. Status

Wave 10.6.9 — **PLANNING COMPLETE, BOUNDED**.

Planning decision: **P-A — READY FOR BOUNDED IMPLEMENTATION**.

Това решение разрешава само предложение за следваща implementation wave. В
тази wave няма plugin-set separation implementation, non-Base44 build, L3 или
L4. Wave 10.6 остава **IN PROGRESS**. Phase 10 остава **NOT COMPLETE / NOT
FROZEN**.

## 2. Scope

Вълната картографира текущите Vite import, config, plugin и authority граници
и избира bounded архитектура за отделяне на Base44-specific plugin module от
neutral trusted config dispatcher. Анализът е върху branch
`codex/phase-10-current` и HEAD
`8ac254af64537e59ee8ceae9f6955c0bbcc8e1f0`.

Единствената repository промяна е този planning документ.

## 3. Explicit non-goals

**OUT OF SCOPE / NOT IMPLEMENTED** в тази wave:

- промяна на `vite.config.js`, wrapper, descriptor, tests или application
  source;
- selectable non-Base44 target или canonical production име за него;
- alternate provider, client, auth implementation или React context;
- package removal, lockfile rewrite или dependency migration;
- Base44 SDK/runtime separation;
- emitted non-Base44 build proof;
- L3/L4 implementation или verification;
- backend, entity, RLS, tenant, datastore, sync или deployment промяна;
- proof-of-concept или alternate config в repository.

## 4. Starting Git state

- Branch: `codex/phase-10-current` — **PASS**.
- HEAD: `8ac254af64537e59ee8ceae9f6955c0bbcc8e1f0` — **PASS**.
- Upstream: `origin/codex/phase-10-current` — **PASS**.
- Initial `git status --short`: празен — **PASS**.
- Initial index: без staged промени — **PASS**.

## 5. Prior-wave baseline

- Wave 10.6.5 — VERIFIED AND CLOSED, BOUNDED.
- Wave 10.6.6 — Decision B correction loop CLOSED.
- Wave 10.6.7 — VERIFIED AND CLOSED, BOUNDED.
- Wave 10.6.8 — Decision A, VERIFICATION COMPLETE.
- Wrapper допуска точно `dev`, `build`, `preview` и нула caller arguments.
- Caller `PGP_BUILD_TARGET` се заменя с `base44-cloud` преди Vite import.
- Descriptor skeleton е наличен; само `base44-cloud` е selectable.
- Static Base44 plugin import exclusion — NOT IMPLEMENTED.
- Non-Base44 build/exclusion и L3/L4 — NOT IMPLEMENTED / NOT VERIFIED.

## 6. Files and evidence inspected

Прочетени и проверени са изцяло релевантните Wave 10.6.5–10.6.8 документи,
`scripts/run-vite.mjs`, wrapper/descriptor tests,
`src/build/buildTargetDescriptor.js`, `vite.config.js`, `package.json`,
`package-lock.json`, `base44/config.jsonc`, `src/main.jsx`, provider/client
entrypoints, `src/lib/app-params.js`, `src/lib/environment-profile.js` и
`.gitignore`.

Bounded `rg` searches обхванаха `base44`, package names, `vite`, `plugins`,
`createClient`, static/dynamic imports, `PGP_BUILD_TARGET`, `VITE_`,
`process.env`, `import.meta.env`, aliases, config files и scripts.

Проверен е локалният published `@base44/vite-plugin` 1.0.30 package entry,
неговият `src/index.ts` и `dist/index.js`. Проверен е и локалният Vite 6.4.3
config-loader source и type contract за async config.

Repository discovery намери точно един Vite config entry:
`vite.config.js`. Не е намерен друг Vite config helper, plugin factory или
alternate config в application repository.

## 7. Current Vite architecture

Текущият flow е:

1. `package.json` `dev`/`build`/`preview` стартира
   `node scripts/run-vite.mjs <command>`.
2. Wrapper проверява own-key command allow-list и zero-argument boundary.
3. Wrapper задава `PGP_BUILD_TARGET=base44-cloud` и rewrite-ва Vite argv.
4. Wrapper dynamic-import-ва `node_modules/vite/bin/vite.js`.
5. Vite 6.4.3 открива и bundle-load-ва `vite.config.js` по подразбиране.
6. ESM static imports на config-а се resolve/load-ват преди module body.
7. Module body resolve-ва descriptor и проверява пет Base44 bindings.
8. `base44({...})` създава Base44 plugin array; `react()` е след него.
9. Vite изпълнява plugin hooks и изгражда browser application graph.
10. Browser `src/main.jsx` проверява runtime profile, bootstrap-ва provider,
    dynamic-import-ва `App.jsx` и mount-ва React.
11. `providerBootstrap.js` dynamic-import-ва единствения Base44 adapter;
    `base44Adapter.js` е единственият frontend `createClient` location.

Build plugin selection и application runtime provider selection са отделни
граници. Тази wave планира само първата.

## 8. Current import graph

| Importer | Imported module | Type | Execution/config point | Effect |
|---|---|---|---|---|
| `scripts/run-vite.mjs` | Vite CLI | fixed dynamic import | след wrapper validation и target assignment | стартира Vite |
| `vite.config.js` | `@base44/vite-plugin` | static | config module instantiation, преди descriptor body | package resolution/loading и Base44 config-graph participation |
| `vite.config.js` | `@vitejs/plugin-react` | static | config module instantiation | React plugin factory availability |
| `vite.config.js` | `vite` | static | config module instantiation | `defineConfig` |
| `vite.config.js` | descriptor module | static | преди config body | trusted resolver/assertions |
| `vite.config.js` | `base44({...})` | factory call | след descriptor assertions | Base44 plugin array construction |
| `src/main.jsx` | `providerBootstrap.js` | static | browser entry evaluation | runtime bootstrap API |
| `providerBootstrap.js` | `base44Adapter.js` | fixed dynamic | след profile/family selection | Base44 client module loading |
| `base44Adapter.js` | `@base44/sdk` | static | adapter evaluation | единствен frontend `createClient` |

Production application importer на `@base44/vite-plugin` е точно
`vite.config.js`. Документните и lockfile references не са executable
importers.

## 9. Trusted authority boundary

**PASS / CURRENT.** Trusted authority е Node-side wrapper constant
`base44-cloud`. Caller environment override се заменя. Caller Vite arguments,
включително `--config`, са забранени. Descriptor lookup е own-key и
unknown/missing/non-selectable targets fail-closed.

`VITE_*`, URL/query, local storage, cookie и browser input не избират plugin
set. `VITE_APP_ENVIRONMENT_PROFILE` избира само позволен runtime profile в
рамките на вече фиксирания build target.

Бъдещ trusted target selection трябва да бъде добавен само чрез отделно
одобрен Node orchestration contract; текущият caller environment не трябва да
получи authority.

## 10. Static-import risk assessment

**FAIL / EXCLUSION NOT IMPLEMENTED.** Първият ред на `vite.config.js` е static
import на `@base44/vite-plugin`. По ESM semantics package resolution,
instantiation и evaluation предхождат descriptor-dependent module body.

Конкретни последствия:

- package resolution е задължителен при всяко зареждане на текущия config;
- Base44 entry се evaluate-ва преди target-dependent factory decision;
- entry module чете `process.env.MODAL_SANDBOX_ID` top-level;
- entry static-import-ва `loadEnv` и Base44 error-overlay, visual-edit,
  utilities, HTML-injection и build-status modules;
- тези modules участват в Node config graph независимо дали factory по-късно
  би била пропусната;
- липсващ package прекъсва config load преди descriptor resolution;
- условен `base44(...)` call след static import би gate-нал factory, но не
  package resolution, module loading или config-source graph.

Не е установен active non-Base44 path. Bundle exclusion не може да се заключи
само от бъдеща липса на plugin в `plugins` array.

Допълнително доказателство: default Vite 6.4.3 `configLoader="bundle"`
обработва bare `dynamic-import` specifiers чрез `externalize-deps` resolver.
Следователно проста замяна на static import с `await import("@base44/vite-plugin")`
в bundled root config отлага evaluation, но все още изисква package resolution
при config bundling.

## 11. Package/dependency assessment

`@base44/vite-plugin` е production `dependency`, не `devDependency`:

- declared range: `^1.0.30`;
- lockfile version: 3;
- locked package: 1.0.30;
- resolved artifact: npm `vite-plugin-1.0.30.tgz` с integrity в lockfile;
- direct dependencies: `@babel/generator`, `@babel/parser`,
  `@babel/traverse`, `@babel/types`;
- current installed transitive versions за тези четири packages: 7.29.7.

Класификация:

| Boundary | Immediate Wave 10.6.10 target | Classification |
|---|---|---|
| Plugin factory/inclusion separation | да | proposed bounded scope |
| Module evaluation/import separation | да | proposed bounded scope |
| Config graph separation | да, чрез native dispatcher/module boundary | proposed bounded scope |
| Final application bundle exclusion | само regression evidence за текущ Base44 build; active non-Base44 proof не е възможен без target | future wave / NOT IMPLEMENTED |
| Physical package installation exclusion | не | OUT OF SCOPE |
| Lockfile/dependency removal | не | OUT OF SCOPE |

Installed package presence не е plugin execution. Config-graph absence не е
physical installation absence. Нито едното само по себе си не е emitted
browser bundle proof.

## 12. Separation objectives

Бъдещата implementation трябва:

- да resolve-ва target преди Base44-specific module import;
- да държи Base44 package import само в Base44-specific config module;
- да използва config-loading mode, който не pre-resolve-ва non-executed bare
  dynamic imports;
- да fail-closed за missing/unknown/non-selectable targets;
- да запази wrapper zero-argument policy;
- да не въвежда runtime/browser target authority или fallback;
- да остави provider/auth/runtime contracts непроменени.

## 13. Base44 parity requirements

За `base44-cloud` трябва да останат идентични:

- package version 1.0.30 и dependency/lockfile state;
- `base44({...})` factory invocation;
- options и стойности: `legacySDKImports` от
  `BASE44_LEGACY_SDK_IMPORTS`, `hmrNotifier: true`,
  `navigationNotifier: true`, `analyticsTracker: true`,
  `visualEditAgent: true`;
- flattened plugin order: Base44-returned plugins преди React plugin;
- Base44-owned `@/` alias и current hook behavior;
- npm/Base44 `dev`, `build`, `preview` entry contracts;
- production build, provider/client/auth behavior и one-client identity.

Module count трябва да се записва като parity evidence, но не е самостоятелно
security proof.

## 14. Future non-Base44 exclusion requirements

За описателния `future non-Base44 target` трябва да бъде доказуемо:

- Base44 package не се resolve-ва или import-ва по active config path;
- Base44 entry/helper modules не се evaluate-ват;
- factory не се извиква и plugin array не съдържа Base44 plugins;
- Base44-specific config module отсъства от active config dependencies;
- neutral target предоставя собствен `@/` alias без Base44 plugin;
- Base44 HTML injections/hooks не се активират;
- няма Base44 fallback или caller/browser authority;
- няма втори provider/client/auth context.

Repository съдържа descriptor ID `private-offline-future`, но source го
класифицира изрично като `NOT_IMPLEMENTED`, `selectable: false`, с `null`
bindings. Това е placeholder, не одобрено production target име. Planning
документът използва `future non-Base44 target`; canonical name/selectability
остават отделен Decision Gate.

## 15. Candidate architecture A

**Option A — conditional dynamic import в основния `vite.config.js`.**

Vite type contract приема `Promise<UserConfig>` и async config function.
Descriptor може да бъде resolve-нат преди dynamic import, а evaluation и
factory invocation могат да бъдат target-gated.

Положителни страни: най-малък source diff, нисък duplication риск, лесен
rollback.

Критичен недостатък: при default `configLoader="bundle"` Vite/esbuild
resolve-ва bare dynamic imports по време на config bundling. Така Option A
сама не доказва package-resolution independence или build без инсталиран
Base44 plugin. Classification: **не се препоръчва самостоятелно**.

## 16. Candidate architecture B

**Option B — target-specific config modules зад trusted dispatcher.**

Root `vite.config.js` остава единственият approved entry и съдържа trusted
descriptor resolution. Base44 package import и exact factory options се
преместват в Base44-specific module. React/neutral composition остава в
dispatcher или малък neutral helper. Future non-Base44 module ще предостави
собствен neutral alias/plugin set само след отделно одобрение.

За доказуема package-resolution граница тази опция трябва да върви с
wrapper-controlled fixed Vite `--configLoader native`; caller arguments
остават нула. Native loader import-ва root config като Node ESM, след което
неизбраният dynamic target module не се resolve-ва/evaluate-ва.

Плюсове: ясна еднопосочна graph граница, exact Base44 module ownership,
силна testability, нисък duplication риск, запазен root entry и bounded
rollback. Риск: native-loader parity трябва да бъде independently tested за
`dev`, `build`, `preview` и Base44 behavior.

## 17. Candidate architecture C

**Option C — wrapper-selected target-specific Vite config entrypoints.**

Wrapper може да подаде собствен фиксиран `--config <trusted-path>` без caller
forwarding. Това не нарушава zero-caller-argument policy, ако mapping-ът е
вътрешен immutable own-key mapping и caller не може да избере path.

Плюс: selected config graph е физически отделен и default bundler вижда само
избрания entry. Минуси: wrapper става config selector, което увеличава
security-critical surface; бъдещ target-selection UX още не е одобрен;
дублирането и drift между entrypoints са по-вероятни; regression към
caller-controlled `--config` трябва да бъде изрично предотвратен.

Classification: технически възможна, но по-сложна и по-рискова от Option B.

## 18. Optional evidence-driven architecture D

Не се предлага отделна Option D. Repository evidence се покрива от Option B
с изрично native config-loading constraint. Добавянето на четвърта
архитектура не затваря допълнителна установена граница.

## 19. Comparative assessment

| Criterion | A | B + native loader | C |
|---|---|---|---|
| Factory gating | силно | силно | силно |
| Module evaluation exclusion | да | да | да |
| Bare package resolution exclusion | не при default bundle loader | да за неизбран module | да за неизбран entry |
| Root config contract | запазен | запазен | разделен |
| Zero caller arguments | запазени | запазени | запазими, но wrapper logic расте |
| Base44 parity drift risk | нисък | нисък/среден | среден |
| Testability | средна | висока | висока |
| Rollback complexity | ниска | bounded | по-висока |
| Future maintainability | средна | висока | средна |

## 20. Recommended architecture

Препоръката е **Option B — trusted root dispatcher + target-specific config
module, с wrapper-controlled native config loading**.

Това е минималното решение, което едновременно:

- запазва `vite.config.js` като approved entry;
- държи target authority в Node wrapper/descriptor;
- изолира Base44 bare import в Base44-specific module;
- избягва доказаното default-bundler pre-resolution поведение;
- не приема caller `--config` или `--configLoader`;
- запазва exact Base44 options/order;
- не изисква package/lockfile промяна;
- не засяга runtime provider/auth architecture.

Това е planning recommendation, не предварителен PASS за implementation.

## 21. Exact proposed implementation scope

Предложен Wave 10.6.10 scope:

1. `vite.config.js` — async trusted dispatcher: resolve descriptor и binding
   преди fixed dynamic import на Base44-specific plugin-set module; compose
   returned Base44 plugins before `react()`.
2. Нов `build/vite/base44PluginSet.js` (точното име подлежи на implementation
   review) — единствен owner на `@base44/vite-plugin` import, exact current
   options и factory call.
3. `scripts/run-vite.mjs` — добавя само wrapper-generated fixed
   `--configLoader native`; caller-provided arguments остават забранени и
   `--config` не се приема.
4. Нов bounded config/plugin-set test файл — static boundary, native config
   execution markers, rejected-target import/factory exclusion и Base44
   options/order parity.
5. `package.json` само ако е нужен explicit test command; без dependency
   промяна. `package-lock.json` остава непроменен.
6. Wave 10.6.10 implementation report.

Не се добавя selectable non-Base44 target. `private-offline-future` остава
non-selectable. Test fixtures могат да доказват loader boundary чрез injected
fake modules в unique OS temp root, но не трябва да създават production
alternate target contract.

## 22. Explicitly unchanged contracts/files

В предложената implementation wave остават непроменени:

- `src/main.jsx`, descriptor registry/target names и runtime profiles;
- provider selection/bootstrap, Base44 adapter/client и backend facade;
- auth facade, AuthContext и `src/App.jsx`;
- app-parameters/environment-profile behavior;
- Base44 config, backend functions, entities, RLS, datastore/data;
- dependencies, `package-lock.json` и installed package versions;
- wrapper command allow-list и zero-caller-argument contract;
- L3/L4 status.

## 23. Proposed test strategy

### Static analysis

- root/neutral config няма static `@base44/vite-plugin` import;
- Base44 bare import съществува точно в Base44-specific module;
- neutral/shared modules не import-ват Base44-specific source;
- target modules имат еднопосочна dependency посока;
- config selection не чете `VITE_*`, URL или browser state.

### Config execution

- native loader е active и root dispatcher resolve-ва target първо;
- `base44-cloud` достига точно един Base44 module marker и factory marker;
- missing/unknown/`private-offline-future` fail-closed преди markers;
- няма fallback;
- Base44 plugin names/order и options са exact.

### Wrapper regression

- само `dev`, `build`, `preview` са позволени;
- caller arguments и caller `--config`/`--configLoader` остават rejected;
- wrapper-generated native-loader argv е exact и не съдържа caller data;
- target assignment е преди Vite import;
- rejected input не mutates target и не import-ва Vite.

### Base44 parity

- текущите wrapper/descriptor tests остават PASS;
- production build минава през normal wrapper path;
- resolved plugin order/options са compared structurally, не само чрез
  strings;
- module count и generated assets се записват като parity evidence;
- dev/preview config load се smoke-test-ва без remote deployment.

### Exclusion evidence

- fake Base44 module marker доказва import boundary;
- отделен factory marker доказва invocation boundary;
- Vite `loadConfigFromFile`/native execution dependency evidence доказва
  active config graph;
- temp fixture без installed Base44 package доказва, че rejected/non-selected
  path не resolve-ва package;
- static graph check допълва, но не заменя execution evidence.

## 24. Test-integrity requirements

- Fixtures използват `mkdtemp` под OS temp, никога repository
  `node_modules` или `dist`.
- Cleanup target е exact returned temp root; няма broad delete/glob.
- Marker се пише единствено от реално imported fake module/factory.
- Valid case изисква zero exit и exact marker payload.
- Rejected case изисква non-zero exit, exact code и липсващи import/factory
  markers.
- Spawn/import/parse failure не може да мине само като „marker липсва“.
- Tests не четат или отпечатват secrets/environment dumps.
- Source string search не е единствено exclusion доказателство.

## 25. Security invariants

Бъдещата implementation трябва да запази:

- trusted target само от approved Node boundary;
- caller environment override без authority;
- нула caller Vite arguments;
- никакъв browser/`VITE_*`/URL/storage/cookie target selection;
- unknown/missing/non-selectable target fail-closed;
- никакъв Base44 fallback;
- safe errors без hostile input, env/config/secret dump;
- един provider loader/client/auth context;
- нула auth, tenant, backend, RLS, entity или data промени;
- build plugin separation да не се представя като runtime portability.

## 26. L3/L4 boundary

Текущият scope е L2/build portability: trusted selection и изолиране на
build-time plugin config graph.

L3 би изисквал реален selectable non-Base44 build и emitted source/chunk/HTML
proof за липса на Base44 SDK, adapter/client/AuthContext и injections.

L4 би изисквал работещ provider-independent frontend runtime, alternate auth,
app-parameters и provider implementation без Base44 runtime dependency.

Затова L3/L4 остават **NOT IMPLEMENTED / NOT VERIFIED**. Alternate backend,
offline datastore, auth replacement, migrations, sync, tenant/RLS replacement
и deployment не трябва да се включват в plugin-set wave.

## 27. Rollback design

Bounded rollback за Wave 10.6.10:

1. връщане на `vite.config.js` към текущия single-module config;
2. премахване на Base44-specific plugin-set module;
3. премахване на wrapper-generated native-loader argv;
4. премахване на новите config tests/report и евентуален test script.

Не се изисква dependency, lockfile, provider, auth, backend или data rollback.
Rollback възстановява static-import coupling и следователно не е security
closure; той е само bounded recovery при Base44 regression.

## 28. Residual risks and UNKNOWN items

- Remote Base44 build — **UNKNOWN / NOT EXECUTED**.
- Linux wrapper/native config execution — **UNKNOWN / NOT EXECUTED**.
- Live dev/Preview/auth smoke — **UNKNOWN / NOT EXECUTED**.
- Native-loader behavior за всички Base44-managed remote environments —
  **UNKNOWN** до implementation/remote evidence.
- Canonical production name и authority UX за future non-Base44 target —
  **UNKNOWN / Decision Gate**.
- Active non-Base44 config/browser build — **NOT IMPLEMENTED**.
- Physical dependency/install and lockfile exclusion — **OUT OF SCOPE**.
- L3/L4 — **NOT IMPLEMENTED / NOT VERIFIED**.
- Base44 plugin helper top-level behavior beyond inspected published source
  трябва да се re-audit при package-version промяна.
- Existing Browserslist-data and chunk-size warnings остават.

Няма blocking UNKNOWN за bounded separation skeleton; UNKNOWN items за реален
non-Base44 target остават извън Wave 10.6.10.

## 29. Implementation-wave decomposition

### Proposed Wave 10.6.10 — Plugin-Set Separation Implementation

Само bounded dispatcher/module/native-loader separation, tests и report,
както е описано в section 21. Без selectable non-Base44 target, package
removal, provider/auth/runtime промени или L3/L4.

Required checks: static/import graph tests, native config marker tests,
wrapper regressions, descriptor tests, resolved Base44 plugin options/order,
`npm run build`, module count, `git diff --check`, exact scope audit и rollback
record.

### Proposed Wave 10.6.11 — Independent Closure Evaluation

Verification-only: exact diff, default/native config graph, authority,
import/factory markers, Base44 parity, wrapper security, build and Decision
A/B/C. При дефект избира B/C и документира; не поправя implementation.

Нито една от двете waves не започва автоматично L3/L4 или real non-Base44
implementation.

## 30. Planning decision P-A/P-B/P-C

**P-A — READY FOR BOUNDED IMPLEMENTATION.**

Основания:

- current import/config graph е изяснен до exact importer/package/factory;
- Vite bundled-loader pre-resolution рискът е доказан от local Vite source;
- препоръчаната B + native-loader архитектура е конкретна;
- implementation file/scope и rollback са bounded;
- import и factory exclusion могат да бъдат доказани с independent markers и
  config graph evidence;
- Base44 parity boundary е exact;
- няма blocking UNKNOWN за separation skeleton.

P-A не одобрява real non-Base44 target, dependency removal, L3 или L4.

## 31. Next Decision Gate — REQUIRES EXPLICIT APPROVAL

Само предложение: **Wave 10.6.10 — Plugin-Set Separation Implementation** с
exact bounded scope от section 21.

**REQUIRES EXPLICIT APPROVAL.** Тази planning wave не стартира
implementation, test-harness files, target activation или следваща closure
wave.

## 32. Final Result

Wave 10.6.9 завършва с **P-A — READY FOR BOUNDED IMPLEMENTATION**.

- Current architecture discovery — PASS.
- Trusted wrapper/descriptor authority — PASS.
- Static Base44 import/package exclusion — NOT IMPLEMENTED.
- Option A alone — insufficient за package-resolution exclusion.
- Recommended architecture — Option B trusted dispatcher + Base44-specific
  module + wrapper-controlled native config loading.
- Wrapper tests — PASS 4/4.
- Descriptor tests — PASS 9/9.
- Production build — PASS, Vite 6.4.3, 1959 modules, 11.63 s.
- Base44 parity baseline — PASS / LOCAL BUILD, BOUNDED.
- Remote Base44/Linux/live Preview-auth — UNKNOWN / NOT EXECUTED.
- Non-Base44 build — NOT IMPLEMENTED.
- L3/L4 — NOT IMPLEMENTED / NOT VERIFIED.

Няма implementation, test, config, package, lockfile, provider, auth,
backend, entity, RLS или data промяна. Няма commit, push, merge, rebase или
force push. Wave 10.6 остава IN PROGRESS; Phase 10 остава NOT COMPLETE / NOT
FROZEN.
