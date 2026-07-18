import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Workflow Engine — getWorkflowInstance (Phase 7)
// Read-only. Returns definition, version, instance, current node, step runs and audit events.
// Never exposes secret-looking input/output values (redacted on read).
//
// Phase 9 hardening: re-fetch instance, verify OrganizationMember membership of
// instance.organizationId before returning data (Decision B2). Safe errors. Frozen contract unchanged.

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const SECRET_KEY = /secret|token|password|passwd|credential|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|bearer|authorization/i;

function redact(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (SECRET_KEY.test(k)) out[k] = null;
    else if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) out[k] = redact(obj[k]);
    else out[k] = obj[k];
  }
  return out;
}

async function activeMembership(svc, userId, orgId) {
  if (!orgId) return null;
  const list = await svc.entities.OrganizationMember.filter({ user_id: userId, organization_id: orgId }).catch(() => []);
  return (list || []).find((m) => m.status === 'active') || null;
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

    const role = user.role;
    if (role !== 'developer' && role !== 'solution_architect' && role !== 'core_developer' && role !== 'admin' && role !== 'super_admin') {
      return Response.json({ error: 'Not permitted to view workflow instances' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const workflowInstanceId = str(body?.workflowInstanceId);
    if (!workflowInstanceId) {
      return Response.json({ error: 'workflowInstanceId is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const instance = await svc.entities.WorkflowInstance.get(workflowInstanceId).catch(() => null);
    if (!instance) return Response.json({ error: 'Workflow instance not found' }, { status: 404 });

    // Phase 9: verify membership of the instance's real organization.
    if (role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, instance.organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const definition = await svc.entities.WorkflowDefinition.get(instance.workflowDefinitionId).catch(() => null);
    const version = await svc.entities.WorkflowVersion.get(instance.workflowVersionId).catch(() => null);
    const stepRuns = await svc.entities.WorkflowStepRun.filter({ workflowInstanceId: instance.id });
    const events = await svc.entities.WorkflowExecutionEvent.filter({ workflowInstanceId: instance.id });

    // redact secret-looking transport data
    instance.input = redact(instance.input);
    instance.output = redact(instance.output);
    for (const sr of stepRuns) { sr.input = redact(sr.input); sr.output = redact(sr.output); }

    const graph = version ? (version.graph || {}) : {};
    const currentNode = (graph.nodes || []).find((n) => n.key === instance.currentNodeKey) || null;

    return Response.json({
      status: 'ok', definition, version, instance, currentNode,
      stepRuns: stepRuns.sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || '')),
      events: events.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});