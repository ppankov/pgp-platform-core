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
//
// Wave 10.4A.3 — Single-function Local Provider Pilot:
//  - Base44 bootstrap stays local to the Deno.serve handler.
//  - A same-file Base44 adapter factory (createBase44Provider) exposes exactly four
//    provider-neutral capabilities: getCurrentUser, verifyOrganizationMembership,
//    listActiveOrganizationMemberships, filterJobSchedules. No generic CRUD; the raw
//    Base44 client / svc / entity namespaces are not exposed outside the adapter.
//  - executeListJobSchedules() is a provider-neutral orchestration that owns all
//    application policy (READ_ROLES gate, platform-scope gate, membership gate,
//    own-orgs restriction, input allow-lists, filter construction, sort selection,
//    limit cap, response shape, inline payload redaction). It references only the
//    plain input, the explicit user context, and the four provider capabilities —
//    never base44 / svc / entities / Deno / req.
//  - Runtime behavior is preserved exactly. Inline redact() is intentionally
//    retained (redaction parity migration is a separate, explicitly-approved step).

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

function safeMsg(e) {
  const m = (e && e.message) ? String(e.message) : "Unexpected error";
  return m.length > 200 ? m.slice(0, 200) : m;
}

// --- Local Base44 adapter (provider-specific; encapsulates all Base44 access) ---
function createBase44Provider(base44) {
  return {
    async getCurrentUser() {
      return await base44.auth.me();
    },
    async verifyOrganizationMembership(userId, orgId) {
      if (!orgId) return null;
      const list = await base44.asServiceRole.entities.OrganizationMember.filter({ user_id: userId, organization_id: orgId }).catch(() => []);
      return (list || []).find((m) => m.status === "active") || null;
    },
    async listActiveOrganizationMemberships(userId) {
      const list = await base44.asServiceRole.entities.OrganizationMember.filter({ user_id: userId, status: "active" }).catch(() => []);
      return (list || []).map((m) => m.organization_id);
    },
    async filterJobSchedules(filter, sortField, limit) {
      return await base44.asServiceRole.entities.JobSchedule.filter(filter, sortField, limit);
    },
  };
}

// --- Provider-neutral orchestration (owns application policy; no Base44 access) ---
async function executeListJobSchedules(input, user, provider) {
  if (!READ_ROLES.includes(user.role)) {
    return { status: 403, body: { error: "Not permitted to read schedules" } };
  }
  const role = user.role;

  const filter = {};
  if (input?.scope && ["platform","organization"].includes(input.scope)) filter.scope = input.scope;
  if (input?.organizationId) filter.organizationId = input.organizationId;
  if (input?.jobDefinitionId) filter.jobDefinitionId = input.jobDefinitionId;
  if (input?.scheduleType && ["once","interval"].includes(input.scheduleType)) filter.scheduleType = input.scheduleType;
  if (input?.enabled !== undefined && input?.enabled !== null) filter.enabled = !!input.enabled;
  const ALLOWED_SORT = new Set(["nextRunAt","createdAt","-nextRunAt","-createdAt"]);
  const sortField = typeof input?.sort === "string" && ALLOWED_SORT.has(input.sort) ? input.sort : "nextRunAt";
  const limit = Math.min(Math.max(Number(input?.limit) || 100, 1), 500);

  if (filter.scope === "platform" && role !== "core_developer" && role !== "super_admin") {
    return { status: 403, body: { error: "Not permitted to read platform schedules" } };
  }

  // Phase 9: organization scoping.
  if (role !== "super_admin") {
    if (filter.organizationId) {
      const membership = await provider.verifyOrganizationMembership(user.id, filter.organizationId);
      if (!membership) return { status: 403, body: { error: "Not a member of this organization" } };
    } else if (filter.scope !== "platform") {
      const orgs = await provider.listActiveOrganizationMemberships(user.id);
      if (orgs.length === 0) return { status: 200, body: { schedules: [] } };
      filter.organizationId = { $in: orgs };
    }
  }

  const schedules = await provider.filterJobSchedules(filter, sortField, limit);
  const safe = (schedules || []).map(s => ({ ...s, payload: s.payload ? redact(s.payload) : s.payload }));

  return { status: 200, body: { schedules: safe } };
}

// --- Thin HTTP boundary ---
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const provider = createBase44Provider(base44);
    const user = await provider.getCurrentUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const result = await executeListJobSchedules(body, user, provider);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});