# Phase 10 — Wave 10.6.12 First Non-Base44 Target Assessment

## Статус и обхват

Само анализ и предложение; няма нов target, provider или implementation. Начален branch `codex/phase-10-current`, HEAD `70ec87a55563bfcfedaabd653ccfea15e1528f10`, чисто working tree и празен index. Прегледани са planning 10.6.9, implementation 10.6.10 и closure 10.6.11, текущият build/runtime source и релевантните тестове и scripts. Тук не са изпълнявани build или тестове; предишни резултати не са ново evidence.

Два различни резултата:

1. **Non-Base44 plugin build:** Vite build без resolution/loading/evaluation на Base44 Vite plugin по избрания config path. Сам по себе си не изключва Base44 SDK или runtime от browser bundle и не доказва работещ frontend.
2. **Работещ test frontend:** отделен, изрично тестов runtime с фиктивен provider и примерни данни, който визуализира реален екран. Не е production auth, backend, offline продукт или разрешение за deployment.

## Текуща архитектура и доказателства

- `package.json` изпълнява `scripts/run-vite.mjs` за `dev`, `build`, `preview`. Wrapper допуска само тези команди без допълнителни аргументи, фиксира `base44-cloud` и native loader. `vite.config.js` проверява descriptor и пет Base44 bindings преди fixed import на `build/vite/base44PluginSet.js`, който единствен в този config path import-ва `@base44/vite-plugin` и създава plugin set. Следва React plugin.
- `src/build/buildTargetDescriptor.js` допуска само `base44-cloud`; `private-offline-future` е `NOT_IMPLEMENTED`, non-selectable и с null bindings. Неговото име и семантика предполагат по-широк бъдещ продукт, не тестов frontend. Препоръка: да остане непроменен; отделен `standalone-test` е само предложено име, подлежащо на одобрение.
- Инсталираният Base44 plugin `dist/index.js` задава alias `@/` към `/src/` и при legacy режим има и compat resolution/defines. Множество application imports използват `@/`. Non-Base44 config се нуждае от собствен абсолютен filesystem alias към `src`, базиран на фиксираното местоположение на config, с тестове за реална resolution. Не се обещава еквивалентност на останалите Base44 hooks, injections, proxy или legacy compatibility; тя трябва да се инвентаризира при нужда.
- `src/main.jsx` твърдо resolve-ва `base44-cloud`, чете `appParams`, проверява runtime profile и bootstrap-ва provider преди import на `App.jsx`. `src/lib/environment-profile.js` и `providerSelection.js` насочват настоящите профили към Base44; `providerBootstrap.js` има само fixed Base44 loader и fail-closed state. `backendAdapter.js` изисква вече bound bundle и предоставя `auth`, `functions`, ограничен `catalog` и public settings.
- `base44Adapter.js` import-ва `@base44/sdk` и SDK axios client, създава client и public-settings заявка. `src/api/base44Client.js` реекспортира този client. `src/lib/AuthContext.jsx` директно import-ва shim-а, SDK axios client и `appParams`, а `src/App.jsx` import-ва този context директно; `src/auth/AuthContextFacade.jsx` е още един път към него. След първа стъпка, която изменя само plugin config, тези runtime пътища остават в application graph; Base44 adapter/SDK и auth код могат да останат в генерираните chunks, включително dynamic chunks. Точният emitted graph е UNKNOWN до измерване, не се извежда от имената на файловете.
- `src/lib/app-params.js` чете Base44 app ID, token, URL/storage и profile; не бива да служи като доверен избор на build target. Текущият Base44 runtime остава свързан чрез тези параметри, auth и provider независимо от plugin-а. Package и lockfile остават с Base44 зависимости; изключване от инсталацията е отделна задача.

## Trusted selection: варианти и препоръка

1. **Препоръчан:** отделен repository-owned Node entry за test build с вътрешно фиксиран target и фиксирана команда, без caller arguments; обща вътрешна orchestration функция с изричен immutable mapping, ако е нужна, не трябва да предоставя target чрез произволен CLI аргумент или environment. Root dispatcher приема само валидирания target от тази Node orchestration. Отделен фиксиран npm script може да извиква entry-то; съществуващите scripts и wrapper продължават да фиксират `base44-cloud`. Трябва да се дефинира и тества точната граница при директно стартиране на Vite/config: неподдържан или липсващ target fail-closed, не доверявайки се на произволен caller env като самостоятелна authority.
2. Разширен wrapper с фиксирани собствени подкоманди, напр. отделна build подкоманда, mapped към target без forwarding. По-малко entry files, но разширява публичния command contract; изисква прецизно разграничаване на допустимата подкоманда от забранените Vite аргументи.
3. Отделен фиксиран config entry, избран вътрешно от test wrapper: графите са по-ясно разделени, но има риск от дублиране и drift спрямо trusted dispatcher. Caller `--config` остава забранен.

Нито URL, browser storage, cookie, `VITE_*`, caller target environment, нито свободни Vite flags избират target. Build target не е security boundary срещу потребител, който контролира локалния source или Node процеса. Новият Node entry изисква изрично одобрение и трябва да ограничи влиянието на inherited environment; конкретният механизъм за предаване на verified Node selection към Vite и защитата при direct invocation са **UNKNOWN / design gate**, не разрешение за implicit fallback. Не използвай публична стойност на environment като доказателство за trusted provenance.

Threat model: при нормалните entrypoints целта е защита срещу непредвиден избор и caller-controlled inputs. Не се твърди защита срещу човек, който контролира локалния source или Node процеса. Environment variable сама по себе си не доказва trusted provenance. Окончателната архитектура за selection остава отворена за решение.

Base44 Vite plugin loading е Node/config boundary; Base44 SDK, auth и client в emitted chunks са отделна browser runtime boundary. Липсата на plugin string в browser bundle сама по себе си не доказва, че plugin-ът не е зареден в Node/config процеса.

## Предложен първи implementation scope: само plugin build

След одобрение: (1) нов фиксиран test-build Node entry и евентуален script; (2) отделен selectable test-build descriptor и explicit target-specific bindings/dispatcher с фиксиран non-Base44 plugin set; (3) собствен `@/` alias и React plugin; (4) тестове за selector, descriptor, config и build; (5) implementation report. Точните допълнителни файлове и Node-to-config authority contract трябва да се фиксират преди implementation. `private-offline-future`, provider/auth/runtime, dependencies и backend остават непроменени. Test build може да генерира Base44 runtime и може да не стартира като test frontend: това не е критерий за успеха на първия етап.

Съществуващите `dev/build/preview` продължават през стария wrapper със същия argv, options и Base44 plugin order. Отделният test entry не заменя тези команди. Използвай отделна временна output директория в тестовете, зададена от доверен harness, без caller-controlled Vite options в публичния wrapper.

## Следващ отделен runtime етап

Кандидат реален екран: `src/pages/lifecycle/LifecycleDefinitionsPage.jsx` чете `backend.catalog.list("LifecycleDefinition")` и показва name, targetType и active. Той съдържа и create/edit/delete действия и router links: за ограничен test frontend те трябва изрично да са недостъпни или fail-closed с ясна грешка, без мълчалив успех или мрежов fallback. Алтернатива `SecurityCenterPage.jsx` използва статична матрица и е по-лесна за визуализация, но сама не доказва реално четене през test provider.

Минимален provider bundle би имал изискваните от `validateProviderBundle` ключове `providerClient` с `auth`, `functions`, `entities`, плюс `fetchPublicSettings`; само `entities.LifecycleDefinition.list` връща фиксирани синтетични записи. Всяка непредвидена операция, функция, mutation и мрежов опит отказва. Тестовата identity/auth стойност е изрично фиктивна, без credentials и без security guarantee. За реалния екран са нужни test-only bootstrap и router/context entry, съобразени с `backendAdapter` binding преди import на страницата; предотврати достигане до Base44 `AuthContext` и директния му SDK import. Дали да се адаптира общият auth facade или да се използва изолиран test entry е отделно решение след анализ на graph и contract; не твърдим, че наличният `App.jsx` може да се използва непроменен. Не използвай реални клиентски данни и production deployment.

## Acceptance criteria и тестове

**Plugin build:**

- Отделният trusted entry да избира само фиксирания test target; липсващ, unknown, non-selectable и incompatible binding да се отказват преди import, без fallback. Caller arguments и опити за environment override не променят избор или config; prototype-like имена се отхвърлят. Проверяват се директен Vite invocation и невалиден/подменен orchestration context.
- **Node/config boundary:** контролиран native-loader test build без наличен Base44 Vite plugin package трябва да успее и да провери alias. Import/factory instrumentation има положителен Base44 контрол, който регистрира и двете действия; липсващ marker при test path сам по себе си не е доказателство. **Browser runtime boundary:** отделно се изследват действителният module graph и dynamic chunks за Base44 SDK, auth, client и injections. Липсата на plugin string в browser bundle не доказва, че plugin-ът не е бил зареден по време на build. Документират се ограниченията на наблюдението.
- Base44 regression: съществуващи wrapper и descriptor tests, true/false legacy options, plugin order, alias и реален Base44 build; dev/preview smoke където е приложимо. Няма промяна на caller argument policy и няма fallback при неуспешен test target.

**Test frontend, отделно одобрение:**

- Проверка на bootstrap contract и identity на фиктивния bundle, показване на синтетични LifecycleDefinition записи в реалния екран, празно състояние и fail-closed неподдържани операции; изрично проверени router/context изисквания.
- Browser integration тест прихваща всички мрежови заявки и отказва Base44/backend calls, проверява липса на fallback при provider failure и възстановяване/отказ при invalid profile. Тестът не доказва authentication или authorization.
- Анализ на действително генерираните module graph и всички chunks за Base44 SDK, adapter, auth и app-params; проверка чрез независими build metadata и контролирани markers, включително dynamic imports. Ако изключване не е доказано, отбележи UNKNOWN, а не PASS. Отделен Base44 runtime regression е задължителен.

## Rollback и решение

Първата wave трябва да остане отделен reviewable commit: връщане на новия Node entry/script, test descriptor, dispatcher branch, neutral alias и съответните тестове/report възстановява Base44-only пътя; не се трият данни, dependencies или provider. Проверка на съществуващите команди и Base44 build след rollback е необходима. Не се изпълнява rollback сега.

UNKNOWN: окончателно име и binding IDs; безопасен и проверим Node-to-config provenance contract при direct invocation; ефектите от липсващи Base44 hooks и legacy imports; точният browser module graph, размер и runtime поведение; точният test auth/context contract; Linux и remote Base44 parity. Non-Base44 runtime, L3/L4 и Phase 10 не са готови.

**Следващ Decision Gate — REQUIRES EXPLICIT APPROVAL:** одобрение на името, authority contract и точния обхват на първата plugin-build implementation wave. Отделно одобрение е необходимо за test provider/frontend и неговите критерии. Никаква implementation wave не е започната.
