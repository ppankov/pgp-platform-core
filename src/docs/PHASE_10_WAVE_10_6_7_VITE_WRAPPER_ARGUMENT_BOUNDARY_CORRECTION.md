# Phase 10 — Wave 10.6.7 Vite Wrapper Argument Boundary Correction

## 1. Status

Wave 10.6.7 — **IMPLEMENTED AND VERIFIED, BOUNDED**.

Корекцията е ограничена до Vite wrapper argument boundary, deterministic
wrapper-focused tests и този документ. Phase 10 остава **NOT COMPLETE** и
**NOT FROZEN**. Този резултат не е независима closure evaluation.

## 2. Decision-B origin

Wave 10.6.6 завърши с decision **B — CORRECTION REQUIRED**. Причината беше,
че `scripts/run-vite.mjs` препращаше произволни caller-provided аргументи към
Vite. Така `--config`, `-c` или `--config=...` можеха да подменят одобрения
`vite.config.js` и да заобиколят descriptor resolution, binding assertions и
Base44 plugin-factory gate.

## 3. Bounded scope

Разрешената и изпълнена промяна включва само:

- `scripts/run-vite.mjs`;
- новия `tests/runVite.test.js`;
- този Wave 10.6.7 документ.

`package.json` не е променен, защото wrapper тестовете могат да се изпълнят
директно с вградените Node test инструменти.

## 4. Exact source changes

`scripts/run-vite.mjs`:

- запазва own-property проверката на command registry;
- връща стабилен code за unsupported command;
- отхвърля всеки аргумент след позволената команда;
- извършва двете проверки преди промяна на `PGP_BUILD_TARGET`, `process.argv`
  или import на Vite;
- премахва `forwardedArgs` от конструирания Vite argv.

`tests/runVite.test.js` използва `node:test`, `node:assert`,
`child_process` и временен fake Vite module. Marker файлът от fake Vite
доказва дали import/start boundary е достигната, без dependency и без
допълнителен реален build.

## 5. Threat/bypass description

Caller-controlled Vite options са build-authority input. Config option може
да избере hostile config, а mode, root/path и други текущи или бъдещи Vite
опции могат да променят build semantics извън одобрения wrapper contract.
Преди корекцията wrapper-ът валидираше command name, но препращаше остатъка
от argv без ограничение.

## 6. Corrected argument policy

Позволени са точно command names:

- `dev`;
- `build`;
- `preview`.

След command name са позволени точно **нула** caller-provided аргумента.
Всеки flag, flag value, positional root/path, bare `--` или неизвестен
аргумент се отхвърля fail-closed. Няма allow-list за `host`, `port`, `open`,
`watch`, `mode`, `config` или друг Vite argument.

Бъдеща необходимост от аргументи изисква отделна bounded wave.

## 7. Error codes

- `PGP_VITE_COMMAND_UNSUPPORTED` — command name не е собствен allow-listed
  key;
- `PGP_VITE_ARGUMENTS_NOT_ALLOWED` — има поне един аргумент след валидната
  команда.

Error output съдържа само стабилен code и кратка безопасна причина. Не
отпечатва hostile argument, environment, config, credentials, token или
appId.

## 8. Test evidence

`node --test tests/runVite.test.js` — **PASS**:

- tests: 4;
- pass: 4;
- fail: 0;
- покрити unsupported command, `__proto__`, `constructor`, `toString`;
- покрити `--config evil.js`, `-c evil.js`, `--config=evil.js`;
- покрити `--mode hostile`, `--mode=hostile`;
- покрити positional root/path, bare `--`, unknown flag;
- покрити аргументи след `dev` и `preview`;
- marker доказва, че Vite не се стартира при всички rejected cases;
- валидни `dev`, `build`, `preview` достигат съответния фиксиран Vite argv;
- caller `PGP_BUILD_TARGET=unknown-target` е заменен с `base44-cloud`.

`npm run test:build-target` — **PASS**:

- tests: 9;
- pass: 9;
- fail: 0.

## 9. Production build evidence

`npm run build` — **PASS**:

- реален command: `node scripts/run-vite.mjs build`;
- Vite: 6.4.3;
- transformed modules: 1959;
- production output е създаден успешно;
- остава съществуващият non-failing warning за `App` chunk над 500 kB.

`dist/` е ignored build output и не участва в Git diff.

## 10. Base44 behavior parity

При валидна команда без допълнителни аргументи wrapper поведението е
запазено:

- caller-provided `PGP_BUILD_TARGET` се заменя безусловно;
- `PGP_BUILD_TARGET=base44-cloud` се задава преди Vite import;
- `dev` подава празен Vite command argv;
- `build` подава `build`;
- `preview` подава `preview`.

Успешният production build с 1959 transformed modules потвърждава bounded
local build parity. Remote Base44 execution и live Preview/auth smoke не са
изпълнени.

## 11. Security invariants

- непознат и prototype-like command fail-closed преди Vite import;
- всеки caller-provided Vite argument fail-closed преди Vite import;
- одобреният `vite.config.js` не може да бъде подменен през wrapper argv;
- build target остава фиксиран към `base44-cloud`;
- runtime/browser input не получава build-target authority;
- няма fallback, втори provider/client или нов auth context;
- няма environment/config/secret dump и hostile argument echo;
- няма auth, tenant, RLS, backend, entity или persistent-data промяна.

## 12. Unchanged files/contracts

Непроменени са:

- `vite.config.js`;
- `src/main.jsx`;
- `src/build/buildTargetDescriptor.js`;
- `package.json` и `package-lock.json`;
- dependencies и devDependencies;
- Base44 plugin source/options;
- provider, auth, backend, app-parameters и environment-profile source;
- `src/App.jsx`;
- entities, RLS, datastore и persistent data;
- всички по-стари Wave документи.

Не са имплементирани plugin separation, alternate provider/build, L3 или L4.

## 13. Rollback

Rollback е ограничен до:

1. възстановяване на предишния `scripts/run-vite.mjs`;
2. премахване на `tests/runVite.test.js`;
3. премахване на този Wave 10.6.7 документ.

Няма dependency, lockfile, datastore, migration или remote deployment
rollback.

## 14. Residual risks/UNKNOWN

- Remote Base44 build semantics — **UNKNOWN / NOT EXECUTED**.
- Linux wrapper execution — **NOT EXECUTED**.
- Live Preview/auth smoke — **NOT EXECUTED**.
- Static Base44 plugin package import exclusion — **NOT IMPLEMENTED**.
- Non-Base44 build и plugin/source/bundle exclusion — **NOT IMPLEMENTED**.
- L3/L4 — **NOT IMPLEMENTED / NOT VERIFIED**.
- Съществуващият production chunk-size warning остава.
- Бъдещи Vite аргументи не се поддържат; необходимостта им изисква отделно
  одобрение.

## 15. Next Decision Gate

**Повторна независима closure evaluation — REQUIRES EXPLICIT APPROVAL.**

Тази correction wave не започва и не изпълнява closure wave. Не се започват
plugin separation, alternate/non-Base44 build, L3, L4 или deployment без
отделно изрично одобрение.

## 16. Final Result

Wave 10.6.7 затваря открития wrapper argument bypass с fail-closed policy:
само `dev`, `build` и `preview`, без caller-provided Vite аргументи.

Wrapper tests — **PASS 4/4**. Descriptor tests — **PASS 9/9**. Production
build — **PASS, 1959 modules**. Caller target override — **PASS**, фиксиран
към `base44-cloud`. Base44 source/config/auth/provider contracts остават
непроменени.

Няма commit, push, merge, rebase, force push или remote deployment.
