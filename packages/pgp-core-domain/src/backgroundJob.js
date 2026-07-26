// PGP Core — Background Job Domain (provider-independent)
// Behavioral parity with deployed Base44 function:
//   processBackgroundJobs/entry.ts (retryDelay + retry/dead-letter decision)
// Pure: no Base44, no Deno, no Supabase, no datastore, no network, no env,
// no implicit current time (nowIso is explicit input), no side effects,
// no input mutation, no lease/handler execution.

export function calculateRetryDelay(retryPolicy, attemptNumber) {
  if (!retryPolicy) return 0;
  const bt = retryPolicy.backoffType || "none";
  const base = Number(retryPolicy.baseDelaySeconds || 0);
  const maxd = Number(retryPolicy.maxDelaySeconds || 0);
  if (bt === "none") return 0;
  if (bt === "fixed") return base;
  // exponential
  const d = Math.min(maxd, base * Math.pow(2, Math.max(0, attemptNumber - 1)));
  return d;
}

export function decideFailedJobTransition(input) {
  const attemptNumber = input.attemptNumber;
  const maxAttempts = input.maxAttempts;
  const retryPolicy = input.retryPolicy;
  const nowIso = input.nowIso;

  if (attemptNumber < maxAttempts) {
    const delay = calculateRetryDelay(retryPolicy, attemptNumber);
    const nowMs = new Date(nowIso).getTime();
    const availableAt = new Date(nowMs + delay * 1000).toISOString();
    return {
      status: "retry_wait",
      delaySeconds: delay,
      availableAt,
    };
  }
  return {
    status: "dead_letter",
    deadLetteredAt: nowIso,
  };
}