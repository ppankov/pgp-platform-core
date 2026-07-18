import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduler and Background Job Runtime — pauseJobSchedule
// Authorized scope owner. enabled -> paused. Idempotent when already paused.
// Cannot pause a cancelled schedule.
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

    if (sched.cancelledAt) return Response.json({ error: "cannot pause a cancelled schedule" }, { status: 400 });
    if (!sched.enabled && sched.pausedAt) return Response.json({ status: "already_paused", schedule: { id: sched.id, enabled: false } });

    const updated = await svc.entities.JobSchedule.update(id, {
      enabled: false, pausedAt: new Date().toISOString(),
    });

    try {
      await base44.asServiceRole.functions.invoke("publishEvent", {
        eventType: "job.schedule_paused", sourceType: "job", sourceId: id,
        payload: { jobScheduleId: id, organizationId: sched.organizationId }, actorId: user.id, organizationId: sched.organizationId,
      });
    } catch (e) {}

    return Response.json({ status: "paused", schedule: { id: updated.id, enabled: updated.enabled, pausedAt: updated.pausedAt } });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});