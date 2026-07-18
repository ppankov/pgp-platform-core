import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduler and Background Job Runtime — listJobSchedules
// Read-only. Filters by scope, organization, enabled and schedule type.
// Includes nextRunAt and lastEnqueuedAt. Never exposes secret-looking payload values.
//
// Phase 9 hardening:
//  - organizationId view requires active OrganizationMember membership (Decision B2).
//  - Without an explicit organizationId, non-super_admin callers are restricted to
//    the organizations they are an active member of (no cross-tenant reads).
//  - Platform-scope filter requires core_developer/super_admin.
//  - scheduleType allow-listed; limit capped. Safe errors.

const SECRET_KEYS = ["password","passwd","secret","token","access_token","refresh_token","api_key","apikey","client_secret","private_key","credential","authorization","cookie","session"];
function redact(v, d=0) {
  if (d > 12 || v == null || typeof v !== "object") return v;
  const out = Array.isArray(v) ? [] : {};
  for (const k of Object.keys(v)) {
    const lk = String(k).toLowerCase();
    if (SECRET_KEYS.some(s => lk.includes(s))) out[k] = "[redacted]";
    else out[k] = redact(v[k], d + 1);
  }
  return out;
}
const READ_ROLES = ["developer","solution_architect","core_developer","admin","super_admin","auditor"];

async function activeMembership(svc, userId, orgId) {
  if (!orgId) return null;
  const list = await svc.entities.OrganizationMember.filter({ user_id: userId, organization_id: orgId }).catch(() => []);
  return (list || []).find((m) => m.status === "active") || null;
}
async function activeMemberships(svc, userId) {
  const list = await svc.entities.OrganizationMember.filter({ user_id: userId, status: "active" }).catch(() => []);
  return (list || []).map((m) => m.organization_id);
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
    if (!READ_ROLES.includes(user.role)) return Response.json({ error: "Not permitted to read schedules" }, { status: 403 });
    const role = user.role;

    const body = await req.json().catch(() => ({}));
    const filter = {};
    if (body?.scope && ["platform","organization"].includes(body.scope)) filter.scope = body.scope;
    if (body?.organizationId) filter.organizationId = body.organizationId;
    if (body?.jobDefinitionId) filter.jobDefinitionId = body.jobDefinitionId;
    if (body?.scheduleType && ["once","interval"].includes(body.scheduleType)) filter.scheduleType = body.scheduleType;
    if (body?.enabled !== undefined && body?.enabled !== null) filter.enabled = !!body.enabled;
    const ALLOWED_SORT = new Set(["nextRunAt","createdAt","-nextRunAt","-createdAt"]);
    const sortField = typeof body?.sort === "string" && ALLOWED_SORT.has(body.sort) ? body.sort : "nextRunAt";
    const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 500);

    const svc = base44.asServiceRole;

    if (filter.scope === "platform" && role !== "core_developer" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to read platform schedules" }, { status: 403 });
    }

    // Phase 9: organization scoping.
    if (role !== "super_admin") {
      if (filter.organizationId) {
        const membership = await activeMembership(svc, user.id, filter.organizationId);
        if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
      } else if (filter.scope !== "platform") {
        const orgs = await activeMemberships(svc, user.id);
        if (orgs.length === 0) return Response.json({ schedules: [] });
        filter.organizationId = { $in: orgs };
      }
    }

    const schedules = await svc.entities.JobSchedule.filter(filter, sortField, limit);
    const safe = (schedules || []).map(s => ({ ...s, payload: s.payload ? redact(s.payload) : s.payload }));

    return Response.json({ schedules: safe });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});