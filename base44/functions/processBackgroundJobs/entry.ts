import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { calculateRetryDelay, decideFailedJobTransition } from "npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/background-job";
import { containsSecretKey, redactSecretKeys, sanitizeErrorText } from "npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/safe-data";

// Scheduler and Background Job Runtime — processBackgroundJobs
// Super Admin manual invocation (or future native scheduler) only. Accepts bounded batchSize
// (default 10, max 50). Claims jobs using lease semantics, processes only static registered
// handlers, handles success/retry/dead-letter transitions. Returns counts and identifiers only.
// Wave 10.3B: secret detection/redaction, error-text sanitization, retry-delay calculation,
// and retry/dead-letter decision delegated to @ppankov/pgp-core-domain (exact version pin).
// Infrastructure orchestration, handlers, lease, audit, events, and at-least-once semantics
// are unchanged.

const HANDLERS = {
  "system.health_check": async (ctx) => ({
    ok: true,
    executedAt: new Date().toISOString(),
    jobId: ctx.jobId,
    attemptNumber: ctx.attemptNumber,
  }),
};
const LEASE_SECONDS = 300;

async function audit(base44, ev) {
  try { await base44.asServiceRole.entities.JobExecutionEvent.create({ ...ev, createdAt: new Date().toISOString() }); } catch (e) {}
}
async function publish(base44, eventType, sourceId, payload, orgId) {
  try { await base44.asServiceRole.functions.invoke("publishEvent", { eventType, sourceType: "job", sourceId, payload, actorId: null, organizationId: orgId ?? null }); } catch (e) {}
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "super_admin") {
      return Response.json({ error: "Not permitted to invoke the worker" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    let batchSize = Number(body?.batchSize);
    if (!Number.isInteger(batchSize)) batchSize = 10;
    if (batchSize < 1) batchSize = 1;
    if (batchSize > 50) batchSize = 50;
    const workerId = typeof body?.workerId === "string" && body.workerId.trim() ? body.workerId.trim() : ("worker-" + crypto.randomUUID());

    const now = new Date();
    const nowIso = now.toISOString();
    const leaseExpiresAt = new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString();

    const result = { processed: 0, succeeded: 0, failed: 0, retried: 0, deadLettered: 0, jobIds: [], workerId };

    for (let i = 0; i < batchSize; i++) {
      // 1) Expired-lease recovery: a leased/running job whose lease expired.
      let job = null;
      let reclaimed = false;
      const expired = await base44.asServiceRole.entities.BackgroundJob.filter({
        status: { $in: ["leased", "running"] }, leaseExpiresAt: { $lte: nowIso },
      }, undefined, 1);
      if (expired && expired.length > 0) {
        job = expired[0];
        // Mark the previous running attempt abandoned.
        const prevAttempts = await base44.asServiceRole.entities.JobAttempt.filter({ backgroundJobId: job.id, status: "running" });
        for (const a of (prevAttempts || [])) {
          await base44.asServiceRole.entities.JobAttempt.update(a.id, { status: "abandoned", abandonedAt: nowIso });
          await audit(base44, {
            backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, jobScheduleId: job.jobScheduleId, organizationId: job.organizationId,
            eventType: "job.attempt_abandoned", status: job.status, attemptNumber: a.attemptNumber, actorId: null, workerId: a.workerId, correlationId: job.correlationId, metadata: {},
          });
        }
        reclaimed = true;
      } else {
        // 2) Available job: queued or retry_wait with availableAt <= now.
        const avail = await base44.asServiceRole.entities.BackgroundJob.filter({
          status: { $in: ["queued", "retry_wait"] }, availableAt: { $lte: nowIso },
        }, undefined, 1);
        if (!avail || avail.length === 0) break; // queue empty
        job = avail[0];
      }

      // Claim: lease the job (no compare-and-swap; race limitation documented).
      const newAttempt = (job.attemptCount || 0) + 1;
      const claimed = await base44.asServiceRole.entities.BackgroundJob.update(job.id, {
        status: "leased", leaseOwner: workerId, leaseAcquiredAt: nowIso, leaseExpiresAt, attemptCount: newAttempt,
      });
      const attempt = await base44.asServiceRole.entities.JobAttempt.create({
        backgroundJobId: job.id, attemptNumber: newAttempt, status: "running", workerId,
        startedAt: nowIso, completedAt: null, failedAt: null, abandonedAt: null, leaseExpiresAt, errorCode: null, lastError: null, createdAt: nowIso,
      });
      await base44.asServiceRole.entities.BackgroundJob.update(job.id, { status: "running", startedAt: job.startedAt || nowIso });
      await audit(base44, { backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, jobScheduleId: job.jobScheduleId, organizationId: job.organizationId, eventType: "job.claimed", status: "leased", attemptNumber: newAttempt, actorId: null, workerId, correlationId: job.correlationId, metadata: { reclaimed } });
      await audit(base44, { backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, jobScheduleId: job.jobScheduleId, organizationId: job.organizationId, eventType: "job.started", status: "running", attemptNumber: newAttempt, actorId: null, workerId, correlationId: job.correlationId, metadata: {} });
      await publish(base44, "job.claimed", job.id, { backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, organizationId: job.organizationId, status: "leased", attemptNumber: newAttempt }, job.organizationId);
      await publish(base44, "job.started", job.id, { backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, organizationId: job.organizationId, status: "running", attemptNumber: newAttempt }, job.organizationId);

      result.processed++;
      result.jobIds.push(job.id);

      // Execute the static handler.
      const handler = HANDLERS[job.handlerKey];
      try {
        if (!handler) throw new Error("unknown handler: " + job.handlerKey);
        const handlerResult = await handler({ jobId: job.id, attemptNumber: newAttempt, payload: job.payload || {} });
        const safeResult = containsSecretKey(handlerResult) ? redactSecretKeys(handlerResult) : handlerResult;
        await base44.asServiceRole.entities.BackgroundJob.update(job.id, {
          status: "succeeded", result: safeResult || {}, completedAt: nowIso,
          leaseOwner: null, leaseAcquiredAt: null, leaseExpiresAt: null, lastError: null,
        });
        await base44.asServiceRole.entities.JobAttempt.update(attempt.id, { status: "succeeded", completedAt: nowIso });
        await audit(base44, { backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, jobScheduleId: job.jobScheduleId, organizationId: job.organizationId, eventType: "job.succeeded", status: "succeeded", attemptNumber: newAttempt, actorId: null, workerId, correlationId: job.correlationId, metadata: { handlerKey: job.handlerKey } });
        await publish(base44, "job.succeeded", job.id, { backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, organizationId: job.organizationId, status: "succeeded", attemptNumber: newAttempt }, job.organizationId);
        result.succeeded++;
      } catch (handlerError) {
        const safeError = sanitizeErrorText(String(handlerError.message || "handler error"));
        await base44.asServiceRole.entities.JobAttempt.update(attempt.id, { status: "failed", failedAt: nowIso, errorCode: "handler_error", lastError: safeError });
        const transition = decideFailedJobTransition({ attemptNumber: newAttempt, maxAttempts: job.maxAttempts || 1, retryPolicy: job.retryPolicy, nowIso });
        if (transition.status === "retry_wait") {
          const availableAt = transition.availableAt;
          await base44.asServiceRole.entities.BackgroundJob.update(job.id, {
            status: "retry_wait", availableAt, lastError: safeError,
            leaseOwner: null, leaseAcquiredAt: null, leaseExpiresAt: null,
          });
          await audit(base44, { backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, jobScheduleId: job.jobScheduleId, organizationId: job.organizationId, eventType: "job.retry_scheduled", status: "retry_wait", attemptNumber: newAttempt, actorId: null, workerId, correlationId: job.correlationId, metadata: { availableAt, maxAttempts: job.maxAttempts } });
          await publish(base44, "job.retry_scheduled", job.id, { backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, organizationId: job.organizationId, status: "retry_wait", attemptNumber: newAttempt }, job.organizationId);
          result.retried++;
        } else {
          await base44.asServiceRole.entities.BackgroundJob.update(job.id, {
            status: "dead_letter", deadLetteredAt: transition.deadLetteredAt, lastError: safeError,
            leaseOwner: null, leaseAcquiredAt: null, leaseExpiresAt: null,
          });
          await audit(base44, { backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, jobScheduleId: job.jobScheduleId, organizationId: job.organizationId, eventType: "job.dead_lettered", status: "dead_letter", attemptNumber: newAttempt, actorId: null, workerId, correlationId: job.correlationId, metadata: { maxAttempts: job.maxAttempts } });
          await publish(base44, "job.dead_lettered", job.id, { backgroundJobId: job.id, jobDefinitionId: job.jobDefinitionId, organizationId: job.organizationId, status: "dead_letter", attemptNumber: newAttempt }, job.organizationId);
          result.deadLettered++;
        }
        result.failed++;
      }
    }

    return Response.json({ status: "processed", ...result });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});