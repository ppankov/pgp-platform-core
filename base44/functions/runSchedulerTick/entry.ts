import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduler and Background Job Runtime — runSchedulerTick
// Super Admin manual invocation (or future native scheduler) only. Accepts no handler.
// Selects due enabled schedules, applies misfire policy, creates jobs using deterministic
// occurrence keys (<scheduleId>:<scheduledForUtcIso>), updates runCount/lastScheduledFor/
// lastEnqueuedAt/nextRunAt, disables once schedules and schedules reaching maxRuns/endAt.
// Repeated execution is idempotent per occurrence.

async function audit(base44, ev) {
  try { await base44.asServiceRole.entities.JobExecutionEvent.create({ ...ev, createdAt: new Date().toISOString() }); } catch (e) {}
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "super_admin") {
      return Response.json({ error: "Not permitted to invoke the scheduler tick" }, { status: 403 });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const defCache = new Map();
    async function getDef(id) {
      if (defCache.has(id)) return defCache.get(id);
      const d = await base44.asServiceRole.entities.JobDefinition.get(id).catch(() => null);
      defCache.set(id, d);
      return d;
    }

    const due = await base44.asServiceRole.entities.JobSchedule.filter({
      enabled: true, cancelledAt: null, nextRunAt: { $lte: nowIso },
    }, "nextRunAt", 100);

    let evaluated = 0, enqueued = 0, skipped = 0, disabled = 0;

    for (const sched of (due || [])) {
      evaluated++;
      const def = await getDef(sched.jobDefinitionId);
      if (!def || !def.active) { skipped++; continue; }

      const scheduledFor = sched.nextRunAt;
      const occurrenceKey = sched.id + ":" + scheduledFor;

      // Dedup: an active (non-cancelled) job for this occurrence already exists.
      const dup = await base44.asServiceRole.entities.BackgroundJob.filter({ deduplicationKey: occurrenceKey, status: { $ne: "cancelled" } }, undefined, 1);
      const alreadyEnqueued = dup && dup.length > 0;

      let createJob = false;
      let newNextRunAt = null;
      let disableAfter = false;

      if (sched.scheduleType === "once") {
        createJob = !alreadyEnqueued;
        disableAfter = true; // once schedules disable after their slot is handled.
        newNextRunAt = null;
      } else {
        const intervalMs = (sched.intervalSeconds || 60) * 1000;
        const overdue = (now.getTime() - new Date(scheduledFor).getTime()) > intervalMs;
        if (sched.misfirePolicy === "skip") {
          if (overdue) { createJob = false; }
          else { createJob = !alreadyEnqueued; }
        } else {
          // run_once: create at most one job for the missed period.
          createJob = !alreadyEnqueued;
        }
        // Advance nextRunAt to the first future occurrence.
        let next = new Date(scheduledFor).getTime() + intervalMs;
        while (next <= now.getTime()) { next += intervalMs; }
        newNextRunAt = new Date(next).toISOString();

        // Terminal conditions for interval.
        if (sched.maxRuns && (sched.runCount + (createJob ? 1 : 0)) >= sched.maxRuns) disableAfter = true;
        if (sched.endAt && newNextRunAt && new Date(newNextRunAt).getTime() > new Date(sched.endAt).getTime()) disableAfter = true;
      }

      if (createJob) {
        const retryPolicy = sched.retryPolicy || def.defaultRetryPolicy || null;
        const maxAttempts = retryPolicy ? Number(retryPolicy.maxAttempts) : 1;
        await base44.asServiceRole.entities.BackgroundJob.create({
          jobDefinitionId: sched.jobDefinitionId, jobScheduleId: sched.id, scope: sched.scope, organizationId: sched.organizationId,
          handlerKey: def.handlerKey, status: "queued",
          payload: sched.payload || {}, result: {}, priority: sched.priority != null ? sched.priority : 5,
          availableAt: nowIso, deduplicationKey: occurrenceKey,
          correlationId: null, attemptCount: 0, maxAttempts, retryPolicy,
          leaseOwner: null, leaseAcquiredAt: null, leaseExpiresAt: null, lastError: null,
          createdById: user.id, createdAt: nowIso,
          startedAt: null, completedAt: null, cancelledAt: null, deadLetteredAt: null,
        });
        enqueued++;
        await audit(base44, {
          backgroundJobId: null, jobDefinitionId: sched.jobDefinitionId, jobScheduleId: sched.id, organizationId: sched.organizationId,
          eventType: "job.enqueued", status: "queued", attemptNumber: 0,
          actorId: user.id, workerId: null, correlationId: null,
          metadata: { handlerKey: def.handlerKey, occurrenceKey, scheduledFor },
        });
        try {
          await base44.asServiceRole.functions.invoke("publishEvent", {
            eventType: "job.enqueued", sourceType: "job", sourceId: sched.id,
            payload: { jobDefinitionId: sched.jobDefinitionId, jobScheduleId: sched.id, organizationId: sched.organizationId, handlerKey: def.handlerKey, status: "queued", scheduledFor },
            actorId: user.id, organizationId: sched.organizationId,
          });
        } catch (e) {}
      } else {
        skipped++;
      }

      const update = {
        runCount: (sched.runCount || 0) + (createJob ? 1 : 0),
        lastScheduledFor: scheduledFor,
        lastEnqueuedAt: createJob ? nowIso : sched.lastEnqueuedAt,
        nextRunAt: disableAfter ? null : newNextRunAt,
        enabled: disableAfter ? false : true,
      };
      await base44.asServiceRole.entities.JobSchedule.update(sched.id, update);
      if (disableAfter) disabled++;
    }

    return Response.json({ status: "ticked", evaluated, enqueued, skipped, disabled });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});