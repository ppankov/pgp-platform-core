# PGP Core — Phase 8 Architecture Snapshot

> **STATUS: FROZEN — Platform Reference Implementation**
>
> Stable platform reference implementation for declarative scheduling, persistent background jobs and at-least-once worker execution.
>
> Snapshot date: 2026-07-18 (UTC)
>
> This is a documentation-only artifact. It freezes the Phase 8 Scheduler and Background Job Runtime after final stabilization and explicit approval.

---

## What Phase 8 is NOT

Phase 8 is explicitly **not** any of the following. No part of this snapshot should be read as claiming otherwise:

- It is **not** an exactly-once runtime.
- It is **not** a distributed scheduler.
- It is **not** a production-ready distributed worker cluster.
- The native scheduler is **not** automatically active.
- It is **not** a datastore-atomic queue.

Phase 8 is a **stable reference implementation**: declarative schedules, persistent queued jobs, lease-based at-least-once worker execution, bounded retry, a terminal dead-letter state, and an append-only audit trail — all Core-controlled and non-executable.

---

## 1. Обхват на фазата

Phase 8 предоставя:

- Глобален каталог с дефиниции на задачи (`JobDefinition`).
- Platform и organization графици (`JobSchedule`).
- Еднократни графици (`once`).
- Интервални графици (`interval`).
- Постоянна опашка със задачи (`BackgroundJob`).
- Опити за изпълнение (`JobAttempt`).
- Lease механизъм за at-least-once изпълнение.
- Bounded retry с backoff.
- Терминално `dead_letter` състояние.
- Append-only audit през runtime функциите (`JobExecutionEvent`).
- Event Bus публикации (best-effort, sourceType `job`).
- Административен UI за дефиниции, графици, опашка, история и dead-letter.
- Dashboard наблюдение чрез броячи и индикатор за режим на планировчика.

Фазата е **стабилна референтна реализация**. Тя **не гарантира exactly-once изпълнение**.

---

## 2. Петслойна архитектура

Точно пет entities съставят Phase 8:

1. **JobDefinition** — описва безопасен тип задача в глобалния каталог.
2. **JobSchedule** — описва **кога** трябва да се създаде `BackgroundJob` за дадена дефиниция.
3. **BackgroundJob** — една конкретна опашкова работа, създадена от планировчика или ръчно.
4. **JobAttempt** — един исторически опит за изпълнение на `BackgroundJob`.
5. **JobExecutionEvent** — runtime audit запис (append-only) за `BackgroundJob`.

Ясно разделение:

- `JobDefinition` описва **тип** задача (метаданни, не код).
- `JobSchedule` описва **време/повторение**, не състояние на изпълнение.
- `BackgroundJob` е **инстанция** на работа в опашката.
- `JobAttempt` е **презапис на история** на един опит (никога не се изтрива от runtime).
- `JobExecutionEvent` е **audit** — създава се само от runtime функциите.

---

## 3. Job Definition и Static Handler Registry

- `JobDefinition` е **platform-global**.
- `key` е стабилен идентификатор — уникален и immutable след създаване.
- `handlerKey` сочи **само** към статично регистриран handler в Core.
- `payloadSchema` и `resultSchema` са декларативни JSON schema (не изпълним код).
- Definitions не съдържат изпълним код, нито credentials.

### Финален static handler registry

Регистърът съдържа точно един handler:

- **`system.health_check`**

Поведение:

- Няма външни API повиквания.
- Няма странични мутации извън Job Runtime.
- Връща само безопасни operational metadata:
  - `ok`
  - `executedAt`
  - `jobId`
  - `attemptNumber`

### Потвърждение

- Временният `system.stabilization_failure` handler е **премахнат**.
- Няма останали препратки към него в сорса на `processBackgroundJobs`.
- Няма dynamic imports.
- Няма `eval`.
- Няма shell execution.
- Няма handlers, зареждани от entities или plugins.

Разширяването на registry-то е Core модификация, не конфигурация или plugin.

---

## 4. Job Schedule Contract

### Scope

- `platform` — `organizationId` е `null`.
- `organization` — `organizationId` е задължителен.

### scheduleType

- `once` — изисква `runAt`.
- `interval` — изисква `intervalSeconds`.

### misfirePolicy

- `skip`
- `run_once`

### Once semantics

- Изисква `runAt`.
- `runAt` е UTC ISO-8601.
- Създава **най-много една** `BackgroundJob`.
- След успешно enqueue графикът се **деактивира** (`enabled = false`, `nextRunAt = null`).

### Interval semantics

- Минимум `intervalSeconds = 60`.
- Използва `nextRunAt` за детерминистично следващо изпълнение.
- Може да има `startAt` (начален момент).
- Може да има `endAt` (графикът се деактивира, когато `nextRunAt` надмине `endAt`).
- Може да има `maxRuns` (графикът се деактивира, когато `runCount` достигне `maxRuns`).
- Следващото изпълнение се изчислява **детерминистично** спрямо `now`, не спрямо wall-clock реално време.

### Не се поддържа във Фаза 8

- Cron expressions.
- Timezone wall-clock schedules.
- DST правила.
- Weekday/monthly календарни правила.

Всички schedule timestamps са UTC.

---

## 5. Misfire и Occurrence Identity

### `skip`

- Не създава исторически catch-up jobs.
- Премества `nextRunAt` към първото бъдещо изпълнение след `now`.

### `run_once`

- Създава **най-много една** задача за пропуснатия период.
- Не създава catch-up storm.
- Премества `nextRunAt` към първото бъдещо изпълнение след `now`.

### Occurrence key

```
<scheduleId>:<scheduledForUtcIso>
```

Тази стойност се използва като `deduplicationKey` на scheduled `BackgroundJob`.

Последователни scheduler ticks за една и съща occurrence **не създават дубликат**.

> Виж секция 10 за точната граница на deduplication защита (function-logic-only).

---

## 6. Background Job Status Model

Статуси:

- `queued`
- `leased`
- `running`
- `retry_wait`
- `succeeded`
- `cancelled`
- `dead_letter`

Описание:

- `availableAt` контролира **кога** задача може да бъде поета.
- `priority` участва в подреждането при claim (по-високо = първо).
- `deduplicationKey` идентифицира логическа задача/occurrence.
- `jobScheduleId` е `null` при ръчно enqueue.
- Terminal jobs (`succeeded`, `cancelled`, `dead_letter`) **не се изтриват** от runtime операциите.
- Stack traces **не се съхраняват**.
- `lastError` съдържа само безопасен, ограничен текст (никога stack trace).

---

## 7. Retry Contract

`retryPolicy`:

- `maxAttempts`
- `backoffType`
- `baseDelaySeconds`
- `maxDelaySeconds`

Поддържани `backoffType`:

- `none`
- `fixed`
- `exponential`

Поведение:

- `attemptCount` се увеличава при **claim**.
- При оставащи опити job преминава в `retry_wait` и `availableAt` се изчислява по backoff.
- `availableAt` определя следващото допустимо изпълнение.
- При изчерпани опити (`attemptCount >= maxAttempts`) job преминава в `dead_letter`.
- Dead-letter jobs **не се изпълняват автоматично отново**.
- **Няма безкраен retry loop.**

---

## 8. Lease и Worker Semantics

### Подреждане при claim

1. `priority` низходящо.
2. `availableAt` възходящо.
3. `createdAt` възходящо.

Claim set:

- Jobs със `status = queued` и `availableAt <= now`.
- Плюс jobs със `status = leased` и `leaseExpiresAt < now` (reclaim за at-least-once).

### При claim

- `status` → `leased`.
- `leaseOwner` се задава (opaque worker id).
- `leaseAcquiredAt` се задава.
- `leaseExpiresAt` се задава.
- `attemptCount` се увеличава.
- `JobAttempt` се създава (status `running`).

### Преди handler execution

- Job `status` → `running`.
- Attempt `status` → `running`.

### При успех

- Job `status` → `succeeded`.
- `result` се записва (safe metadata).
- `completedAt` се задава.
- Lease полетата се изчистват.
- Attempt → `succeeded`.

### При неуспех

- Attempt → `failed` с безопасен `lastError`.
- Job → `retry_wait` (ако има оставащи опити) или `dead_letter` (при изчерпани).
- Lease полетата се изчистват.

### При изтекъл lease

- Предишният attempt → `abandoned`.
- `abandonedAt` се задава.
- Създава се нов attempt при следващия worker tick.
- Задачата може да бъде изпълнена **повторно** (at-least-once).

---

## 9. Точна граница на Lease защитата

Документирано честно:

- Lease enforcement е **function-logic-only**.
- Няма datastore transaction за atomic claim.
- Няма conditional update / compare-and-swap.
- Няма row lock.
- Няма distributed lock.

Следствия:

- Последователни worker calls спазват lease състоянието.
- Конкурентни worker-и **теоретично могат** да прочетат една и съща eligible job преди статуса на първия да е видим.
- Duplicate execution е **възможно**.
- Runtime семантиката е **at-least-once**.
- Бъдещи handlers със странични ефекти трябва да бъдат **idempotent**.
- `system.health_check` е side-effect-free.
- Atomic claim и distributed locking са **отложени**.

**Не се твърди**, че lease механизмът гарантира взаимно изключване при конкурентни worker-и.

---

## 10. Точна граница на Deduplication

Deduplication идентичности:

- `JobDefinition.key` — глобално уникален.
- `JobSchedule.key` — уникален в рамките на scope (platform или per organization).
- `BackgroundJob.deduplicationKey` — идентифицира логическа scheduled occurrence или ръчно enqueue.
- Scheduled occurrence key = `<scheduleId>:<scheduledForUtcIso>`.

Deduplication се прилага чрез:

- **Function-level pre-check** (filter за съществуващ non-cancelled job с този `deduplicationKey`).
- Последователна проверка и `create`.

**Не е налично**:

- Datastore unique constraint.
- Atomic conditional insert.
- Transactionally guaranteed uniqueness.

Следователно едновременни идентични заявки (два конкурентни ticks за една occurrence) могат да се състезават и двете да създадат job.

Това е **документирано ограничение**, не гаранция.

---

## 11. Job Attempt Contract

Статуси:

- `running`
- `succeeded`
- `failed`
- `abandoned`

Описание:

- Attempts са **исторически**.
- Runtime **не ги изтрива**.
- `attemptNumber` се увеличава при всеки нов опит.
- Attempt **не съдържа** job payload.
- Attempt **не съдържа** job result.
- Attempt **не съдържа** credentials или secrets.
- Abandoned attempt се **запазва** при lease recovery (at-least-once).

---

## 12. Job Execution Audit

`JobExecutionEvent` е **append-only през runtime функциите**.

Runtime функциите:

- Създават audit records.
- **Не update-ват** audit records.
- **Не delete-ват** audit records.

Безопасното `metadata` съдържа **само**:

- identifiers (jobId, scheduleId, definitionId, organizationId)
- status
- `attemptNumber`
- `actorId`
- `workerId`
- `correlationId`
- безопасни transition metadata

**Не съдържа**:

- payload
- result
- lastError
- stack trace
- credentials
- tokens
- authorization data

### Enforcement граница

- Append-only е **function-layer contract**.
- UI е read-only.
- Datastore-level update/delete prohibition **не е доказана**.
- Default RLS остава вторичната защита.
- Datastore hardening е **отложен**.

---

## 13. Backend Functions

Точен списък:

| Function | Отговорност |
|---|---|
| `registerJobDefinition` | Създава `JobDefinition`. Валидира `key` уникалност, `handlerKey` срещу статичния registry, отхвърля secret-looking schema keys. |
| `createJobSchedule` | Създава `JobSchedule`. Валидира scope/org консистентност, scheduleType полета, future `runAt`, `intervalSeconds >= 60`, изчислява `nextRunAt`. |
| `pauseJobSchedule` | Паузира график. Идемпотентен (`already_paused`). |
| `resumeJobSchedule` | Възобновява график. Отказва resume на cancelled. Запазва `nextRunAt`. |
| `cancelJobSchedule` | Нон-деструктивна отменка. Идемпотентен (`already_cancelled`). |
| `enqueueBackgroundJob` | Ръчно enqueue. Валидира scope/org, отхвърля secret payload keys, налага `deduplicationKey` uniqueness (function-level). |
| `cancelBackgroundJob` | Нон-деструктивна отмяна на job. Идемпотентен (`already_cancelled`). Отказва отмяна на terminal succeeded/dead_letter. |
| `runSchedulerTick` | Оценява due enabled schedules, прилага misfire policy, създава `BackgroundJob` с детерминистичен occurrence key. Super Admin/internal only. |
| `processBackgroundJobs` | Claim-ва due queued/expired-lease jobs, изпълнява статичния handler, пише attempts и audit events. Super Admin/internal only. |
| `getBackgroundJob` | Чете един job с payload/result redaction за developer/solution_architect. |
| `listBackgroundJobs` | Листинг с филтри по статус/scope. |
| `listJobSchedules` | Листинг на графици с payload redaction. |

---

## 14. Реална проверка на Deployed Functions

По време на стабилизацията:

- `runSchedulerTick` е изпълнен като **реална deployed backend function** (не репликирана логика).
- `processBackgroundJobs` е изпълнен като **реална deployed backend function**.
- Временното role widening (allow `admin`) е използвано **само защото** runtime role switching до `super_admin` не бе достъпно в build средата.
- След тестовете оригиналните role gates са **възстановени** до `super_admin`-only.
- Admin получава **403** и за двете функции след възстановяването (verified).

Ясно разграничение:

- **Runtime-verified** — пътища, упражнени срещу реалните deployed функции с реална identity/session (admin widening).
- **Code-inspection-verified** — пътища, валидирани чрез четене на сорса, където runtime role switching не е било достъпно.
- **Platform-operation limitation** — native scheduler invocation boundary (виж секция 15).

**Не се описват** replicated algorithm tests като deployed-function tests.

---

## 15. Native Scheduler — Класификация B

### Резултат

Класификация **B**:

- Base44 има automation/scheduled invocation механизъм.
- Автоматичните извиквания работят **без user context**.
- `runSchedulerTick` и `processBackgroundJobs` изискват разрешен invocation context (`base44.auth.me()` → потребител).
- Текущото автоматично извикване достига до **401** (no user).
- Границата между no-user automation invocation и защитените functions **не е решена** в рамките на Phase 8.
- Това е **deployment/operations задача**, а не липсваща queue/worker логика.

### Текущ режим

**External Scheduler Trigger Required**

UI и dashboard показват:

- EN: "External Scheduler Trigger Required"
- BG: "Необходим е външен тригер за планировчика"

**Не се твърди**:

- "Native Scheduler Active"
- автоматично background изпълнение
- че браузърен timer е заместител

### Бъдеща ops задача

- Machine/service identity за native Base44 automations.
- Безопасно удостоверяване на native automation.
- Invocation на `runSchedulerTick`.
- Invocation на `processBackgroundJobs`.
- Cadence **не по-бърз от веднъж в минута**.
- End-to-end operational verification.

Тази ops задача **не блокира** замразяването на референтната Phase 8 реализация.

---

## 16. Event Bus Integration

Event types (sourceType = `job` за всички):

- `job.definition_registered`
- `job.schedule_created`
- `job.schedule_paused`
- `job.schedule_resumed`
- `job.schedule_cancelled`
- `job.enqueued`
- `job.claimed`
- `job.started`
- `job.succeeded`
- `job.retry_scheduled`
- `job.dead_lettered`
- `job.cancelled`

За всички:

- `sourceType = job`
- `sourceId` е съответният definition, schedule или job id
- `payload` е **identifier/status-only**
- Няма job payload
- Няма result
- Няма lastError
- Няма stack trace
- Няма leaseOwner
- Няма credentials или tokens
- Publication е **best-effort**

Поведение:

- Zero subscribers **не блокират** job execution.
- При липса на matching subscription **няма** `EventDelivery`.
- Job Runtime **не извиква** `dispatchEvent`.
- Job Runtime **не извиква** `processEventDelivery`.
- Използва съществуващия `publishEvent` contract.
- **Не създава** `PlatformEvent` директно (през SDK service role).

---

## 17. Permission Model

### Developer

- Read visible metadata.
- No mutation.
- payload/result **redacted**.

### Solution Architect

- Read scheduling, retry и lease metadata.
- No mutation.

### Core Developer

- Register `JobDefinition`.
- Manage **platform** schedules.
- Read jobs.
- **Не управлява** organization schedules.

### Admin

- Manage **organization** schedules.
- Enqueue/cancel organization jobs.
- Read organization queue/history.
- **Не register-ва** `JobDefinition`.
- **Не управлява** platform schedules.
- **Не invoke-ва** scheduler/worker internals.

### Super Admin

- Full access.
- Може ръчно да invoke-ва scheduler и worker functions.

### Метод на проверка за всяка роля

- **Runtime verified** — където е използвана реална identity/session (admin widening по време на стабилизация).
- **Code inspection** — където runtime role switching не е било достъпно.

### Финален gate

- `runSchedulerTick` → Super Admin/internal only.
- `processBackgroundJobs` → Super Admin/internal only.
- Admin → **403** (verified post-restore).

---

## 18. UI, Dashboard и i18n

### Налични изгледи

- Job Definitions
- Job Schedules
- Job Schedule Detail
- Background Job Queue
- Job History
- Dead Letter Queue
- Background Job Detail

### UI гаранции

- Attempts са **read-only**.
- Audit timeline е **read-only**.
- payload/result се редактират според permission contract.
- Lease expiry и retry time се показват.
- Няма arbitrary handler input.
- Няма cron editor.
- Няма external API test.
- Няма workflow action.
- Няма connector action.
- Няма plugin action.

### Dashboard counters

- Job Definitions
- Enabled Schedules
- Queued + Retry-Wait Jobs
- Leased + Running Jobs
- Dead-Letter Jobs

### Scheduler mode

**External Scheduler Trigger Required**

### i18n паритет

EN / BG / DE / ES — translation parity поддържана.

### Българска терминология

| EN | BG |
|---|---|
| Scheduler | Планировчик на задачи |
| Background Job Runtime | Механизъм за фонови задачи |
| Job Definition | Дефиниция на задача |
| Job Schedule | График на задача |
| Background Job | Фонова задача |
| Job Attempt | Опит за изпълнение |
| Job Queue | Опашка със задачи |
| Dead Letter Queue | Изолирани задачи |

---

## 19. Security Contract

### Recursive rejection на secret-looking keys и executable-looking values

Secret-looking ключове (отхвърляни рекурсивно в payload/result/schema):

- `password`
- `passwd`
- `secret`
- `token`
- `access_token`
- `refresh_token`
- `api_key`
- `apiKey`
- `client_secret`
- `private_key`
- `credential`
- `authorization`
- `cookie`
- `session`

### Допълнителни гаранции

- payload/result **не се публикуват** в Event Bus.
- payload/result **не се записват** в audit metadata.
- Stack traces **не се съхраняват**.
- Batch summaries връщат **само counts и identifiers**.
- `JobAttempt` не съхранява payload/result.

---

## 20. Връзка с предишните фази

Потвърждение:

- Phase 2 Lifecycle Engine е **непроменена**.
- Phase 3 Event Bus contract е **непроменен**.
- Phase 4 Delivery Runtime е **непроменен**.
- Phase 5 Plugin Engine е **непроменена**.
- Phase 6 Connector Engine е **непроменена**.
- Phase 7 Workflow Engine е **непроменена**.

### Reserved resourceType стойности

- `job_definition`
- `job_schedule`
- `background_job`

### Няма

- Automatic lifecycle definitions / bindings.
- Workflow start / progression.
- Connector execution.
- Plugin execution.
- Credential resolution.
- External API calls.

---

## 21. Verification Record

### Scheduler

- Zero due schedules → processed 0.
- Future once schedule → не се enqueue.
- Due once schedule → enqueue + disable.
- Повторен tick без duplicate occurrence.
- Interval schedule → enqueue + advance `nextRunAt`.
- Misfire `skip` (overdue) → 0 jobs + advance.
- Misfire `run_once` (overdue) → 1 job + advance.
- `maxRuns` → деактивация.
- `endAt` → деактивация.
- Paused/cancelled schedule → игнорирани.

### Worker

- `queued → leased → running → succeeded`.
- `JobAttempt` creation.
- Safe health-check result `{ok, executedAt, jobId, attemptNumber}`.
- Batch ordering (priority desc, availableAt asc, createdAt asc).
- Batch-size bounds (default 10, max 50).
- Future `availableAt` → не се claim-ва преди време.
- Unexpired lease → изключен от reclaim.
- Expired lease recovery → нов attempt, предишен `abandoned`.
- `retry_wait` с backoff.
- No early retry (предишен `availableAt` не се прескоча в същия batch).
- `dead_letter` при изчерпани опити.
- Cancel queued → `cancelled`.
- Repeated cancellation → `already_cancelled`.
- Running cancellation rejection (terminal protection).
- Terminal preservation (succeeded/dead_letter не се изтриват).

### Guards

- Definition validation (key uniqueness, handlerKey, secret schema).
- Schedule validation (scope/org, future runAt, interval ≥ 60, misfirePolicy).
- Payload safety (recursive secret-key rejection).
- Retry policy bounds (maxAttempts, backoff, delays).
- Scope boundaries (platform vs organization).
- Organization isolation.
- Duplicate checks (deduplicationKey function-level).
- Role gates (admin → 403 за tick/worker).
- Event Bus safety (identifier/status-only payloads).
- Audit safety (no payload/result/stack-trace in metadata).
- UI redaction (payload/result за developer/solution_architect).

---

## 22. Cleanup

Потвърдени финални стойности:

- `JobDefinition` test records = **0**
- `JobSchedule` test records = **0**
- `BackgroundJob` test records = **0**
- `JobAttempt` test records = **0**
- `JobExecutionEvent` test records = **0**
- test `PlatformEvent`s = **0** (70-те тестови PlatformEvents са **премахнати**)
- `EventDelivery` records = **0** (zero subscribers)
- temporary `EventSubscription`s = **0**
- temporary stabilization handlers = **0**

Потвърждение:

- Временното role widening е **премахнато**.
- Admin отново получава **403** за tick и worker.
- Static handler registry съдържа **само** `system.health_check`.

---

## 23. Известни ограничения

- Native scheduler invocation boundary **не е operationally wired**.
- **External scheduler trigger е необходим**.
- Няма exactly-once guarantee.
- Claim **не е datastore-atomic**.
- Конкурентни worker-и могат да се състезават.
- Deduplication е **function-logic-only**.
- Няма store-level uniqueness.
- Audit append-only е **function-layer contract**.
- Няма distributed locking.
- Няма cooperative cancellation на running jobs.
- Няма cron.
- Няма timezone/calendar scheduling.
- Няма workflow handlers.
- Няма connector handlers.
- Няма plugin handlers.
- Няма arbitrary code.
- Няма external API calls.

---

## 24. Отложени задачи

### Operations

- Machine/service identity за native Base44 automations.
- Scheduler/worker trigger wiring.
- Operational cadence (не по-бърз от веднъж в минута).
- Автоматичен health-check end-to-end test.

### Security / Data Hardening

- Atomic claim / compare-and-swap.
- Datastore uniqueness.
- Datastore append-only audit protection.
- Organization row isolation.
- Distributed locking.

### Product / RBAC

- Бъдеща `member` роля преди отваряне към обикновени крайни потребители.

### Изрично

- `member` ролята **не е част от Phase 8**.
- Ops trigger wiring **не блокира** Phase 8 reference freeze.

---

## 25. Frozen Guarantees

- Scheduler Runtime създава **декларативни** `BackgroundJob`s.
- Поддържат се `once` и `interval` графици.
- Всички schedule timestamps са **UTC**.
- Static handler registry е **Core-controlled**.
- Финалният registry съдържа **само** `system.health_check`.
- Няма arbitrary handler execution.
- Няма automatic workflow execution.
- Няма connector или plugin execution.
- Retry е **bounded**.
- Dead-letter jobs се **запазват**.
- Job history и attempts са **non-destructive** през runtime функциите.
- Runtime audit е **create-only** през функциите.
- Event payloads не съдържат job payload/result/secrets.
- Worker semantics са **at-least-once**.
- **Exactly-once не се гарантира**.
- Native scheduler **не се счита за активен**.
- **External scheduler trigger е необходим**.
- Фаза 8 е **стабилна platform reference implementation**.

---

## Финал

Този snapshot е документация-only. Не променя код, поведение, entities, backend functions, permissions, handler registry, UI, routing, navigation, dashboard, Event Bus, или поведението на scheduler/worker runtime.

Phase 8 Scheduler and Background Job Runtime е **FROZEN** като стабилна platform reference implementation.

> Изчаква се потвърждение за архивиране.