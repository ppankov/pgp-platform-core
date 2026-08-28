// PGP Core — Job Scheduling Domain (provider-independent)
// Behavioral parity with deployed Base44 function:
//   runSchedulerTick/entry.ts (occurrence key + once/interval decision)
// Pure: no Base44, no Deno, no Supabase, no datastore, no network, no env,
// no implicit current time (nowIso is explicit input), no side effects,
// no input mutation. UTC timestamps derived deterministically from inputs.

export function buildOccurrenceKey(scheduleId, scheduledForUtcIso) {
  return scheduleId + ":" + scheduledForUtcIso;
}

export function evaluateScheduleOccurrence(input) {
  const schedule = input.schedule;
  const nowIso = input.nowIso;
  const alreadyEnqueued = !!input.alreadyEnqueued;

  const scheduledFor = schedule.nextRunAt;
  const occurrenceKey = schedule.id + ":" + scheduledFor;

  let createJob = false;
  let newNextRunAt = null;
  let disableAfter = false;

  if (schedule.scheduleType === "once") {
    createJob = !alreadyEnqueued;
    disableAfter = true; // once schedules disable after their slot is handled.
    newNextRunAt = null;
  } else {
    const nowMs = new Date(nowIso).getTime();
    const intervalMs = (schedule.intervalSeconds || 60) * 1000;
    const overdue = (nowMs - new Date(scheduledFor).getTime()) > intervalMs;
    if (schedule.misfirePolicy === "skip") {
      if (overdue) { createJob = false; }
      else { createJob = !alreadyEnqueued; }
    } else {
      // run_once: create at most one job for the missed period.
      createJob = !alreadyEnqueued;
    }
    // Advance nextRunAt to the first future occurrence.
    let next = new Date(scheduledFor).getTime() + intervalMs;
    while (next <= nowMs) { next += intervalMs; }
    newNextRunAt = new Date(next).toISOString();

    // Terminal conditions for interval.
    if (schedule.maxRuns && (schedule.runCount + (createJob ? 1 : 0)) >= schedule.maxRuns) disableAfter = true;
    if (schedule.endAt && newNextRunAt && new Date(newNextRunAt).getTime() > new Date(schedule.endAt).getTime()) disableAfter = true;
  }

  const runCountDelta = createJob ? 1 : 0;

  return {
    scheduledFor,
    occurrenceKey,
    createJob,
    nextRunAt: disableAfter ? null : newNextRunAt,
    disableAfter,
    runCountDelta,
  };
}