import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduler and Background Job Runtime — getBackgroundJob
// Read-only. Returns job metadata, attempts and audit. Organization visibility enforced.
// payload/result redacted for unauthorized roles; secret-looking keys recursively redacted.
// No stack traces.
//
// Phase 9 hardening: re-fetch job, verify OrganizationMember membership of
// job.organizationId for org-scope jobs before returning data (Decision B2). Safe errors.

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
// cap to 500 chars before returning to frontend. Stack traces never returned.
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
    if (!READ_ROLES.includes(user.role)) return Response.json({ error: "Not permitted to read jobs" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.backgroundJobId === "string" ? body.backgroundJobId.trim() : "";
    if (!id) return Response.json({ error: "backgroundJobId is required" }, { status: 400 });

    const svc = base44.asServiceRole;
    const job = await svc.entities.BackgroundJob.get(id).catch(() => null);
    if (!job) return Response.json({ error: "job not found" }, { status: 404 });

    // Phase 9: verify membership of the job's real organization (org scope).
    if (job.scope === "organization" && user.role !== "super_admin") {
      const membership = await activeMembership(svc, user.id, job.organizationId);
      if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    const full = FULL_ROLES.includes(user.role);

    const attempts = await svc.entities.JobAttempt.filter({ backgroundJobId: id }, "attemptNumber");
    const events = await svc.entities.JobExecutionEvent.filter({ backgroundJobId: id }, "createdAt");

    const safeJob = { ...job };
    if (!full) {
      safeJob.payload = null;
      safeJob.result = null;
    } else {
      safeJob.payload = job.payload ? redact(job.payload) : job.payload;
      safeJob.result = job.result ? redact(job.result) : job.result;
    }
    safeJob.lastError = job.lastError ? sanitizeErrorText(job.lastError) : job.lastError;

    return Response.json({
      job: safeJob,
      attempts: (attempts || []).map(a => ({ ...a, lastError: a.lastError ? sanitizeErrorText(a.lastError) : null })),
      events: events || [],
    });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});