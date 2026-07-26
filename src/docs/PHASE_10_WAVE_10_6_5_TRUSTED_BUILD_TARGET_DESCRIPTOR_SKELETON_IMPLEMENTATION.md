# Phase 10 — Wave 10.6.5 Trusted Build-Target Descriptor Skeleton Implementation

## Статус

Phase 10 — IMPLEMENTATION. Wave 10.5 — COMPLETE. Wave 10.6.1 — PLANNING COMPLETE. Wave 10.6.2 — IMPLEMENTED AND VERIFIED, BOUNDED. Wave 10.6.3 — VERIFIED AND CLOSED, BOUNDED. Wave 10.6.4 — PLANNING COMPLETE. Wave 10.6.5 — IMPLEMENTATION COMPLETE, BOUNDED; очаква независима проверка.

Trusted build-target descriptor skeleton — IMPLEMENTED за точно един selectable target: `base44-cloud`. `private-offline-future` — KNOWN, NOT_IMPLEMENTED и non-selectable. L2 backend-path isolation — PRESERVED. L3 bundle exclusion — NOT IMPLEMENTED. L4 frontend independence — NOT IMPLEMENTED. Wave 10.6 — IN PROGRESS. Phase 10 — NOT COMPLETE и NOT FROZEN.

## Bounded scope

Имплементирани са pure immutable descriptor registry/resolver, trusted Node-only build-command input, fail-closed Vite config resolution преди Base44 plugin factory invocation, required-binding assertions и runtime-profile compatibility check преди provider bootstrap. Добавени са малки deterministic tests с built-in `node:test`.

Не са имплементирани alternate provider, private/offline build, alternate auth, небазов plugin set, plugin exclusion, втори React context, втори Base44 client или Wave 10.6.6. Не са променяни Base44 plugin package source, `src/App.jsx`, `src/lib/AuthContext.jsx`, auth facade, provider loader/client/adapter, environment-profile resolver, app-parameters behavior, backend functions, entities, RLS или persistent data.

## Inspected source

Преди имплементацията са проверени:

- Branch `codex/phase-10-current` и чисто работно дърво.
- `README.md`, `package.json`, `package-lock.json`, `base44/config.jsonc`, `vite.config.js`, `jsconfig.json`, `.gitignore` и `eslint.config.js`.
- `src/main.jsx`, `src/App.jsx`, `src/auth/AuthContextFacade.jsx`, `src/lib/AuthContext.jsx`, `src/lib/app-params.js`, `src/lib/environment-profile.js`.
- `src/services/providerSelection.js`, `src/services/providerBootstrap.js`, `src/services/backendAdapter.js`, `src/services/base44Adapter.js`, `src/api/base44Client.js`.
- Wave 10.6.1, 10.6.2, 10.6.3 и 10.6.4 документите.
- Наличният source на `@base44/vite-plugin` 1.0.30, включително plugin factory, `config`, `resolveId`, HTML injection и conditional sub-plugin assembly.
- Текущите `dev`, `build` и `preview` scripts и Base44 `site.serveCommand`/`site.buildCommand`.

Base44 agent skills бяха актуализирани съгласно `AGENTS.md`; генерираните `.agents/` и `skills-lock.json` бяха премахнати веднага след прочит, защото са извън bounded product diff.

## Файлови промени

### Създадени

- `src/build/buildTargetDescriptor.js` — pure descriptor contract, registry, resolver, validators и compatibility assertions.
- `scripts/run-vite.mjs` — cross-platform Node wrapper, който задава trusted `PGP_BUILD_TARGET=base44-cloud` преди Vite config loading.
- `tests/buildTargetDescriptor.test.js` — 9 deterministic Node tests.
- `src/docs/PHASE_10_WAVE_10_6_5_TRUSTED_BUILD_TARGET_DESCRIPTOR_SKELETON_IMPLEMENTATION.md` — този отчет.

### Променени

- `vite.config.js` — разрешава и валидира target/bindings преди `base44(...)`; текущите Base44 plugin options са непроменени.
- `src/main.jsx` — валидира runtime profile спрямо Base44 target descriptor преди `bootstrapProvider`.
- `package.json` — `dev`/`build`/`preview` минават през cross-platform wrapper; добавен е `test:build-target`.

### Непроменени

`package-lock.json`, dependency versions, `base44/config.jsonc`, `src/App.jsx`, auth/provider/app-parameters/environment-profile implementations и всички backend/data/security файлове.

## Descriptor schema и registry

Именуваният contract е `BuildTargetDescriptor`. Registry е `BUILD_TARGET_DESCRIPTORS`, създаден върху object с null prototype и замразен. Lookup използва `Object.prototype.hasOwnProperty.call`, така че `__proto__`, `constructor`, `toString` и други inherited/prototype-like имена не могат да бъдат target.

Descriptor shape:

```js
{
  id,
  implementationStatus,
  selectable,
  permittedRuntimeProfiles,
  permittedProviderFamilies,
  bindings: {
    vitePlugin,
    providerLoader,
    auth,
    appParameters,
    bootstrap
  }
}
```

Top-level descriptor, registry, масивите и `bindings` object са recursively immutable. Няма wildcard, inheritance, object merge, filesystem path binding или fallback.

`base44-cloud`:

- `IMPLEMENTED`, `selectable: true`;
- profiles: точно `base44-cloud`, `local-development`;
- provider families: точно `base44`;
- именувани bindings за текущите Base44 Vite plugin, provider loader, auth facade, app-parameters и entry bootstrap.

`private-offline-future`:

- `NOT_IMPLEMENTED`, `selectable: false`;
- няма permitted profiles/provider families;
- всички implementation bindings са `null`;
- resolver винаги връща `PGP_BUILD_TARGET_NOT_IMPLEMENTED`;
- не активира Base44 fallback.

## Trusted input и build-command path

Authority е non-`VITE_*` process input `PGP_BUILD_TARGET`, четен единствено в `vite.config.js`. Той не се чете от browser code и не се предава чрез `define`, `import.meta.env`, generated HTML или runtime configuration.

`scripts/run-vite.mjs` фиксира `PGP_BUILD_TARGET=base44-cloud` преди dynamic import на Vite CLI. Wrapper използва Node и еднакъв source на Windows/Linux; не е добавен `cross-env` или друга dependency.

Официалните project commands са:

- `npm run dev` → `node scripts/run-vite.mjs dev`;
- `npm run build` → `node scripts/run-vite.mjs build`;
- `npm run preview` → `node scripts/run-vite.mjs preview`.

`base44/config.jsonc` продължава да използва `npm run dev` и `npm run build`, следователно конфигурираният Base44 serve/build path задава target изрично. Няма implicit resolver/config default. Директно стартиране на Vite без trusted input fail-closed.

## Стабилни fail-closed кодове

| Код | Условие |
|---|---|
| `PGP_BUILD_TARGET_MISSING` | Липсващ, `null`, празен или whitespace-only target |
| `PGP_BUILD_TARGET_INVALID_TYPE` | Non-string target |
| `PGP_BUILD_TARGET_UNKNOWN` | String извън own-key allow-list |
| `PGP_BUILD_TARGET_NOT_IMPLEMENTED` | Известен non-selectable placeholder |
| `PGP_BUILD_TARGET_INVALID_DESCRIPTOR` | Невалиден shape, status/selectability, immutability или placeholder binding |
| `PGP_BUILD_TARGET_BINDING_MISSING` | Липсващ required binding |
| `PGP_BUILD_TARGET_BINDING_INCOMPATIBLE` | Binding identifier не съвпада с текущата implementation |
| `PGP_BUILD_TARGET_PROFILE_INCOMPATIBLE` | Runtime profile не е allow-listed за descriptor |

Грешките не dump-ват `process.env`, config object, token, appId или credentials. Target label се допуска само при ограничен безопасен character set и максимална дължина; иначе се заменя с `<invalid>`.

## Vite integration order

Редът в `vite.config.js` е:

1. прочит на `process.env.PGP_BUILD_TARGET`;
2. `resolveBuildTargetDescriptor`;
3. assertions за петте required Base44 bindings;
4. `defineConfig`;
5. Base44 plugin factory invocation `base44({...})`;
6. React plugin construction.

Така missing, unknown, not-implemented или incompatible target спира config evaluation преди Base44 plugin factory invocation и plugin array construction. Static package import остава част от Base44-only config module; plugin factory не се извиква преди успешна resolution. Небазов plugin set и plugin exclusion не са имплементирани.

Текущите Base44 plugin options остават без промяна: `legacySDKImports`, `hmrNotifier`, `navigationNotifier`, `analyticsTracker` и `visualEditAgent` имат същите стойности/източници.

## Runtime-profile compatibility

`src/main.jsx` използва същия immutable registry и фиксирания единствен implemented browser binding `base44-cloud`. След `resolveActiveProfile` в текущия `appParams` path, но преди `bootstrapProvider`, `assertRuntimeProfileCompatible` допуска само:

- `base44-cloud`;
- `local-development`.

Няма нов profile, coercion, fallback, duplicate profile resolver, duplicate provider loader или duplicate client. Несъвместим profile спира startup с `PGP_BUILD_TARGET_PROFILE_INCOMPATIBLE` преди provider construction.

## Тестови доказателства

`npm run test:build-target` — PASS:

- tests: 9;
- pass: 9;
- fail: 0;
- resolution на `base44-cloud`;
- recursive immutability;
- own-key защита за `__proto__`, `constructor`, `toString`;
- missing/empty target;
- non-string target;
- unknown target;
- `private-offline-future` като NOT_IMPLEMENTED;
- descriptor shape и binding validation;
- точните два permitted profiles и incompatible-profile rejection;
- няма fallback.

Отделна Vite config import проверка:

- missing target → exit 1 и `PGP_BUILD_TARGET_MISSING`;
- `unknown-target` → exit 1 и `PGP_BUILD_TARGET_UNKNOWN`;
- `private-offline-future` → exit 1 и `PGP_BUILD_TARGET_NOT_IMPLEMENTED`.

## Build и Base44 parity

`npm run build` — PASS през официалния Base44-configured command path:

- wrapper: `node scripts/run-vite.mjs build`;
- Vite: 6.4.3;
- transformed modules: 1959;
- production output generated successfully;
- Base44 adapter lazy chunk е генериран, което е очаквано за текущия Base44 target;
- warning: съществуващият `App` chunk остава над 500 kB; build не е неуспешен.

Генерираният `dist/` беше премахнат след проверката и не участва в diff. `npm ci` не беше необходим: наличният dependency state изпълни tests и production build успешно, а `package-lock.json` не е променен.

Base44 behavioral parity е подкрепена от непроменени plugin options, provider loader/client, auth implementation/facade, app-parameters и успешно production build. Live Preview/runtime smoke test не е изпълнен, затова пълна runtime parity не се обявява като независимо доказана.

Допълнителни project checks:

- `npm run typecheck` — FAIL по съществуващи несвързани JSX/UI typing проблеми и предишни `Error.code` typing места; новите build-target файлове не са посочени от output.
- `npm run lint` — FAIL по три съществуващи unused imports в `FailedDeliveriesPage.jsx`, `SecurityCenterPage.jsx` и `WorkflowInstanceDetailPage.jsx`.
- Не е изпълняван auto-fix и тези файлове не са променяни.

## Security invariants

- Auth, authorization, tenant и RLS промени: 0.
- Datastore/entity/persistent-data промени: 0.
- Secrets, credentials, token/appId стойности и environment dump: 0.
- Browser-controlled build authority: 0.
- Silent provider fallback: 0.
- Нов provider/auth implementation: 0.
- Допълнителен React context: 0.
- Допълнителен Base44 client/loader: 0.
- Base44 package source и dependency versions: непроменени.
- `App.jsx` platform-enforced exception и React context identity: непроменени.

## L3/L4 classification

L3 — NOT IMPLEMENTED и NOT VERIFIED. Тази вълна не изгражда небазов target, не изключва Base44 plugin/package/source graph и не предоставя emitted-build exclusion proof.

L4 — NOT IMPLEMENTED и NOT VERIFIED. Base44 SDK, adapter/client, AuthContext implementation, app-parameters semantics, plugin injections и Base44-specific browser surfaces остават в текущата Base44 цел.

Успешният Base44 build не е L3 или L4 PASS.

## Rollback

Bounded rollback:

1. Връщане на `dev`, `build`, `preview` scripts и премахване на `test:build-target` от `package.json`.
2. Връщане на `vite.config.js` към предишния direct config без descriptor resolution/binding assertions.
3. Премахване на runtime compatibility import/assertion от `src/main.jsx`.
4. Изтриване на `src/build/buildTargetDescriptor.js`.
5. Изтриване на `scripts/run-vite.mjs`.
6. Изтриване на `tests/buildTargetDescriptor.test.js`.
7. Изтриване на този Wave 10.6.5 документ.

Не се изисква rollback на lockfile, dependencies, auth/provider files, backend functions, entities, RLS или data.

## Residual risks и UNKNOWN

- Remote Base44 platform behavior извън checked-in `base44/config.jsonc` остава UNKNOWN; конфигурацията доказва `npm run dev/build` path, но няма изпълнен remote platform build.
- Node wrapper използва локалния standard Vite CLI path под `node_modules`; доказан е на текущия Windows environment и е path-compatible с Linux, но Linux execution не е изпълнен в тази вълна.
- Browser startup използва статичния единствен implemented target binding; бъдещ втори selectable target ще изисква отделен compile-time runtime binding механизъм, без browser authority.
- Base44 plugin static import се зарежда като Node module преди resolver execution, но factory invocation/plugin construction е след успешна resolution. Пълно package import exclusion за небазов config е бъдеща вълна.
- Plugin exclusion, resolved plugin-list instrumentation, non-Base44 emitted graph и generated HTML negative proof не са изпълнени.
- Live dev server, Preview, auth/login/logout и owner smoke tests не са изпълнени.
- Typecheck и lint имат несвързани baseline failures; не са коригирани поради bounded scope.

## Next Decision Gate

Предложена следваща bounded wave:

**Wave 10.6.6 — Trusted Build-Target Descriptor Skeleton Verification and Closure Evaluation.**

Scope: независима проверка на descriptor/resolver, trusted command path, fail-closed Vite ordering, runtime-profile compatibility, exact source diff, Base44 build parity и security invariants; correction/closure decision без alternate provider, небазов build или L3/L4 claim.

**REQUIRES EXPLICIT APPROVAL.** Wave 10.6.6 не е започната в тази вълна.

## Final Result

Wave 10.6.5 trusted build-target descriptor skeleton implementation е complete, bounded и готова за независим преглед. Единственият selectable target е `base44-cloud`; `private-offline-future` е известен, non-selectable и fail-closed. Trusted authority е Node-only `PGP_BUILD_TARGET`; Vite resolution и required bindings се валидират преди Base44 plugin factory invocation; текущите два runtime profiles се валидират преди provider bootstrap. L3/L4 остават NOT IMPLEMENTED. Wave 10.6 остава IN PROGRESS. Phase 10 остава NOT COMPLETE и NOT FROZEN.
