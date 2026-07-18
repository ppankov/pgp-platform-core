import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduler and Background Job Runtime — createJobSchedule
// Platform scope: Core Developer / Super Admin. Organization scope: Admin / Super Admin.
// Validates schedule type, timestamps, safe payload, retry policy, priority; calculates nextRunAt.
//
// Phase 9 hardening: organization scope requires active OrganizationMember membership
// of the requested organizationId (Decision B2). Platform scope remains restricted to
// core_developer/super_admin (frozen). Safe errors. Frozen contract unchanged.

const SECRET_KEYS = ["password","passwd","secret","token","access_token","refresh_token","api_key","apikey","client_secret","private_key","credential","authorization","cookie","session"];
function hasSecretKey(v, d=0) {
  if (d > 12 || v == null || typeof v !== "object") return false;
  for (const k of Object.keys(v)) {
    const lk = String(k).toLowerCase();
    if (SECRET_KEYS.some(s => lk.includes(s))) return true;
    if (hasSecretKey(v[k], d + 1)) return true;
  }
  return false;
}

function validateRetryPolicy(rp) {
  if (rp === undefined || rp === null) return null;
  if (typeof rp !== "object" || Array.isArray(rp)) return "retryPolicy must be an object";
  const ma = Number(rp.maxAttempts);
  if (!Number.isInteger(ma) || ma < 1 || ma > 10) return "maxAttempts must be an integer 1..10";
  const bt = rp.backoffType || "none";
  if (!["none","fixed","exponential"].includes(bt)) return "invalid backoffType";
  if (bt !== "none") {
    const base = Number(rp.baseDelaySeconds);
    if (!Number.isInteger(base) || base < 5 || base > 3600) return "baseDelaySeconds must be 5..3600";
    const maxd = Number(rp.maxDelaySeconds);
    if (!Number.isInteger(maxd) || maxd < base || maxd > 86400) return "maxDelaySeconds must be baseDelaySeconds..86400";
  }
  return null;
}

function validatePriority(p) {
  if (p === undefined || p === null) return null;
  const n = Number(p);
  if (!Number.isInteger(n) || n < 0 || n > 10) return "priority must be an integer 0..10";
  return null;
}

function computeNextRunAt(scheduleType, runAt, startAt, intervalSeconds) {
  const now = new Date();
  if (scheduleType === "once") return runAt;
  const start = startAt ? new Date(startAt) : now;
  const first = start.getTime() < now.getTime() ? now : start;
  return first.toISOString();
}

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
    const key = typeof body?.key === "string" ? body.key.trim() : "";
    const jobDefinitionId = typeof body?.jobDefinitionId === "string" ? body.jobDefinitionId.trim() : "";
    const scope = typeof body?.scope === "string" ? body.scope : "";
    const scheduleType = typeof body?.scheduleType === "string" ? body.scheduleType : "";
    if (!key || !jobDefinitionId || !scope || !scheduleType) {
      return Response.json({ error: "key, jobDefinitionId, scope and scheduleType are required" }, { status: 400 });
    }
    if (!["platform","organization"].includes(scope)) return Response.json({ error: "invalid scope" }, { status: 400 });
    if (!["once","interval"].includes(scheduleType)) return Response.json({ error: "invalid scheduleType" }, { status: 400 });
    if (key.length > 128) return Response.json({ error: "key is too long" }, { status: 400 });

    if (scope === "platform" && body?.organizationId) {
      return Response.json({ error: "platform schedules must have organizationId = null" }, { status: 400 });
    }
    if (scope === "organization" && !body?.organizationId) {
      return Response.json({ error: "organization schedules require organizationId" }, { status: 400 });
    }

    if (scope === "platform" && role !== "core_developer" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to manage platform schedules" }, { status: 403 });
    }
    if (scope === "organization" && role !== "admin" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to manage organization schedules" }, { status: 403 });
    }

    // Phase 9: verify membership of the target organization.
    if (scope === "organization" && role !== "super_admin") {
      const membership = await activeMembership(base44.asServiceRole, user.id, body.organizationId);
      if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    const def = await base44.asServiceRole.entities.JobDefinition.get(jobDefinitionId).catch(() => null);
    if (!def) return Response.json({ error: "job definition not found" }, { status: 400 });
    if (!def.active) return Response.json({ error: "job definition is not active" }, { status: 400 });

    const now = new Date();
    let runAt = null, intervalSeconds = null, startAt = null, endAt = null;
    if (scheduleType === "once") {
      if (!body?.runAt) return Response.json({ error: "once schedule requires runAt" }, { status: 400 });
      const d = new Date(body.runAt);
      if (isNaN(d.getTime())) return Response.json({ error: "runAt is not a valid timestamp" }, { status: 400 });
      if (d.getTime() <= now.getTime()) return Response.json({ error: "runAt must be a future UTC timestamp" }, { status: 400 });
      runAt = d.toISOString();
    } else {
      const iv = Number(body?.intervalSeconds);
      if (!Number.isInteger(iv) || iv < 60) return Response.json({ error: "intervalSeconds must be an integer >= 60" }, { status: 400 });
      intervalSeconds = iv;
      if (body?.startAt) { const sd = new Date(body.startAt); if (isNaN(sd.getTime())) return Response.json({ error: "startAt is not a valid timestamp" }, { status: 400 }); startAt = sd.toISOString(); }
      if (body?.endAt) { const ed = new Date(body.endAt); if (isNaN(ed.getTime())) return Response.json({ error: "endAt is not a valid timestamp" }, { status: 400 }); if (ed.getTime() <= now.getTime()) return Response.json({ error: "endAt must be in the future" }, { status: 400 }); endAt = ed.toISOString(); }
    }

    const maxRuns = body?.maxRuns !== undefined && body?.maxRuns !== null ? Number(body.maxRuns) : null;
    if (maxRuns !== null && (!Number.isInteger(maxRuns) || maxRuns < 1)) return Response.json({ error: "maxRuns must be a positive integer" }, { status: 400 });

    const priority = body?.priority !== undefined && body?.priority !== null ? Number(body.priority) : 5;
    const pErr = validatePriority(priority);
    if (pErr) return Response.json({ error: pErr }, { status: 400 });

    const misfirePolicy = body?.misfirePolicy || "skip";
    if (!["skip","run_once"].includes(misfirePolicy)) return Response.json({ error: "invalid misfirePolicy" }, { status: 400 });

    const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
    if (hasSecretKey(payload)) return Response.json({ error: "payload contains secret-looking keys" }, { status: 400 });

    const retryPolicy = body?.retryPolicy || def.defaultRetryPolicy || null;
    if (retryPolicy) { const rpErr = validateRetryPolicy(retryPolicy); if (rpErr) return Response.json({ error: rpErr }, { status: 400 }); }

    const dupFilter = scope === "platform" ? { key, scope: "platform" } : { key, scope: "organization", organizationId: body.organizationId };
    const existing = await base44.asServiceRole.entities.JobSchedule.filter(dupFilter);
    if (existing && existing.length > 0) return Response.json({ error: "schedule key already exists within scope" }, { status: 400 });

    const nextRunAt = computeNextRunAt(scheduleType, runAt, startAt, intervalSeconds);

    const sched = await base44.asServiceRole.entities.JobSchedule.create({
      key, name: typeof body?.name === "string" ? body.name : key,
      description: typeof body?.description === "string" ? body.description : "",
      jobDefinitionId, scope,
      organizationId: scope === "organization" ? body.organizationId : null,
      scheduleType,
      runAt, intervalSeconds, startAt, endAt,
      nextRunAt,
      lastScheduledFor: null, lastEnqueuedAt: null,
      payload, priority, retryPolicy, misfirePolicy,
      runCount: 0, maxRuns,
      enabled: true, pausedAt: null, cancelledAt: null,
      createdById: user.id, createdAt: now.toISOString(),
    });

    try {
      await base44.asServiceRole.functions.invoke("publishEvent", {
        eventType: "job.schedule_created", sourceType: "job", sourceId: sched.id,
        payload: { jobDefinitionId, jobScheduleId: sched.id, organizationId: sched.organizationId, scope, scheduleType, nextRunAt },
        organizationId: sched.organizationId,
        actorId: user.id,
      });
    } catch (e) {}

    return Response.json({ status: "created", schedule: { id: sched.id, key: sched.key, nextRunAt: sched.nextRunAt, enabled: sched.enabled } });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});