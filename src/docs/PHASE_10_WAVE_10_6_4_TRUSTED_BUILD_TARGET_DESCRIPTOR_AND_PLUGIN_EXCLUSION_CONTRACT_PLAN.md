# Phase 10 — Wave 10.6.4 Trusted Build-Target Descriptor and Plugin Exclusion Contract Plan

## 1. Статус и обхват

Phase 10 — IMPLEMENTATION. Wave 10.5 — COMPLETE. Wave 10.6.1 — PLANNING COMPLETE. Wave 10.6.2 — IMPLEMENTED AND VERIFIED, BOUNDED. Wave 10.6.3 — VERIFIED AND CLOSED, BOUNDED. Wave 10.6.4 — PLANNING COMPLETE.

Auth facade покрива 24/25 application consumers; `src/App.jsx` остава platform-enforced exception. React context identity и L2 backend-path isolation са запазени. L3 bundle exclusion — NOT IMPLEMENTED. L4 frontend independence — NOT IMPLEMENTED. Wave 10.6 — IN PROGRESS. Phase 10 — NOT COMPLETE и NOT FROZEN.

Тази вълна дефинира договор за доверен compile-time build target, immutable descriptor, plugin exclusion, target/profile съвместимост и бъдеща emitted-build проверка. Тя не имплементира build target, небазов provider, private/offline build, auth driver или app-parameters разделяне. Production code, конфигурация, зависимости и по-стари документи не се променят.

## 2. Термини и граници на доверие

| Понятие | Момент на избор | Предназначение | Доверие и ограничения |
|---|---|---|---|
| Trusted compile-time build target | Преди зареждане и изпълнение на `vite.config.js`, Vite plugin resolution и bundle construction | Определя plugin set, source bindings/aliases, provider loader, auth implementation, app-parameters implementation и допустими runtime profiles | Build authority; идва само от доверен build orchestration input, валидиран извън browser bundle |
| Runtime environment profile | При стартиране на приложението; днес чрез `VITE_APP_ENVIRONMENT_PROFILE` и `resolveActiveProfile` | Описва разрешен режим в рамките на вече избран build target | Не е build authority и не може да добавя изключен provider/plugin |
| Browser-visible `VITE_*` стойност | Заместена/експонирана от Vite и достъпна в browser code | Публична runtime/build конфигурация, например app ID, URL и profile label | Не е secret и не е доверен избор на source graph, plugin set или build target |

Build target и runtime profile не са взаимозаменяеми. Runtime profile може само да избере разрешен профил в предварително фиксираната от target матрица. Browser-visible стойност не може да променя build target, alias, auth binding, loader registry или plugin participation.

## 3. Източник на доверие за build target

Бъдещият build orchestration трябва да подаде build target чрез именуван non-`VITE_*` compile-time input, например `PGP_BUILD_TARGET`, или чрез еквивалентен CI/CLI аргумент, който:

1. се чете само в Node build/config процеса;
2. се валидира преди извикване на Base44 plugin factory и преди Vite да конструира plugin container;
3. не се сериализира автоматично в browser bundle;
4. не се извлича от URL, query/hash, hostname, cookie, `localStorage`, runtime request, API response, DOM, user input или browser-visible `VITE_*`;
5. не допуска default към Base44 при неизвестна, празна или липсваща стойност, освен ако отделно одобрен build command не фиксира изрично `base44-cloud`;
6. не може да бъде променен след разрешаването на descriptor.

Точният CI secret/non-secret transport и build-command UX са бъдещо implementation решение. Build target сам по себе си не е secret, но неговият канал е trust boundary.

## 4. Именуван immutable descriptor contract

Планираното име е `BuildTargetDescriptor`. Registry името е `BUILD_TARGET_DESCRIPTORS`. Descriptor се избира един път чрез `resolveBuildTargetDescriptor(rawTarget)` и се връща като рекурсивно immutable структура. Само `Object.freeze` на горното ниво не е достатъчно; масивите и вложените bindings също трябва да са immutable.

Минималният логически shape е:

```js
{
  id,
  implementationStatus,
  permittedRuntimeProfiles,
  vitePluginContract,
  providerLoaderBinding,
  authBinding,
  appParametersBinding,
  entryBootstrapBinding,
  permittedProviderFamilies
}
```

Правила:

- `id` е allow-listed literal и собствен ключ на registry; не се използва prototype lookup.
- Всеки binding е именуван compile-time identifier, не свободен filesystem path.
- Descriptor не съдържа token, credential, tenant, user, session или друг secret.
- Descriptor не конструира provider client и не чете browser state.
- Няма merge с недоверен object и няма runtime mutation.
- Няма wildcard, implicit inheritance или fallback descriptor.

## 5. Минимална target матрица

| Build target | Статус | Permitted runtime profiles | Vite plugin set | Provider loader | Auth binding | App-parameters binding | Entry/bootstrap | Provider families |
|---|---|---|---|---|---|---|---|---|
| `base44-cloud` | Текуща цел; descriptor още NOT IMPLEMENTED | `base44-cloud`, `local-development` | Base44 plugin с текущите одобрени опции + React plugin | Текущият фиксиран Base44 loader в `providerBootstrap.js` | Текущият `AuthContextFacade`; `App.jsx` директният import остава platform-enforced exception | Текущите Base44 `appId`, `token`, `functionsVersion`, `appBaseUrl` и profile semantics | Текущото `main.jsx`: resolve params → bootstrap provider → dynamic `App.jsx` import | `base44` |
| `private-offline-future` | Placeholder, NOT IMPLEMENTED, non-selectable | Бъдещи изрично одобрени небазови профили; `private-demo` и/или `enterprise-offline-future` са само кандидати | React plugin и provider-neutral alias/config; Base44 plugin напълно отсъства | Бъдещ fixed non-Base44 loader binding | Бъдещ build-target auth alias/driver зад application-owned boundary | Бъдеща provider-neutral/private app-parameters implementation без Base44 token/appId semantics | Бъдещ target-bound bootstrap без Base44 fallback/import edge | Бъдеща изрично именувана non-Base44 family; не `base44` |

Placeholder редът не разрешава build. Докато всички bindings и проверки не са имплементирани и одобрени, `private-offline-future` трябва да fail-closed като NOT IMPLEMENTED.

## 6. Fail-closed правила

| Условие | Задължителен резултат |
|---|---|
| Липсващ, празен или неизвестен build target | Build/config evaluation спира преди plugin resolution; без default/fallback |
| Известен, но `NOT_IMPLEMENTED` target | Build спира с стабилен, несекретен код за грешка |
| Неизвестен runtime profile | Startup/build validation спира; не се избира provider |
| Target/profile комбинация извън allow-list | Спира преди provider bootstrap; без profile coercion или Base44 fallback |
| Липсващ/невалиден plugin contract | Build спира преди plugin container и bundle construction |
| Липсващ provider loader, auth или app-parameters binding | Build спира; не се допуска partial target |
| Provider family извън target allow-list | Build или bootstrap спира преди client construction |
| Dynamic import/load failure | Запазва се текущото explicit failure поведение; не се опитва друг provider |

Грешките трябва да използват стабилни кодове и безопасни target/profile labels, без dump на environment, config или secrets.

## 7. Plugin exclusion contract

### `base44-cloud`

Base44 Vite plugin присъства само когато trusted descriptor е `base44-cloud`. Текущо той:

- задава `@/` → `/src/` чрез `config`;
- чете environment чрез `loadEnv`;
- има conditional legacy `resolveId` поведение;
- добавя `html-injections` с `configResolved` и `transformIndexHtml`;
- при текущата `analyticsTracker: true` настройка добавя production inline analytics script;
- може да добавя sandbox-only config, middleware, error overlay и visual-edit transform;
- може да добави build-status plugin при отделен non-browser process environment flag.

Тези наблюдения са от наличния package source за `@base44/vite-plugin` version `1.0.30`; installed `dist` не беше наличен за независима byte-for-byte проверка в тази вълна.

### Небазов target

Base44 plugin import и factory invocation трябва да бъдат недостижими/изключени преди Vite plugin resolution. Не е достатъчно неговите опции да са `false`, защото основният plugin, alias/config hooks и `html-injections` пак могат да участват. Provider-neutral `@/` alias трябва да се предостави от target-neutral config, без да се извиква Base44 plugin.

Доказателството за exclusion трябва да покаже едновременно:

1. `@base44/vite-plugin` не е в resolved config import graph за небазовата команда;
2. active plugin list не съдържа `base44`, `html-injections`, `iframe-hmr`, `error-overlay`, `visual-edit-transform` или `base44-build-status`;
3. Base44 plugin не участва чрез `config`, `configResolved`, `resolveId`, `transform`, `transformIndexHtml`, `configureServer`, virtual module или друг hook;
4. generated HTML няма Base44 injection, analytics script, visual-edit agent, Base44 dev scripts или Base44-owned external URL;
5. resolved aliases не сочат към plugin compat modules или Base44 auth/client implementation;
6. emitted module/chunk graph не съдържа plugin-injected или provider Base44 runtime code.

Липса на известен virtual module в текущо прегледаните package sources не е универсално доказателство за бъдещи package versions. Всяка бъдеща версия изисква повторна проверка.

## 8. Auth boundary contract

- `src/auth/AuthContextFacade.jsx` остава application-owned boundary.
- За текущия Base44 target facade продължава да re-export-ва точните `AuthProvider` и `useAuth` bindings от `src/lib/AuthContext.jsx`.
- `src/App.jsx` остава platform-enforced директен import exception; тази вълна не го променя.
- Base44 target не създава втори React context, wrapper provider или hook и не променя identity.
- Бъдещ небазов target трябва да използва compile-time auth alias или именуван auth-driver binding зад стабилната application-owned граница.
- Един build съдържа точно една auth implementation и една context identity.
- Auth binding не се избира от runtime profile или browser input.
- Текущите login/logout/current-user/public-settings/error/loading договори не се променят без отделна bounded wave.

Как build-target alias ще обхване platform-enforced `App.jsx` без промяна на файла остава implementation decision и трябва да бъде доказано отделно.

## 9. Provider-loader contract

- Текущият Base44 loader остава фиксираният loader в `providerBootstrap.js`.
- Loader mapping се определя от trusted target descriptor и allow-listed provider family.
- Няма silent fallback, default provider или retry към друга family.
- Няма dynamic path construction от target/profile/URL/environment/browser/user string.
- Всеки loader използва фиксиран import specifier, проверим в source graph.
- Provider bundle продължава да минава през explicit validation.
- Base44 target запазва единствения `createClient` path в `base44Adapter.js`; не се създава втори Base44 client или compat client.
- Небазов build не трябва да съдържа loader key, import edge или alias към Base44 adapter/client.

## 10. App-parameters contract

- Текущите Base44-specific `appId`, access `token`, `functionsVersion`, `appBaseUrl`, URL/localStorage cleanup и `VITE_BASE44_*` semantics са разрешени само за `base44-cloud`.
- Бъдещ небазов target трябва да има отделен именуван app-parameters binding и да не импортва Base44 implementation.
- `VITE_APP_ENVIRONMENT_PROFILE` може да назовава runtime profile, но не избира build target.
- `VITE_BASE44_*` са browser-visible/public configuration; не са build authority и не трябва да съдържат secrets.
- Access token не се премества във `VITE_*`, descriptor или документация.
- Документът не записва реални app IDs, tokens, URLs, credentials или tenant values.

## 11. L3 emitted-build verification standard

L3 може да бъде обявен само за конкретен target, команда, dependency lock и build artifact set. За бъдещ небазов build са задължителни:

1. **Source import graph:** проследяване от config и application entry до всички static/dynamic imports и aliases; липса на `@base44/sdk`, `base44Adapter`, `base44Client`, Base44 `AuthContext` implementation и Base44 plugin.
2. **Resolved Vite config:** запазен машинно проверим snapshot на target ID, aliases, defines, build inputs и plugin names, без secrets.
3. **Active plugin list:** доказана пълна липса на Base44 plugin и неговите sub-plugins/hooks.
4. **Emitted chunk/module graph:** Rollup/Vite manifest или еквивалентен graph, който доказва, че Base44 modules не са включени в initial, lazy, shared или asset chunks.
5. **Generated HTML:** inspection за script/link/modulepreload/import-map/injected inline content и Base44 URLs.
6. **Asset/string scan:** JS, CSS, HTML, sourcemaps и други emitted assets се сканират поне за `@base44/sdk`, `@base44/vite-plugin`, `base44Adapter`, `base44Client`, Base44 AuthContext paths, compat imports, известни injection markers и Base44 endpoints/hosts.
7. **Negative module evidence:** изрично доказателство за липса на `@base44/sdk`, Base44 adapter/client/AuthContext implementation и Base44 plugin injections.
8. **Runtime profile mismatch tests:** всеки неизвестен или несъвместим profile fail-closed преди provider construction.
9. **Reproducibility:** verification се изпълнява върху clean build output с фиксирани target, lockfile и tool versions.

Tree-shaking не е равнозначно на exclusion. „Модулът не е изпълнен“, „lazy chunk не е заявен“ и „string не е намерен“ сами по себе си не доказват липса от source graph или emitted bundle. PASS изисква съгласувани source-graph, resolved-config, plugin-list, module-graph, HTML и asset доказателства.

## 12. L4 acceptance contract

L4 остава NOT IMPLEMENTED. Бъдещ L4 PASS изисква небазов frontend build, който:

- не зависи от Base44 SDK, auth implementation, adapter/client, plugin, compat paths, HTML injections или Base44-specific app-parameter behavior;
- запазва единна application-owned backend и auth граница;
- предоставя target-appropriate current-user, login, logout, public settings/config и token/session поведение;
- няма Base44 browser URLs/branding/runtime utilities, освен ако са изрично provider-neutral assets;
- няма fallback към Base44 и не отслабва auth, tenant isolation или RLS;
- преминава L3 стандарта и target-specific behavioral/security tests.

Package presence само в `package.json` не доказва emitted runtime dependency, но L4 deployment/dependency policy трябва отделно да реши дали Base44 packages могат да останат инсталирани. Тази вълна не взема това решение.

## 13. Файлова карта за бъдеща имплементация

Имената по-долу са предложения, не създадени файлове.

### Вероятно нови файлове

- `build/buildTargetDescriptors.js` — immutable registry и resolver.
- `build/vitePluginsForTarget.js` — plugin-set factory с explicit Base44 exclusion.
- `src/build/buildTargetContract.js` — само ако е нужен безопасен browser-visible target metadata subset, без authority.
- `src/auth/implementations/Base44AuthBinding.jsx` и бъдещ non-Base44 counterpart — само след отделно одобрение.
- `src/lib/app-params/base44.js` и бъдещ target-specific counterpart.
- Target-specific verification scripts/tests за source graph, resolved config и emitted assets.

### Вероятно променяни файлове

- `vite.config.js` — trusted descriptor resolution, neutral alias и conditional plugin set.
- `src/services/providerBootstrap.js` и евентуално `providerSelection.js` — target-bound fixed loader registry.
- `src/auth/AuthContextFacade.jsx` или build alias configuration — target-bound auth implementation.
- `src/lib/app-params.js` — facade към target-specific implementation.
- `src/main.jsx` — compatibility check преди bootstrap.
- `package.json` — само ако бъде одобрена explicit build command/verification command промяна.

### Забранени за промяна в тази planning wave

`vite.config.js`, `package.json`, lockfile, `src/main.jsx`, `src/App.jsx`, `src/lib/AuthContext.jsx`, `src/auth/AuthContextFacade.jsx`, всички provider/service/app-parameters/environment-profile файлове, Base44 plugin/package files, backend functions, entities, RLS, datastore и persistent data. По-старите Phase/Wave документи също не се редактират.

Platform-managed `src/App.jsx` и `src/lib/AuthContext.jsx` по подразбиране остават забранени и в бъдеща bounded implementation wave; всяко изключение изисква отделно доказана необходимост и explicit approval.

## 14. Поетапен бъдещ implementation plan

1. **Wave 10.6.5 — descriptor skeleton and config resolution:** immutable registry само с работещ `base44-cloud` и fail-closed non-selectable placeholder; trusted non-`VITE_*` input; tests за unknown/missing target. Без небазов build.
2. **Verification/closure gate:** source review, resolved-config evidence, default Base44 build/Preview parity, нулеви auth/data промени.
3. **Следваща bounded wave — plugin-set separation:** provider-neutral `@/` alias и Base44 plugin factory само в Base44 branch; negative config tests за placeholder, без alternate provider.
4. **Verification/closure gate:** active plugin names/hooks и generated HTML за Base44 target; fail-closed placeholder; package internals re-audit.
5. **Следваща bounded wave — target bindings:** отделни именувани provider-loader/auth/app-parameters bindings, първоначално само Base44 implementation; runtime target/profile compatibility gate.
6. **Verification/closure gate:** един client, една context identity, без fallback, Base44 behavior parity.
7. **Само след ново explicit approval — минимален non-Base44 implementation:** реална family, loader, auth и app parameters като отделни bounded промени.
8. **L3 verification wave:** clean non-Base44 build и пълният emitted-build proof standard.
9. **L4 closure evaluation:** отделна оценка; L4 не следва автоматично от L3.

Всяка implementation стъпка има собствен rollback и не може да маркира следващата gate като PASS без изпълнени доказателства.

## 15. Acceptance criteria за planning документа

- Създаден е точно този един нов документ и няма друга промяна.
- Trusted build target, runtime profile и `VITE_*` са ясно разграничени.
- Дефинирани са immutable descriptor, минимална target матрица и всички required bindings.
- Неизвестни/липсващи/несъвместими стойности fail-closed без fallback.
- Base44 plugin presence/exclusion и hook-level доказателството са описани.
- Auth identity, App exception, fixed provider loader, single Base44 client и Base44 app-parameters ограниченията са запазени.
- L3 verification различава tree-shaking от source-graph/emitted exclusion.
- L4 е acceptance contract, а не PASS claim.
- Има файлова карта, bounded бъдещи вълни, security invariants, rollback, risks и explicit next gate.
- Няма source/config/package/plugin промяна, dependency install, build target implementation, alternate provider, secret, commit или push.

## 16. Security invariants

- Auth, authorization, tenant policy и RLS промени: 0.
- Datastore, entity schema и persistent records промени: 0.
- Secrets, tokens, credentials и private environment values в descriptor/document/output: 0.
- Silent fallback и default към друг provider: 0.
- Browser-controlled build authority: 0.
- Допълнителен Base44 client или React context: 0.
- Функционална промяна: 0.
- Build target не предоставя authorization, tenant isolation или RLS гаранция; това са отделни runtime/backend контроли.

## 17. Rollback

Rollback на Wave 10.6.4 е изтриване само на:

`src/docs/PHASE_10_WAVE_10_6_4_TRUSTED_BUILD_TARGET_DESCRIPTOR_AND_PLUGIN_EXCLUSION_CONTRACT_PLAN.md`

Няма source, config, dependency, data или Git-history rollback.

## 18. Residual risks и UNKNOWN

- Installed package metadata сочи `@base44/vite-plugin` `1.0.30` към `dist/index.js`, но `dist` не беше наличен в текущото локално package дърво; package source беше прегледан, а byte-for-byte published runtime artifact остава UNKNOWN.
- Наличният source показва `config`, `resolveId`, `configResolved`, `transformIndexHtml`, `transform`, `configureServer` и conditional plugin assembly. Не е изпълнен instrumented Vite run, затова действителният hook invocation order и resolved plugin list остават NOT EXECUTED.
- В прегледания package source не е установен virtual-module contract, но пълната липса за всички dependency versions остава UNKNOWN и трябва да се доказва при всяка L3 проверка.
- Бъдещият точен CI/CLI transport за trusted target, command UX и missing-target policy остават implementation decisions.
- Build-target alias стратегията за platform-enforced `App.jsx` е планирана, но feasibility и platform validator поведение остават UNKNOWN.
- Няма non-Base44 provider/auth/app-parameters implementation; техните API и security свойства са UNKNOWN.
- Build, lint, typecheck, Preview, resolved-config dump и emitted artifact inspection не са изпълнявани, защото вълната е planning-only.
- `index.html` Base44 favicon и platform-managed Base44 URL surfaces остават бъдещи L4 blockers.
- Dependency installation/deployment policy за небазов target не е решена.

## 19. Next Decision Gate

Предложена е само следващата bounded implementation wave:

**Wave 10.6.5 — Trusted Build-Target Descriptor Skeleton and Fail-Closed Config Resolution.**

Обхват: immutable descriptor registry с единствен selectable `base44-cloud` target и един non-selectable `private-offline-future` placeholder; trusted non-`VITE_*` resolution преди plugin construction; fail-closed validation tests; текущият Base44 plugin/provider/auth/app-parameters behavior остава непроменен; без небазов build, alternate provider или L3/L4 claim.

**REQUIRES EXPLICIT APPROVAL.** Да не се изпълнява в Wave 10.6.4.

## 20. Final Result

Wave 10.6.4 planning complete. Trusted build-target descriptor и plugin exclusion contract са дефинирани като бъдещ договор, без имплементация. L3 и L4 остават NOT IMPLEMENTED. Wave 10.6 остава IN PROGRESS. Phase 10 остава NOT COMPLETE и NOT FROZEN.
