// PGP Core domain verification — dependency-free.
// Uses only node:assert/strict. No network, database, env, Base44, Supabase,
// filesystem, or external packages. Prints a single deterministic summary
// line on success and exits non-zero on any failure.

import assert from "node:assert/strict";
import {
  validateWorkflowGraph,
  buildOccurrenceKey,
  evaluateScheduleOccurrence,
  calculateRetryDelay,
  decideFailedJobTransition,
  containsSecretKey,
  redactSecretKeys,
  sanitizeErrorText,
} from "../src/index.js";

let assertions = 0;
function check(label, fn) {
  fn();
  assertions++;
}
function ok(v, msg) {
  assert.ok(v, msg);
  assertions++;
}
function eq(a, b, msg) {
  assert.deepEqual(a, b, msg);
  assertions++;
}
function isErr(result, errorText, msg) {
  eq(result, { ok: false, error: errorText }, msg);
}

// ---------------------------------------------------------------------------
// WORKFLOW GRAPH
// ---------------------------------------------------------------------------

check("workflow: valid start → manual → end", () => {
  eq(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "m", type: "manual" }, { key: "e", type: "end" }],
    edges: [{ from: "s", to: "m" }, { from: "m", to: "e" }],
  }), { ok: true });
});

check("workflow: invalid graph type (array)", () => {
  isErr(validateWorkflowGraph([]), "graph must be an object");
});

check("workflow: invalid graph type (primitive)", () => {
  isErr(validateWorkflowGraph("x"), "graph must be an object");
});

check("workflow: null graph", () => {
  isErr(validateWorkflowGraph(null), "graph must be an object");
});

check("workflow: missing nodes array", () => {
  isErr(validateWorkflowGraph({ edges: [] }), "graph requires nodes and edges arrays");
});

check("workflow: missing edges array", () => {
  isErr(validateWorkflowGraph({ nodes: [] }), "graph requires nodes and edges arrays");
});

check("workflow: empty nodes", () => {
  isErr(validateWorkflowGraph({ nodes: [], edges: [] }), "graph must contain at least one node");
});

check("workflow: invalid node (non-object)", () => {
  isErr(validateWorkflowGraph({ nodes: ["x"], edges: [] }), "invalid node");
});

check("workflow: missing node key", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ type: "start" }],
    edges: [],
  }), "node key is required");
});

check("workflow: duplicate node key", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "s", type: "end" }],
    edges: [],
  }), "duplicate node key: s");
});

check("workflow: missing node type", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s" }],
    edges: [],
  }), "node type is required");
});

check("workflow: unsupported node type", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "decision" }],
    edges: [],
  }), "unsupported node type: decision");
});

check("workflow: multiple starts", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s1", type: "start" }, { key: "s2", type: "start" }, { key: "e", type: "end" }],
    edges: [{ from: "s1", to: "e" }],
  }), "graph must contain exactly one start node");
});

check("workflow: missing end", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }],
    edges: [],
  }), "graph must contain at least one end node");
});

check("workflow: invalid edge (non-object)", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "e", type: "end" }],
    edges: ["x"],
  }), "invalid edge");
});

check("workflow: edge missing from/to", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "e", type: "end" }],
    edges: [{ from: "s" }],
  }), "edge from/to are required");
});

check("workflow: edge references unknown node", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "e", type: "end" }],
    edges: [{ from: "s", to: "x" }],
  }), "edge references unknown node");
});

check("workflow: duplicate edge with same label", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "m", type: "manual" }, { key: "e", type: "end" }],
    edges: [{ from: "m", to: "e", label: "ok" }, { from: "m", to: "e", label: "ok" }],
  }), "duplicate edge: m->e");
});

// Open contract reconciliation item — no behavior change in Wave 10.3A.
// Deployed code identity includes label; two edges with same (from,to) but
// DIFFERENT labels are accepted by deployed code (not flagged as duplicate).
// Frozen Phase 7 spec treats repeated (from,to) as duplicate regardless of
// label. Package follows deployed behavior; discrepancy documented in README.
check("workflow: duplicate from/to with different labels (deployed behavior — accepted)", () => {
  // This graph is valid under deployed semantics: edges differ by label.
  // (s has an outgoing edge to m, so "node s has no outgoing edges" does not fire.)
  eq(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "m", type: "manual" }, { key: "e", type: "end" }],
    edges: [
      { from: "s", to: "m" },
      { from: "m", to: "e", label: "ok" },
      { from: "m", to: "e", label: "fail" },
    ],
  }), { ok: true });
});

check("workflow: incoming edge to start", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "m", type: "manual" }, { key: "e", type: "end" }],
    edges: [{ from: "s", to: "m" }, { from: "m", to: "s" }, { from: "m", to: "e" }],
  }), "start node cannot have incoming edges");
});

check("workflow: outgoing edge from end", () => {
  // Isolate the end-outgoing check: edge e->e has no incoming to start,
  // so the earlier "start node cannot have incoming edges" guard does not fire.
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "e", type: "end" }],
    edges: [{ from: "s", to: "e" }, { from: "e", to: "e" }],
  }), "end nodes cannot have outgoing edges");
});

check("workflow: non-end node missing outgoing edge", () => {
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "m", type: "manual" }, { key: "e", type: "end" }],
    edges: [{ from: "s", to: "e" }],
  }), "node m has no outgoing edges");
});

check("workflow: unreachable node", () => {
  // Isolate reachability: x has an outgoing self-loop so the earlier
  // "node x has no outgoing edges" guard passes, leaving x unreachable from start.
  isErr(validateWorkflowGraph({
    nodes: [{ key: "s", type: "start" }, { key: "e", type: "end" }, { key: "x", type: "manual" }],
    edges: [{ from: "s", to: "e" }, { from: "x", to: "x" }],
  }), "unreachable node: x");
});

check("workflow: cycle", () => {
  isErr(validateWorkflowGraph({
    nodes: [
      { key: "s", type: "start" },
      { key: "m", type: "manual" },
      { key: "e", type: "end" },
    ],
    edges: [
      { from: "s", to: "m" },
      { from: "m", to: "m" },
      { from: "m", to: "e" },
    ],
  }), "graph must not contain cycles");
});

check("workflow: executable-looking configuration (eval)", () => {
  isErr(validateWorkflowGraph({
    nodes: [
      { key: "s", type: "start" },
      { key: "e", type: "end" },
    ],
    edges: [{ from: "s", to: "e" }],
    config: "eval(steal)",
  }), "graph contains executable-looking values");
});

// ---------------------------------------------------------------------------
// SCHEDULER
// ---------------------------------------------------------------------------

check("scheduling: exact occurrence key", () => {
  eq(buildOccurrenceKey("sched-1", "2026-07-19T00:00:00.000Z"), "sched-1:2026-07-19T00:00:00.000Z");
});

check("scheduling: once / new occurrence → create + disable", () => {
  const schedule = { id: "s1", scheduleType: "once", nextRunAt: "2026-07-19T00:00:00.000Z" };
  const r = evaluateScheduleOccurrence({ schedule, nowIso: "2026-07-19T00:00:01.000Z", alreadyEnqueued: false });
  eq(r.scheduledFor, "2026-07-19T00:00:00.000Z");
  eq(r.occurrenceKey, "s1:2026-07-19T00:00:00.000Z");
  eq(r.createJob, true);
  eq(r.nextRunAt, null);
  eq(r.disableAfter, true);
  eq(r.runCountDelta, 1);
});

check("scheduling: once / already enqueued → skip + disable", () => {
  const schedule = { id: "s1", scheduleType: "once", nextRunAt: "2026-07-19T00:00:00.000Z" };
  const r = evaluateScheduleOccurrence({ schedule, nowIso: "2026-07-19T00:00:01.000Z", alreadyEnqueued: true });
  eq(r.createJob, false);
  eq(r.disableAfter, true);
  eq(r.nextRunAt, null);
  eq(r.runCountDelta, 0);
});

check("scheduling: interval skip / not overdue → create + advance", () => {
  const schedule = {
    id: "s2", scheduleType: "interval", intervalSeconds: 60,
    misfirePolicy: "skip", nextRunAt: "2026-07-19T00:00:00.000Z",
    runCount: 0,
  };
  const r = evaluateScheduleOccurrence({ schedule, nowIso: "2026-07-19T00:00:01.000Z", alreadyEnqueued: false });
  eq(r.createJob, true);
  eq(r.nextRunAt, "2026-07-19T00:01:00.000Z");
  eq(r.disableAfter, false);
  eq(r.runCountDelta, 1);
});

check("scheduling: interval skip / overdue → skip + advance", () => {
  const schedule = {
    id: "s2", scheduleType: "interval", intervalSeconds: 60,
    misfirePolicy: "skip", nextRunAt: "2026-07-19T00:00:00.000Z",
    runCount: 0,
  };
  const r = evaluateScheduleOccurrence({ schedule, nowIso: "2026-07-19T00:02:01.000Z", alreadyEnqueued: false });
  eq(r.createJob, false);
  eq(r.nextRunAt, "2026-07-19T00:03:00.000Z");
  eq(r.disableAfter, false);
  eq(r.runCountDelta, 0);
});

check("scheduling: interval run_once / overdue → create + advance", () => {
  const schedule = {
    id: "s3", scheduleType: "interval", intervalSeconds: 60,
    misfirePolicy: "run_once", nextRunAt: "2026-07-19T00:00:00.000Z",
    runCount: 0,
  };
  const r = evaluateScheduleOccurrence({ schedule, nowIso: "2026-07-19T00:05:00.000Z", alreadyEnqueued: false });
  eq(r.createJob, true);
  eq(r.nextRunAt, "2026-07-19T00:06:00.000Z");
  eq(r.runCountDelta, 1);
});

check("scheduling: first future occurrence advance", () => {
  const schedule = {
    id: "s4", scheduleType: "interval", intervalSeconds: 300,
    misfirePolicy: "run_once", nextRunAt: "2026-07-19T00:00:00.000Z",
    runCount: 0,
  };
  const r = evaluateScheduleOccurrence({ schedule, nowIso: "2026-07-19T00:07:30.000Z", alreadyEnqueued: false });
  eq(r.nextRunAt, "2026-07-19T00:10:00.000Z");
});

check("scheduling: maxRuns terminal disable", () => {
  const schedule = {
    id: "s5", scheduleType: "interval", intervalSeconds: 60,
    misfirePolicy: "run_once", nextRunAt: "2026-07-19T00:00:00.000Z",
    runCount: 9, maxRuns: 10,
  };
  const r = evaluateScheduleOccurrence({ schedule, nowIso: "2026-07-19T00:00:01.000Z", alreadyEnqueued: false });
  // runCount(9) + createJob(1) = 10 >= maxRuns(10) → disable
  eq(r.createJob, true);
  eq(r.disableAfter, true);
  eq(r.nextRunAt, null);
});

check("scheduling: endAt terminal disable", () => {
  const schedule = {
    id: "s6", scheduleType: "interval", intervalSeconds: 60,
    misfirePolicy: "run_once", nextRunAt: "2026-07-19T00:00:00.000Z",
    runCount: 0, endAt: "2026-07-19T00:01:30.000Z",
  };
  const r = evaluateScheduleOccurrence({ schedule, nowIso: "2026-07-19T00:00:01.000Z", alreadyEnqueued: false });
  // nextRunAt = 00:01:00 which is <= endAt 00:01:30 → not disabled here
  // Force nextRunAt past endAt with a later now:
  const r2 = evaluateScheduleOccurrence({
    schedule: { ...schedule, nextRunAt: "2026-07-19T00:01:00.000Z", runCount: 5 },
    nowIso: "2026-07-19T00:01:31.000Z", alreadyEnqueued: false,
  });
  eq(r2.disableAfter, true);
  eq(r2.nextRunAt, null);
});

check("scheduling: input object remains unchanged", () => {
  const schedule = {
    id: "s7", scheduleType: "interval", intervalSeconds: 60,
    misfirePolicy: "run_once", nextRunAt: "2026-07-19T00:00:00.000Z",
    runCount: 3, maxRuns: 10,
  };
  const snapshot = JSON.parse(JSON.stringify(schedule));
  evaluateScheduleOccurrence({ schedule, nowIso: "2026-07-19T00:00:05.000Z", alreadyEnqueued: false });
  eq(schedule, snapshot, "schedule must not be mutated");
});

// ---------------------------------------------------------------------------
// BACKGROUND JOB
// ---------------------------------------------------------------------------

check("background: no retry policy → 0 delay", () => {
  eq(calculateRetryDelay(null, 1), 0);
  eq(calculateRetryDelay(undefined, 1), 0);
});

check("background: none backoff → 0", () => {
  eq(calculateRetryDelay({ backoffType: "none", baseDelaySeconds: 5, maxDelaySeconds: 100 }, 1), 0);
  eq(calculateRetryDelay({ baseDelaySeconds: 5, maxDelaySeconds: 100 }, 1), 0);
});

check("background: fixed backoff → base", () => {
  eq(calculateRetryDelay({ backoffType: "fixed", baseDelaySeconds: 7, maxDelaySeconds: 100 }, 1), 7);
  eq(calculateRetryDelay({ backoffType: "fixed", baseDelaySeconds: 7, maxDelaySeconds: 100 }, 3), 7);
});

check("background: exponential backoff", () => {
  // base * 2^(attempt-1)
  eq(calculateRetryDelay({ backoffType: "exponential", baseDelaySeconds: 10, maxDelaySeconds: 1000 }, 1), 10);
  eq(calculateRetryDelay({ backoffType: "exponential", baseDelaySeconds: 10, maxDelaySeconds: 1000 }, 2), 20);
  eq(calculateRetryDelay({ backoffType: "exponential", baseDelaySeconds: 10, maxDelaySeconds: 1000 }, 3), 40);
});

check("background: capped exponential backoff", () => {
  eq(calculateRetryDelay({ backoffType: "exponential", baseDelaySeconds: 10, maxDelaySeconds: 50 }, 5), 50);
  eq(calculateRetryDelay({ backoffType: "exponential", baseDelaySeconds: 10, maxDelaySeconds: 30 }, 10), 30);
});

check("background: retry_wait decision", () => {
  const r = decideFailedJobTransition({
    attemptNumber: 1, maxAttempts: 3,
    retryPolicy: { backoffType: "fixed", baseDelaySeconds: 10, maxDelaySeconds: 100 },
    nowIso: "2026-07-19T00:00:00.000Z",
  });
  eq(r.status, "retry_wait");
  eq(r.delaySeconds, 10);
  eq(r.availableAt, "2026-07-19T00:00:10.000Z");
});

check("background: dead_letter decision when attempts exhausted", () => {
  const r = decideFailedJobTransition({
    attemptNumber: 3, maxAttempts: 3,
    retryPolicy: { backoffType: "fixed", baseDelaySeconds: 10, maxDelaySeconds: 100 },
    nowIso: "2026-07-19T00:00:00.000Z",
  });
  eq(r.status, "dead_letter");
  eq(r.deadLetteredAt, "2026-07-19T00:00:00.000Z");
});

check("background: explicit nowIso respected", () => {
  const r = decideFailedJobTransition({
    attemptNumber: 2, maxAttempts: 5,
    retryPolicy: { backoffType: "exponential", baseDelaySeconds: 2, maxDelaySeconds: 100 },
    nowIso: "2026-07-19T12:00:00.000Z",
  });
  eq(r.delaySeconds, 4);
  eq(r.availableAt, "2026-07-19T12:00:04.000Z");
});

check("background: input remains unchanged", () => {
  const input = {
    attemptNumber: 1, maxAttempts: 3,
    retryPolicy: { backoffType: "fixed", baseDelaySeconds: 10, maxDelaySeconds: 100 },
    nowIso: "2026-07-19T00:00:00.000Z",
  };
  const snapshot = JSON.parse(JSON.stringify(input));
  decideFailedJobTransition(input);
  eq(input, snapshot, "input must not be mutated");
});

// ---------------------------------------------------------------------------
// SAFE DATA
// ---------------------------------------------------------------------------

check("safe: secret detection (top-level)", () => {
  ok(containsSecretKey({ password: "x" }));
  ok(containsSecretKey({ api_key: "x" }));
  ok(containsSecretKey({ Authorization: "x" }));
});

check("safe: safe object → false", () => {
  ok(!containsSecretKey({ name: "x", count: 3 }));
  ok(!containsSecretKey({}));
  ok(!containsSecretKey(null));
  ok(!containsSecretKey("plain"));
  ok(!containsSecretKey(42));
});

check("safe: nested secret detection", () => {
  ok(containsSecretKey({ meta: { token: "abc" } }));
  ok(containsSecretKey({ list: [{ session: "x" }] }));
});

check("safe: nested redaction", () => {
  const r = redactSecretKeys({ a: 1, meta: { token: "abc", name: "x" } });
  eq(r, { a: 1, meta: { token: "[redacted]", name: "x" } });
});

check("safe: array redaction", () => {
  const r = redactSecretKeys([{ password: "p", label: "ok" }, { name: "y" }]);
  eq(r, [{ password: "[redacted]", label: "ok" }, { name: "y" }]);
});

check("safe: Bearer masking", () => {
  // Deployed behavior: SECRET_TEXT_KEY matches "Authorization: Bearer" (value
  // captures "Bearer" up to the space), so "abc123" remains after redaction.
  eq(sanitizeErrorText("Authorization: Bearer abc123"), "Authorization=[redacted] abc123");
  eq(sanitizeErrorText("token Bearer xyz"), "token Bearer [redacted]");
});

check("safe: key=value masking", () => {
  eq(sanitizeErrorText("password=secret123 failed"), "password=[redacted] failed");
});

check("safe: key:value masking", () => {
  eq(sanitizeErrorText("api_key: mykey, then failed"), "api_key=[redacted], then failed");
});

check("safe: 500-character cap", () => {
  const long = "x".repeat(800);
  const out = sanitizeErrorText(long);
  eq(out.length, 500);
});

check("safe: non-string message coerced", () => {
  // Deployed: String(msg || "") — null and undefined both become "".
  eq(sanitizeErrorText(null), "");
  eq(sanitizeErrorText(undefined), "");
  eq(sanitizeErrorText(42), "42");
  eq(sanitizeErrorText(0), "");
});

check("safe: source object remains unchanged", () => {
  const src = { meta: { token: "abc", name: "x" }, list: [{ password: "p" }] };
  const snapshot = JSON.parse(JSON.stringify(src));
  containsSecretKey(src);
  redactSecretKeys(src);
  eq(src, snapshot, "source must not be mutated");
});

// ---------------------------------------------------------------------------
console.log(`PGP Core domain verification passed: ${assertions} assertions.`);