import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Phase 9 — Workflow runtime read function for WorkflowStepRun (Template B entity).
// WorkflowStepRun has no organizationId; tenant isolation is established by joining to
// WorkflowInstance (which carries organizationId). Non-super_admin callers are restricted
// to step runs belonging to instances in organizations where they hold an ACTIVE membership.
// status filter is allow-listed; optional workflowInstanceId; pagination bounded.
// input/output are redacted (secret-looking keys). auth.me() required; role gate developer+.
// Safe errors; no unbounded reads.

const READ_ROLES = new Set(['super_admin', 'admin', 'core_developer', 'developer', 'solution_architect']);
const ALLOWED_STATUS = new Set(['pending', 'running', 'waiting', 'completed', 'failed', 'skipped']);
const SECRET_KEYS = ['password', 'passwd', 'secret', 'token', 'access_token', 'refresh_token', 'api_key', 'apikey', 'client_secret', 'private_key', 'credential', 'credentialref', 'authorization', 'cookie', 'session'];

function redact(v, d = 0) {
  if (d > 12 || v == null || typeof v !== 'object') return v;
  const out = Array.isArray(v) ? [] : {};
  for (const k of Object.keys(v)) {
    const lk = String(k).toLowerCase();
    if (SECRET_KEYS.some((s) => lk.includes(s))) out[k] = '[redacted]';
    else out[k] = redact(v[k], d + 1);
  }
  return out;
}

function safeStep(s) {
  if (!s) return null;
  return {
    id: s.id,
    workflowInstanceId: s.workflowInstanceId,
    nodeKey: s.nodeKey,
    nodeType: s.nodeType,
    status: s.status,
    attemptCount: s.attemptCount,
    input: s.input ? redact(s.input) : s.input,
    output: s.output ? redact(s.output) : s.output,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    failedAt: s.failedAt,
    lastError: typeof s.lastError === 'string' ? s.lastError.slice(0, 500) : s.lastError,
  };
}

async function activeMembershipOrgs(svc, userId) {
  const list = await svc.entities.OrganizationMember.filter({ user_id: userId, status: 'active' }).catch(() => []);
  return [...new Set((list || []).map((m) => m.organization_id))];
}

function safeMsg(e) {
  const m = (e && e.message) ? String(e.message) : 'Unexpected error';
  return m.length > 200 ? m.slice(0, 200) : m;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!READ_ROLES.has(user.role)) return Response.json({ error: 'Not permitted to read workflow step runs' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const filter = {};
    const statusFilter = typeof body?.status === 'string' ? body.status.slice(0, 32) : '';
    if (statusFilter && ALLOWED_STATUS.has(statusFilter)) filter.status = statusFilter;
    if (typeof body?.workflowInstanceId === 'string' && body.workflowInstanceId.trim()) {
      filter.workflowInstanceId = body.workflowInstanceId.trim().slice(0, 128);
    }

    let limit = 50;
    if (body?.limit !== undefined && body?.limit !== null) {
      const n = Number(body.limit);
      if (Number.isInteger(n)) limit = n;
    }
    if (limit < 1) limit = 50;
    if (limit > 100) limit = 100;
    const offset = Number.isInteger(body?.offset) && body.offset >= 0 ? body.offset : 0;

    const svc = base44.asServiceRole;

    // Tenant scoping: resolve the set of instance ids the caller may see.
    let instanceIds = null;
    if (user.role !== 'super_admin') {
      const orgs = await activeMembershipOrgs(svc, user.id);
      if (orgs.length === 0) return Response.json({ status: 'ok', stepRuns: [], total: 0 });
      const instances = await svc.entities.WorkflowInstance.filter({ organizationId: { $in: orgs } }).catch(() => []);
      instanceIds = (instances || []).map((i) => i.id);
      if (instanceIds.length === 0) return Response.json({ status: 'ok', stepRuns: [], total: 0 });
    }

    // If a specific instance was requested, ensure it is within scope.
    if (filter.workflowInstanceId && instanceIds && !instanceIds.includes(filter.workflowInstanceId)) {
      return Response.json({ error: 'Not permitted to read this workflow instance' }, { status: 403 });
    }

    const query = { ...filter };
    if (instanceIds && !query.workflowInstanceId) {
      query.workflowInstanceId = { $in: instanceIds };
    } else if (instanceIds && query.workflowInstanceId) {
      // already validated in scope
    }

    const all = await svc.entities.WorkflowStepRun.filter(query, '-created_date', 1000);
    const total = all.length;
    const paged = all.slice(offset, offset + limit);
    return Response.json({ status: 'ok', stepRuns: paged.map(safeStep), total, limit, offset });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});