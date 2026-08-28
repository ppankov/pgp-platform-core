# @ppankov/pgp-core-domain

Provider-independent PGP Core domain rules. Pure, side-effect-free.

## Purpose

This package is the **first provider-independent domain layer** of PGP Core,
extracted as a standalone source workspace. It contains the pure decision,
validation, calculation, and sanitization rules that previously lived inline
inside deployed Base44 backend functions. The package has **no Base44
dependency and no Supabase dependency** — it is plain standard ESM JavaScript
that can be consumed by any runtime that supports ES modules (Base44 Deno
functions via `npm:`, Supabase Edge Functions, Node, etc.).

## Status

- **Package name:** `@ppankov/pgp-core-domain` (public package under the
  `@ppankov` npm scope).
- **Exact version:** `0.1.0-alpha.1` (alpha prerelease tag).
- **Publication status:** **PUBLISHED** to the public npm registry with public
  access (`publishConfig.access: public`). Published by npm account `ppankov`
  with auth-and-writes 2FA / WebAuthn.
- **Integration status:** Integrated into the four production Base44 backend
  functions in Wave 10.3B via exact-version `npm:` imports. Before Wave 10.3B
  completed, the package was not imported by any deployed function.
- **Local verification:** 150 assertions PASS (`npm test`).
- **No npm credentials belong in Base44.** The package is authored and
  published from the repository owner's environment, not from the Base44 app.
  No npm token is requested, created, or stored in Base44.

## Purity contract

Every file in `src/` is provider-independent. Forbidden inside the package:

- `@base44/sdk` or any Base44 API
- Deno APIs (`Deno.serve`, `Deno.env`, …)
- Supabase or any database client
- React or any browser API
- Node-specific APIs (fs, net, crypto.randomUUID, …)
- `fetch` / network
- filesystem access
- environment variables
- authentication / authorization
- audit writes / event publication
- random UUID generation
- implicit current time (`Date.now()`, `new Date()` with no arg)

Time-dependent functions accept an explicit `nowIso` (ISO 8601 UTC string) or
`nowMs` (epoch millis) input. Deterministic `Date` conversions are allowed
**only over explicit input timestamps**.

All exported functions:
- do not mutate their inputs;
- have no side effects;
- return plain serializable data;
- preserve the current deployed behavior (no latent-bug fixes in this wave).

## Modules

| Module | Exports |
| --- | --- |
| `workflowGraph.js` | `validateWorkflowGraph(graph)` |
| `jobScheduling.js` | `buildOccurrenceKey(scheduleId, scheduledForUtcIso)`, `evaluateScheduleOccurrence(input)` |
| `backgroundJob.js` | `calculateRetryDelay(retryPolicy, attemptNumber)`, `decideFailedJobTransition(input)` |
| `safeData.js` | `containsSecretKey(value)`, `redactSecretKeys(value)`, `sanitizeErrorText(message)` |

## Public exports (subpath imports)

| Import path | Resolves to |
| --- | --- |
| `@ppankov/pgp-core-domain` | `src/index.js` (re-exports all) |
| `@ppankov/pgp-core-domain/workflow` | `src/workflowGraph.js` |
| `@ppankov/pgp-core-domain/scheduling` | `src/jobScheduling.js` |
| `@ppankov/pgp-core-domain/background-job` | `src/backgroundJob.js` |
| `@ppankov/pgp-core-domain/safe-data` | `src/safeData.js` |

## Version pinning (REQUIRED)

Consumers **must pin an exact version**. Floating imports are NOT permitted:

```js
import { validateWorkflowGraph } from "npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/workflow";
import { buildOccurrenceKey, evaluateScheduleOccurrence } from "npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/scheduling";
import { calculateRetryDelay, decideFailedJobTransition } from "npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/background-job";
import { containsSecretKey, redactSecretKeys, sanitizeErrorText } from "npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/safe-data";
```

The following are **NOT allowed**:
- `npm:@ppankov/pgp-core-domain@latest/...`
- `npm:@ppankov/pgp-core-domain@alpha/...` (floating alpha tag)
- version ranges (`^0.1.0-alpha.1`, `~0.1.0-alpha.1`)
- unversioned imports

A newer or floating version is **never** an emergency workaround. On
integration regression, restore the pre-integration inline logic instead.

## Behavioral parity

The package is a behavioral mirror of the deployed functions (before Wave
10.3B integration):

- `validateWorkflowGraph` ← `registerWorkflowVersion/entry.ts` and
  `releaseWorkflowVersion/entry.ts` (identical inline `validateGraph`).
- `evaluateScheduleOccurrence` / `buildOccurrenceKey` ←
  `runSchedulerTick/entry.ts` (occurrence key + once/interval decision).
- `calculateRetryDelay` / `decideFailedJobTransition` ←
  `processBackgroundJobs/entry.ts` (retry delay + retry/dead-letter decision).
- `containsSecretKey` / `redactSecretKeys` / `sanitizeErrorText` ←
  `processBackgroundJobs/entry.ts` (secret detection / redaction / error text
  sanitization).

## Contract discrepancy findings (Open reconciliation items — NO behavior
change)

### Duplicate edge identity (workflow graph)

- **Deployed code identity:** `from + "|" + to + "|" + label` — the edge
  `label` **participates** in duplicate detection. Two edges with the same
  `(from, to)` but **different** labels are accepted as distinct edges.
- **Frozen Phase 7 spec identity:** repeated `(from, to)` pair — the label
  does **not** participate; any repeated `(from, to)` pair is a duplicate.

The package follows **deployed behavior** to guarantee no runtime semantic
change when the package is integrated. The frozen-spec discrepancy is
recorded as an open reconciliation item and must be resolved by an explicit
decision in a future wave (not by a silent behavior change here).

## Verification

```sh
cd packages/pgp-core-domain
npm test
```

The test (`test/verify.mjs`) is fully self-contained: it uses only
`node:assert/strict`, no network, no database, no environment variables, no
Base44, no Supabase, no filesystem, no external packages. It prints a single
deterministic summary line on success:

```
PGP Core domain verification passed: 150 assertions.
```

and exits non-zero on any failure. The published `0.1.0-alpha.1` release
passed 150 assertions locally before publication.

## Future reuse

- **Supabase Edge Functions** may import this package directly (it is plain
  ESM with no Base44 or Deno coupling). Supabase implementation is **not
  started** — there is no Supabase client, no migration, no dual-runtime
  behavior in this package or in the app. The package is structured to enable
  this reuse without changes.
- **Base44 Deno functions** import it via the `npm:` specifier. This is the
  integration target satisfied by Wave 10.3B.

## Rollback

To undo Wave 10.3B: restore the four production functions to their exact
pre-Wave-10.3B inline logic. The published npm package stays intact (do NOT
unpublish). Remove the temporary probe if present. Document the failure.

To undo Wave 10.3A: delete the `packages/pgp-core-domain/` directory and the
corresponding "Wave 10.3A" section in
`src/docs/PHASE_10_PORTABILITY_SPEC.md`.

## License

UNLICENSED — internal PGP Core package.