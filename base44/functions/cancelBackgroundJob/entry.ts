import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduler and Background Job Runtime — cancelBackgroundJob
// May cancel queued or retry_wait jobs. Cannot cancel succeeded, dead_letter or
// already-running jobs. Repeated cancellation is idempotent. Non-destructive.
//
// Phase 9 hardening: organization-scoped cancellation requires active
// OrganizationMember membership of job.organizationId (Decision B2). Platform scope
// remains restricted to core_developer/super_admin (frozen). Safe errors.

async function activeMembership(svc, userId, orgId) {
  if (!orgId) return null;
  const list = await svc.entities.OrganizationMember.filter({ user_id: userId, organization_id: orgId }).catch(() => []);
  return (list || []).find((m) => m.status === "active") || null;
}
function safeMsg(e) {
  const m = (e && e.message) ? String(e.message) : "Unexpected error";
  return m.length > 200 ? m.slice(0, 200) : m;
}

async function audit(base44, ev) {
  try { await base44.asServiceRole.entities.JobExecutionEvent.create({ ...ev, createdAt: new Date().toISOString() }); } catch (e) {}
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const role = user.role;

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.backgroundJobId === "string" ? body.backgroundJobId.trim() : "";
    if (!id) return Response.json({ error: "backgroundJobId is required" }, { status: 400 });

    const job = await base44.asServiceRole.entities.BackgroundJob.get(id).catch(() => null);
    if (!job) return Response.json({ error: "job not found" }, { status: 404 });

    // Scope ownership.
    if (job.scope === "platform" && role !== "core_developer" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to cancel platform jobs" }, { status: 403 });
    }
    if (job.scope === "organization" && role !== "admin" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to cancel organization jobs" }, { status: 403 });
    }

    // Phase 9: verify membership of the job's real organization.
    if (job.scope === "organization" && role !== "super_admin") {
      const membership = await activeMembership(base44.asServiceRole, user.id, job.organizationId);
      if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    if (job.status === "cancelled") return Response.json({ status: "already_cancelled", job: { id: job.id, status: job.status } });
    if (job.status === "succeeded" || job.status === "dead_letter") {
      return Response.json({ error: "cannot cancel a succeeded or dead_letter job" }, { status: 400 });
    }
    if (job.status === "running" || job.status === "leased") {
      return Response.json({ error: "cannot cancel a running/leased job (cooperative cancellation deferred)" }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.BackgroundJob.update(id, {
      status: "cancelled", cancelledAt: new Date().toISOString(),
      leaseOwner: null, leaseAcquiredAt: null, leaseExpiresAt: null,
    });

    await audit(base44, {
      backgroundJobId: id, jobDefinitionId: job.jobDefinitionId, jobScheduleId: job.jobScheduleId, organizationId: job.organizationId,
      eventType: "job.cancelled", status: "cancelled", attemptNumber: job.attemptCount,
      actorId: user.id, workerId: null, correlationId: job.correlationId, metadata: {},
    });

    try {
      await base44.asServiceRole.functions.invoke("publishEvent", {
        eventType: "job.cancelled", sourceType: "job", sourceId: id,
        payload: { backgroundJobId: id, jobDefinitionId: job.jobDefinitionId, organizationId: job.organizationId, status: "cancelled" },
        organizationId: job.organizationId,
        actorId: user.id,
      });
    } catch (e) {}

    return Response.json({ status: "cancelled", job: { id: updated.id, status: updated.status, cancelledAt: updated.cancelledAt } });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});