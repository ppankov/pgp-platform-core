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
//
// Wave 10.4A.5 — Second-function Local Provider Pilot:
//  - Base44 bootstrap stays local to the Deno.serve handler.
//  - A same-file Base44 adapter factory (createBase44Provider) exposes exactly four
//    provider-neutral capabilities: getCurrentUser, verifyOrganizationMembership,
//    listActiveOrganizationMemberships, filterBackgroundJobs. No generic CRUD; the
//    raw Base44 client / svc / entity namespaces are not exposed outside the adapter.
//  - executeListBackgroundJobs() is a provider-neutral orchestration that owns all
//    application policy (READ_ROLES gate, FULL_ROLES payload/result projection,
//    platform-scope gate, membership gate, own-orgs restriction, scalar/array
//    status validation, input allow-lists, filter construction, sort selection,
//    limit cap, response shape, inline payload redaction, lastError sanitization).
//    It references only the plain input, the explicit user context, the four
//    provider capabilities, and the local pure security helpers — never base44 /
//    svc / entities / Deno / req / auth.me / asServiceRole.
//  - Runtime behavior is preserved exactly. Inline redact(), sanitizeErrorText(),
//    and safeMsg() are intentionally retained (parity migration to
//    @ppankov/pgp-core-domain is a separate, explicitly-approved step).

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
    async filterBackgroundJobs(filter, sortField, limit) {
      return await base44.asServiceRole.entities.BackgroundJob.filter(filter, sortField, limit);
    },
  };
}

// --- Provider-neutral orchestration (owns application policy; no Base44 access) ---
async function executeListBackgroundJobs(input, user, provider) {
  if (!READ_ROLES.includes(user.role)) {
    return { status: 403, body: { error: "Not permitted to read jobs" } };
  }
  const role = user.role;

  const filter = {};
  if (input?.scope && ["platform","organization"].includes(input.scope)) filter.scope = input.scope;
  if (input?.organizationId) filter.organizationId = input.organizationId;
  if (input?.jobDefinitionId) filter.jobDefinitionId = input.jobDefinitionId;
  if (input?.jobScheduleId) filter.jobScheduleId = input.jobScheduleId;
  if (input?.handlerKey) filter.handlerKey = input.handlerKey;
  if (input?.status) {
    if (Array.isArray(input.status)) {
      if (!input.status.every((s) => ALLOWED_STATUS.has(s))) return { status: 400, body: { error: "invalid status filter" } };
      filter.status = { $in: input.status };
    } else {
      if (!ALLOWED_STATUS.has(input.status)) return { status: 400, body: { error: "invalid status filter" } };
      filter.status = input.status;
    }
  }
  // Phase 9: allow-list the sort field.
  const ALLOWED_SORT = new Set(["createdAt","availableAt","priority","updatedAt","-createdAt","-availableAt","-priority","-updatedAt"]);
  const sortField = typeof input?.sort === "string" && ALLOWED_SORT.has(input.sort) ? input.sort : "-createdAt";
  // Phase 9: cap the limit.
  const limit = Math.min(Math.max(Number(input?.limit) || 100, 1), 500);

  // Phase 9: platform-scope filter requires platform roles.
  if (filter.scope === "platform" && role !== "core_developer" && role !== "super_admin") {
    return { status: 403, body: { error: "Not permitted to read platform jobs" } };
  }

  // Phase 9: organization scoping.
  if (role !== "super_admin") {
    if (filter.organizationId) {
      const membership = await provider.verifyOrganizationMembership(user.id, filter.organizationId);
      if (!membership) return { status: 403, body: { error: "Not a member of this organization" } };
    } else if (filter.scope !== "platform") {
      // No explicit org and not platform scope: restrict to the caller's orgs.
      const orgs = await provider.listActiveOrganizationMemberships(user.id);
      if (orgs.length === 0) return { status: 200, body: { jobs: [] } };
      filter.organizationId = { $in: orgs };
    }
  }

  const jobs = await provider.filterBackgroundJobs(filter, sortField, limit);
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

  return { status: 200, body: { jobs: safe } };
}

// --- Thin HTTP boundary ---
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const provider = createBase44Provider(base44);
    const user = await provider.getCurrentUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const result = await executeListBackgroundJobs(body, user, provider);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});