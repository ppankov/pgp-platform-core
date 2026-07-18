import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduler and Background Job Runtime — enqueueBackgroundJob
// Creates a manual queue item. Validates active definition, scope, organization, payload,
// retry policy, availableAt. Supports optional deduplicationKey (duplicate active key
// returns already_enqueued). Creates status = queued.
//
// Phase 9 hardening: organization-scoped enqueue requires active OrganizationMember
// membership of the requested organizationId (Decision B2). Platform scope remains
// restricted to core_developer/super_admin (frozen). Safe errors. Frozen contract unchanged.

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
    const jobDefinitionId = typeof body?.jobDefinitionId === "string" ? body.jobDefinitionId.trim() : "";
    if (!jobDefinitionId) return Response.json({ error: "jobDefinitionId is required" }, { status: 400 });

    const def = await base44.asServiceRole.entities.JobDefinition.get(jobDefinitionId).catch(() => null);
    if (!def) return Response.json({ error: "job definition not found" }, { status: 400 });
    if (!def.active) return Response.json({ error: "job definition is not active" }, { status: 400 });

    const scope = typeof body?.scope === "string" ? body.scope : "organization";
    if (!["platform","organization"].includes(scope)) return Response.json({ error: "invalid scope" }, { status: 400 });
    if (scope === "platform" && body?.organizationId) {
      return Response.json({ error: "platform jobs must have organizationId = null" }, { status: 400 });
    }
    let organizationId = null;
    if (scope === "organization") {
      organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
      if (!organizationId) return Response.json({ error: "organization jobs require organizationId" }, { status: 400 });
    }

    // Permission by scope.
    if (scope === "platform" && role !== "core_developer" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to enqueue platform jobs" }, { status: 403 });
    }
    if (scope === "organization" && role !== "admin" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to enqueue organization jobs" }, { status: 403 });
    }

    // Phase 9: verify membership of the target organization.
    if (scope === "organization" && role !== "super_admin") {
      const membership = await activeMembership(base44.asServiceRole, user.id, organizationId);
      if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
    if (hasSecretKey(payload)) return Response.json({ error: "payload contains secret-looking keys" }, { status: 400 });

    const retryPolicy = body?.retryPolicy || def.defaultRetryPolicy || null;
    if (retryPolicy) { const rpErr = validateRetryPolicy(retryPolicy); if (rpErr) return Response.json({ error: rpErr }, { status: 400 }); }
    const maxAttempts = retryPolicy ? Number(retryPolicy.maxAttempts) : 1;

    const priority = body?.priority !== undefined && body?.priority !== null ? Number(body.priority) : 5;
    const pErr = validatePriority(priority);
    if (pErr) return Response.json({ error: pErr }, { status: 400 });

    let availableAt = new Date().toISOString();
    if (body?.availableAt) {
      const ad = new Date(body.availableAt);
      if (isNaN(ad.getTime())) return Response.json({ error: "availableAt is not a valid timestamp" }, { status: 400 });
      availableAt = ad.toISOString();
    }

    const deduplicationKey = typeof body?.deduplicationKey === "string" ? body.deduplicationKey.trim() : null;
    if (deduplicationKey) {
      const existing = await base44.asServiceRole.entities.BackgroundJob.filter({ deduplicationKey, status: { $ne: "cancelled" } });
      if (existing && existing.length > 0) {
        return Response.json({ status: "already_enqueued", jobId: existing[0].id });
      }
    }

    const now = new Date();
    const job = await base44.asServiceRole.entities.BackgroundJob.create({
      jobDefinitionId, jobScheduleId: null, scope, organizationId,
      handlerKey: def.handlerKey, status: "queued",
      payload, result: {}, priority, availableAt,
      deduplicationKey,
      correlationId: typeof body?.correlationId === "string" ? body.correlationId : null,
      attemptCount: 0, maxAttempts, retryPolicy: retryPolicy || null,
      leaseOwner: null, leaseAcquiredAt: null, leaseExpiresAt: null, lastError: null,
      createdById: user.id, createdAt: now.toISOString(),
      startedAt: null, completedAt: null, cancelledAt: null, deadLetteredAt: null,
    });

    await audit(base44, {
      backgroundJobId: job.id, jobDefinitionId, jobScheduleId: null, organizationId,
      eventType: "job.enqueued", status: "queued", attemptNumber: 0,
      actorId: user.id, workerId: null, correlationId: job.correlationId,
      metadata: { handlerKey: def.handlerKey, priority, availableAt },
    });

    try {
      await base44.asServiceRole.functions.invoke("publishEvent", {
        eventType: "job.enqueued", sourceType: "job", sourceId: job.id,
        payload: { jobDefinitionId, backgroundJobId: job.id, organizationId, handlerKey: def.handlerKey, status: "queued" },
        organizationId,
        actorId: user.id,
      });
    } catch (e) {}

    return Response.json({ status: "enqueued", job: { id: job.id, status: job.status, availableAt: job.availableAt } });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});