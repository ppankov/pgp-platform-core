import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduler and Background Job Runtime — listBackgroundJobs
// Read-only. Filters by scope, organizationId, definition, schedule, status, handlerKey.
// Supports queue, history and dead-letter views. Never exposes secrets.
//
// Phase 9 hardening:
//  - organizationId view requires active OrganizationMember membership (Decision B2).
//  - Without an explicit organizationId, non-super_admin callers are restricted to
//    the organizations they are an active member of (no cross-tenant reads).
//  - Platform-scope filter requires core_developer/super_admin.
//  - Status filter allow-listed; limit capped. Safe errors.

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
// Phase 9 stabilization: sanitize lastError text — mask secret-like values and
// cap to 500 chars before returning to frontend.
const SECRET_TEXT_KEY = /\b(password|passwd|secret|token|access_token|refresh_token|api_key|apikey|client_secret|private_key|credential|credentialref|authorization|cookie|session)\b\s*[:=]\s*([^\s,;"']+)/gi;
const BEARER_TEXT = /\b(Bearer)\s+([^\s,;"']+)/gi;
function sanitizeErrorText(msg) {
  let s = typeof msg === "string" ? msg : String(msg || "");
  s = s.replace(SECRET_TEXT_KEY, "$1=[redacted]");
  s = s.replace(BEARER_TEXT, "$1 [redacted]");
  return s.length > 500 ? s.slice(0, 500) : s;
}
const READ_ROLES = ["developer","solution_architect","core_developer","admin","super_admin","auditor"];
const FULL_ROLES = ["core_developer","admin","super_admin"];
const ALLOWED_STATUS = new Set(["queued","leased","running","retry_wait","succeeded","cancelled","dead_letter"]);

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
    if (!READ_ROLES.includes(user.role)) return Response.json({ error: "Not permitted to read jobs" }, { status: 403 });
    const role = user.role;

    const body = await req.json().catch(() => ({}));
    const filter = {};
    if (body?.scope && ["platform","organization"].includes(body.scope)) filter.scope = body.scope;
    if (body?.organizationId) filter.organizationId = body.organizationId;
    if (body?.jobDefinitionId) filter.jobDefinitionId = body.jobDefinitionId;
    if (body?.jobScheduleId) filter.jobScheduleId = body.jobScheduleId;
    if (body?.handlerKey) filter.handlerKey = body.handlerKey;
    if (body?.status) {
      if (Array.isArray(body.status)) {
        if (!body.status.every((s) => ALLOWED_STATUS.has(s))) return Response.json({ error: "invalid status filter" }, { status: 400 });
        filter.status = { $in: body.status };
      } else {
        if (!ALLOWED_STATUS.has(body.status)) return Response.json({ error: "invalid status filter" }, { status: 400 });
        filter.status = body.status;
      }
    }
    // Phase 9: allow-list the sort field.
    const ALLOWED_SORT = new Set(["createdAt","availableAt","priority","updatedAt","-createdAt","-availableAt","-priority","-updatedAt"]);
    const sortField = typeof body?.sort === "string" && ALLOWED_SORT.has(body.sort) ? body.sort : "-createdAt";
    // Phase 9: cap the limit.
    const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 500);

    const svc = base44.asServiceRole;

    // Phase 9: platform-scope filter requires platform roles.
    if (filter.scope === "platform" && role !== "core_developer" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to read platform jobs" }, { status: 403 });
    }

    // Phase 9: organization scoping.
    if (role !== "super_admin") {
      if (filter.organizationId) {
        const membership = await activeMembership(svc, user.id, filter.organizationId);
        if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
      } else if (filter.scope !== "platform") {
        // No explicit org and not platform scope: restrict to the caller's orgs.
        const orgs = await activeMemberships(svc, user.id);
        if (orgs.length === 0) return Response.json({ jobs: [] });
        filter.organizationId = { $in: orgs };
      }
    }

    const jobs = await svc.entities.BackgroundJob.filter(filter, sortField, limit);
    const full = FULL_ROLES.includes(role);

    const safe = (jobs || []).map(j => {
      const s = { ...j };
      if (!full) { s.payload = null; s.result = null; }
      else {
        s.payload = j.payload ? redact(j.payload) : j.payload;
        s.result = j.result ? redact(j.result) : j.result;
      }
      s.lastError = j.lastError ? sanitizeErrorText(j.lastError) : j.lastError;
      return s;
    });

    return Response.json({ jobs: safe });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});