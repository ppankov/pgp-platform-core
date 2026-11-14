# Phase 10 — Wave 10.6.10 Vite Plugin-Set Separation Implementation

## 1. Status

Wave 10.6.10 — **IMPLEMENTED AND VERIFIED, BOUNDED**.

Implementation decision: **A — IMPLEMENTED AND VERIFIED, BOUNDED**.

Това не е независима closure evaluation. Wave 10.6 остава **IN PROGRESS**.
Phase 10 остава **NOT COMPLETE / NOT FROZEN**.

## 2. Scope

Имплементиран е само одобреният Vite plugin-set separation skeleton:

- trusted async dispatcher в `vite.config.js`;
- отделен Base44-specific plugin-set module;
- wrapper-generated fixed `--configLoader native`;
- разширени wrapper regressions;
- един bounded native config/import/factory test файл;
- този implementation report.

Не е добавен selectable non-Base44 target.

## 3. Explicit non-goals

Следните остават **OUT OF SCOPE / NOT IMPLEMENTED**:

- работещ non-Base44/private-offline build;
- промяна на descriptor registry, IDs или selectability;
- alternate provider/client/auth context или runtime;
- Base44 SDK/runtime exclusion;
- dependency removal или lockfile rewrite;
- L3/L4 implementation или verification;
- backend, entity, RLS, tenant, datastore или deployment промяна.

## 4. Starting Git state

- Branch: `codex/phase-10-current` — PASS.
- Initial HEAD: `d138dfc3620c67913bfc40c24654e78e18788375` — PASS.
- Upstream HEAD: същият SHA — PASS.
- Ahead/behind: `0 / 0` — PASS.
- Initial working tree: clean — PASS.
- Initial index: clean — PASS.

## 5. Planning baseline

Wave 10.6.9 завърши с **P-A — READY FOR BOUNDED IMPLEMENTATION** и избра
Option B: trusted root dispatcher, Base44-specific config module и
wrapper-controlled native config loading.

Локалният Vite 6.4.3 source потвърждава, че default bundled config loader
resolve-ва bare dynamic imports при bundling, докато native loader import-ва
root config като Node ESM. Това е причината native loader да бъде част от
security boundary, а не само performance/config preference.

## 6. Exact changed files

Променени:

- `vite.config.js`;
- `scripts/run-vite.mjs`;
- `tests/runVite.test.js`.

Създадени:

- `build/vite/base44PluginSet.js`;
- `tests/vitePluginSet.test.js`;
- `src/docs/PHASE_10_WAVE_10_6_10_VITE_PLUGIN_SET_SEPARATION_IMPLEMENTATION.md`.

`package.json` не е променен, защото новият test се изпълнява директно чрез
`node --test`. `package-lock.json` е непроменен.

## 7. Previous architecture

`vite.config.js` статично import-ваше `@base44/vite-plugin`. По ESM ordering
package resolution/module evaluation се случваха преди descriptor body.
Descriptor assertions gate-ваха factory invocation, но не Base44 package
import/config graph.

Wrapper-ът стартираше Vite с default bundled config loader.

## 8. Implemented architecture

Текущият flow е:

1. wrapper validate-ва command и zero caller arguments;
2. wrapper фиксира `PGP_BUILD_TARGET=base44-cloud`;
3. wrapper стартира Vite с constant `--configLoader native`;
4. native loader import-ва root `vite.config.js` като ESM;
5. async dispatcher resolve-ва descriptor и петте bindings;
6. едва след това изпълнява fixed literal dynamic import на
   `./build/vite/base44PluginSet.js`;
7. Base44-specific module import-ва package и извиква factory;
8. dispatcher flatten-ва Base44-returned plugins преди `react()`.

Няма успешен non-Base44 branch и няма fallback.

## 9. Trusted dispatcher implementation

`vite.config.js` export-ва `defineConfig(async () => ...)`.

Преди dynamic import се изпълняват:

- `resolveBuildTargetDescriptor(process.env.PGP_BUILD_TARGET)`;
- exact assertions за `vitePlugin`, `providerLoader`, `auth`,
  `appParameters`, `bootstrap`.

Dynamic import specifier е fixed source literal. Не се конструира от target,
environment, descriptor binding, caller argument или browser input.

Root config няма static import на `@base44/vite-plugin`.

## 10. Base44-specific module

`build/vite/base44PluginSet.js` е извън browser `src/` graph и е единственият
executable repository importer на `@base44/vite-plugin`.

Той export-ва единствено `createBase44PluginSet()` и запазва exact factory
options:

- `legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true'`;
- `hmrNotifier: true`;
- `navigationNotifier: true`;
- `analyticsTracker: true`;
- `visualEditAgent: true`.

React plugin не е преместен в Base44-specific module.

## 11. Wrapper native-loader implementation

Wrapper command registry и own-property validation са непроменени.

Добавен е immutable internal constant:

`["--configLoader", "native"]`.

Той се добавя само след fixed command arguments. Caller arguments остават
напълно забранени. Caller `--config`, `-c`, `--configLoader` и всички други
flags fail-closed преди target mutation и Vite import.

## 12. Exact Vite argv

Логическите argv след wrapper rewrite са:

- `dev`: `[node, "vite", "--configLoader", "native"]`;
- `build`: `[node, "vite", "build", "--configLoader", "native"]`;
- `preview`: `[node, "vite", "preview", "--configLoader", "native"]`.

Първият element е реалният existing `process.argv[0]`; caller data не участва
в generated loader arguments.

## 13. Import-boundary evidence

**PASS / STATIC + NATIVE EXECUTION.**

- Root config няма static Base44 package import.
- Fixed dynamic module specifier е asserted.
- Bounded repository scan намира един executable importer:
  `build/vite/base44PluginSet.js`.
- Native temp fixture без `@base44/vite-plugin` package изпълнява missing,
  unknown и non-selectable target rejection с exact descriptor codes.
- Import marker остава absent във всички rejected cases.
- Valid Base44 case създава import marker точно веднъж.

Това доказва separation skeleton boundary; не доказва active non-Base44
application build, който остава NOT IMPLEMENTED.

## 14. Factory-boundary evidence

**PASS / NATIVE EXECUTION.**

- Missing target → `PGP_BUILD_TARGET_MISSING`, factory marker absent.
- Unknown target → `PGP_BUILD_TARGET_UNKNOWN`, factory marker absent.
- `private-offline-future` → `PGP_BUILD_TARGET_NOT_IMPLEMENTED`, factory
  marker absent.
- Valid `base44-cloud` → factory marker точно веднъж.
- Marker payload доказва exact five options и values.
- Config result доказва order:
  `base44`, `html-injections`, `vite:react` в fixture representation.

## 15. Test-fixture integrity

`tests/vitePluginSet.test.js` използва `mkdtemp` под OS temp и копира само
нужните config/descriptor modules. Fake packages живеят само във fixture
`node_modules`; repository `node_modules` и `dist` не се променят.

Import и factory markers са отделни. Valid case изисква successful config
result, exact marker count/payload и plugin order. Rejected cases изискват
exact error code и липсващи markers. Липсата на marker сама по себе си не е
PASS. Cleanup премахва само exact `fixtureRoot` в `finally`.

Тестът не използва реални credentials, tokens, appId или secrets.

Tested `BASE44_LEGACY_SDK_IMPORTS=true`: the factory receives `legacySDKImports: true`.
The importer scan covers `.jsx`, `.ts` and `.tsx` alongside JS files.
It is regex-based and is not a full JavaScript/TypeScript parser.

## 16. Wrapper regression evidence

`node --test tests/runVite.test.js` — **PASS**:

- tests: 4;
- pass: 4;
- fail: 0;
- duration: 2743.6377 ms.

Покрити са valid `dev`/`build`/`preview`, exact native-loader argv,
unsupported/prototype-like commands, config/mode/positional/unknown flags,
caller `--configLoader` variants, bare `--`, arguments след dev/preview,
target override и no-Vite marker при rejection.

Preload exit observer доказва, че rejected input оставя caller target
`unknown-target`, а valid input го заменя с `base44-cloud`.

Първоначалният test run откри Windows fixture defect: raw `C:\...` path към
Node `--import` се интерпретира като unsupported URL scheme. Корекцията е
bounded в test file: `pathToFileURL(...).href`. След корекцията suite-ът е
PASS 4/4. Production wrapper не беше засегнат от дефекта.

## 17. Descriptor regression evidence

`npm run test:build-target` — **PASS**:

- tests: 9;
- pass: 9;
- fail: 0;
- duration: 233.4542 ms.

Descriptor registry, IDs, selectability, bindings и runtime profiles не са
променени.

## 18. Native-loader compatibility

**PASS / LOCAL WINDOWS + VITE 6.4.3.**

- CLI приема wrapper-generated `--configLoader native`.
- Current `.js` ESM config се зарежда без extension/package migration.
- Async config export се изпълнява.
- Fixed dynamic import се изпълнява след descriptor validation.
- Native fixture без Base44 package отхвърля invalid targets преди package
  resolution.
- Real build, dev и preview paths зареждат config успешно.
- Не е нужен нов dependency или caller-controlled config path.

Linux и remote Base44 execution са UNKNOWN / NOT EXECUTED.

## 19. Dev smoke evidence

Bounded `dev` smoke — **PASS**:

- Vite 6.4.3;
- successful config/server load;
- ready за 1223 ms;
- `Local: http://localhost:5173/`;
- exact spawned Node process е прекратен след evidence;
- няма оставен listener/process.

Това не е live application/auth smoke.

## 20. Preview smoke evidence

Bounded `preview` smoke — **PASS**:

- successful native config/preview server load;
- `Local: http://localhost:4173/`;
- exact spawned Node process е прекратен след evidence;
- няма оставен listener/process.

Това не е interactive Preview/auth verification.

## 21. Production-build evidence

`npm run build` — **PASS**:

- Vite: 6.4.3;
- transformed modules: 1959;
- Vite build duration: 11.12 s;
- command wall time: 13.705 s;
- assets: `index.html`, CSS, `base44Adapter` chunk, index chunk и App chunk;
- Base44 adapter chunk: 111.78 kB;
- App chunk: 514.59 kB;
- existing warnings: caniuse-lite data е 6 months old и App chunk е над
  500 kB.

Module count е parity evidence, не security proof. `dist/` е ignored и извън
Git diff.

## 22. Base44 options/order parity

**PASS / SOURCE + MARKER + BUILD.**

- Package остава `@base44/vite-plugin` 1.0.30.
- Five options и values са exact и independently asserted.
- Base44 factory се извиква точно веднъж за valid target.
- Base44-returned array се spread-ва в original order преди `react()`.
- Base44 `@/` alias остава предоставен от същия plugin config hook.
- Production module count и assets съвпадат с baseline.

Remote Base44 parity е UNKNOWN / NOT EXECUTED.

## 23. Provider/auth/runtime parity

**PASS / STATIC BOUNDED.**

`src/main.jsx`, provider selection/bootstrap, `base44Adapter.js`,
`base44Client.js`, auth facade/AuthContext и app-parameters source са
непроменени.

Bounded scan намира един frontend `createClient` location:
`src/services/base44Adapter.js`. Не е добавен втори provider, client или auth
context.

Live runtime/auth parity е UNKNOWN / NOT EXECUTED.

## 24. Security invariants

**PASS / BOUNDED.**

- Trusted target остава wrapper-controlled Node constant.
- Caller environment target override няма authority.
- Caller Vite arguments остават забранени.
- Generated native-loader arguments са constants.
- Browser/URL/storage/cookie/`VITE_*` не избират plugin set.
- Missing/unknown/non-selectable target fail-closed преди Base44 import и
  factory.
- Няма Base44 fallback.
- Hostile caller argument не се echo-ва.
- Environment/config/secrets не се dump-ват.
- Няма provider/auth/backend/RLS/entity/data промяна.
- Skeleton не се представя като working non-Base44 build или L3/L4.

## 25. Package/lockfile assessment

`package.json`, dependency declarations/versions и `package-lock.json` са
непроменени. Не е изпълнявана dependency installation.

Base44 plugin остава production dependency `^1.0.30`, locked at 1.0.30.
Physical installation exclusion и lockfile removal са OUT OF SCOPE.

## 26. L3/L4 classification

- L3 — **NOT IMPLEMENTED / NOT VERIFIED**.
- L4 — **NOT IMPLEMENTED / NOT VERIFIED**.
- Selectable non-Base44 target — **NOT IMPLEMENTED**.
- Active non-Base44 emitted bundle exclusion — **NOT IMPLEMENTED**.
- Physical Base44 dependency exclusion — **OUT OF SCOPE**.

Plugin config import separation не е пълна runtime portability.

## 27. Source/report consistency

**PASS.** Report claims съответстват на source и executed evidence:

- exact importer path и fixed dynamic specifier;
- wrapper argv и zero-caller-argument ordering;
- exact Base44 options/order;
- test counts и marker semantics;
- Vite version/module count/build duration;
- unchanged descriptor/provider/auth/package contracts;
- remote/Linux/live и L3/L4 ограниченията не са overclaimed.

## 28. Rollback

Bounded rollback:

1. връщане на `vite.config.js` към single-module static Base44 config;
2. премахване на `build/vite/base44PluginSet.js`;
3. премахване на wrapper native-loader arguments;
4. връщане на wrapper tests и премахване на config test/report.

Не се изисква dependency, lockfile, provider, auth, backend или data rollback.
Rollback би възстановил static-import coupling и не е security closure.

## 29. Residual risks/UNKNOWN

- Remote Base44 build/native-loader behavior — **UNKNOWN / NOT EXECUTED**.
- Linux wrapper/native-loader execution — **UNKNOWN / NOT EXECUTED**.
- Live interactive Preview/auth smoke — **UNKNOWN / NOT EXECUTED**.
- Canonical/selectable non-Base44 target — **NOT IMPLEMENTED**.
- Active non-Base44 application build/exclusion — **NOT IMPLEMENTED**.
- Physical dependency/lockfile exclusion — **OUT OF SCOPE**.
- L3/L4 — **NOT IMPLEMENTED / NOT VERIFIED**.
- Existing caniuse-lite freshness и chunk-size warnings остават.

## 30. Decision A/B/C

**A — IMPLEMENTED AND VERIFIED, BOUNDED.**

Trusted dispatcher и native loader работят; Base44 package import/factory
boundary е отделена; marker tests са reliable; wrapper/descriptor regressions
и real build/dev/preview paths минават; options/order and runtime boundaries
са запазени; exact diff остава в approved scope.

Няма основание за B или C. Това решение не затваря wave независимо.

## 31. Next Decision Gate — REQUIRES EXPLICIT APPROVAL

Само предложение: **Wave 10.6.11 — Independent Plugin-Set Separation Closure
Evaluation**.

Scope: verification-only exact diff/import/factory/native-loader/authority,
Base44 parity, tests/build и Decision A/B/C. Corrections не се извършват в
closure wave.

**REQUIRES EXPLICIT APPROVAL.** Wave 10.6.11 не е започната.

## 32. Final Result

Wave 10.6.10 завършва с **A — IMPLEMENTED AND VERIFIED, BOUNDED**.

- Trusted async dispatcher — PASS.
- Native config loader — PASS / LOCAL WINDOWS.
- Base44 import boundary — PASS.
- Base44 factory boundary — PASS.
- Config/plugin-set tests — PASS 4/4.
- Wrapper tests — PASS 4/4.
- Descriptor tests — PASS 9/9.
- Dev smoke — PASS.
- Preview smoke — PASS.
- Production build — PASS, Vite 6.4.3, 1959 modules, 11.12 s.
- Base44 parity — PASS / BOUNDED.
- Provider/auth/runtime source parity — PASS / STATIC.
- Package/lockfile — UNCHANGED.
- Remote Base44/Linux/live auth — UNKNOWN / NOT EXECUTED.
- Non-Base44 build — NOT IMPLEMENTED.
- L3/L4 — NOT IMPLEMENTED / NOT VERIFIED.

Няма commit, push, merge, rebase или force push. Wave 10.6 остава IN
PROGRESS; Phase 10 остава NOT COMPLETE / NOT FROZEN.
