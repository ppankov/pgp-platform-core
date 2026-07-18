import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduler and Background Job Runtime — cancelJobSchedule
// Non-destructive: sets cancelledAt and enabled=false. Repeated cancellation is idempotent.
// Does NOT cancel already-created BackgroundJobs.
//
// Phase 9 hardening: re-fetch schedule, verify OrganizationMember membership of
// sched.organizationId for org scope before mutation. Safe errors. Frozen contract unchanged.

async function activeMembership(svc, userId, orgId) {
  if (!orgId) return null;
  const list = await svc.entities.OrganizationMember.filter({ user_id: userId, organization_id: orgId }).catch(() => []);
  return (list || []).find((m) => m.status === "active") || null;
}
function safeMsg(e) {
  const m = (e && e.message) ? String(e.message) : "Unexpected error";
  return m.length > 200 ? m.slice(0, 200) : m;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const role = user.role;

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.jobScheduleId === "string" ? body.jobScheduleId.trim() : "";
    if (!id) return Response.json({ error: "jobScheduleId is required" }, { status: 400 });

    const svc = base44.asServiceRole;
    const sched = await svc.entities.JobSchedule.get(id).catch(() => null);
    if (!sched) return Response.json({ error: "schedule not found" }, { status: 404 });

    if (sched.scope === "platform" && role !== "core_developer" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to manage platform schedules" }, { status: 403 });
    }
    if (sched.scope === "organization" && role !== "admin" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to manage organization schedules" }, { status: 403 });
    }

    // Phase 9: verify membership of the schedule's real organization.
    if (sched.scope === "organization" && role !== "super_admin") {
      const membership = await activeMembership(svc, user.id, sched.organizationId);
      if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    if (sched.cancelledAt) return Response.json({ status: "already_cancelled", schedule: { id: sched.id, cancelledAt: sched.cancelledAt } });

    const updated = await svc.entities.JobSchedule.update(id, {
      cancelledAt: new Date().toISOString(), enabled: false,
    });

    try {
      await base44.asServiceRole.functions.invoke("publishEvent", {
        eventType: "job.schedule_cancelled", sourceType: "job", sourceId: id,
        payload: { jobScheduleId: id, organizationId: sched.organizationId }, actorId: user.id, organizationId: sched.organizationId,
      });
    } catch (e) {}

    return Response.json({ status: "cancelled", schedule: { id: updated.id, cancelledAt: updated.cancelledAt, enabled: updated.enabled } });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});