import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Workflow Engine — failWorkflowStep (Phase 7)
// Fails the current waiting/running step and the instance. admin/super_admin.
// Stores safe error text only (never stack traces). No automatic retry.
//
// Phase 9 hardening: re-fetch instance, verify OrganizationMember membership of
// instance.organizationId before mutation. Bounded errorText. Safe errors. Frozen contract unchanged.

const str = (v) => (typeof v === 'string' ? v.trim() : '');

async function activeMembership(svc, userId, orgId) {
  if (!orgId) return null;
  const list = await svc.entities.OrganizationMember.filter({ user_id: userId, organization_id: orgId }).catch(() => []);
  return (list || []).find((m) => m.status === 'active') || null;
}
function safeMsg(e) {
  const m = (e && e.message) ? String(e.message) : 'Unexpected error';
  return m.length > 200 ? m.slice(0, 200) : m;
}

async function publish(base44, eventType, sourceId, payload) {
  try {
    await base44.functions.invoke('publishEvent', {
      eventType, sourceType: 'workflow', sourceId: String(sourceId), payload,
    });
  } catch (_e) { /* best-effort */ }
}

async function audit(svc, inst, eventType, nodeKey, actorId, metadata) {
  try {
    await svc.entities.WorkflowExecutionEvent.create({
      workflowInstanceId: inst.id, workflowDefinitionId: inst.workflowDefinitionId,
      workflowVersionId: inst.workflowVersionId, organizationId: inst.organizationId,
      eventType, nodeKey: nodeKey || null, actorId, correlationId: inst.correlationId || null,
      metadata: metadata || {}, createdAt: new Date().toISOString(),
    });
  } catch (_e) { /* append-only best-effort */ }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'admin' && role !== 'super_admin') {
      return Response.json({ error: 'Not permitted to fail workflow steps' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const workflowInstanceId = str(body?.workflowInstanceId);
    if (!workflowInstanceId) {
      return Response.json({ error: 'workflowInstanceId is required' }, { status: 400 });
    }
    let errorText = str(body?.error) || 'Step failed';
    // Phase 9: bounded error text (safe storage only).
    if (errorText.length > 1000) errorText = errorText.slice(0, 1000);

    const svc = base44.asServiceRole;
    const instance = await svc.entities.WorkflowInstance.get(workflowInstanceId).catch(() => null);
    if (!instance) return Response.json({ error: 'Workflow instance not found' }, { status: 404 });

    // Phase 9: verify membership of the instance's real organization.
    if (role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, instance.organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    if (instance.status === 'completed') return Response.json({ status: 'already_completed', instance });
    if (instance.status === 'failed') return Response.json({ status: 'already_failed', instance });
    if (instance.status === 'cancelled') return Response.json({ status: 'already_cancelled', instance });
    if (instance.status !== 'waiting' && instance.status !== 'running') {
      return Response.json({ error: 'Instance is not in a failable state' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const stepRuns = await svc.entities.WorkflowStepRun.filter({ workflowInstanceId, nodeKey: instance.currentNodeKey });
    const current = (stepRuns || []).find((s) => s.status === 'waiting' || s.status === 'running');
    if (current) {
      await svc.entities.WorkflowStepRun.update(current.id, {
        status: 'failed', failedAt: now, lastError: errorText,
      });
      await audit(svc, instance, 'workflow.step_failed', instance.currentNodeKey, user.id, { status: 'failed', nodeKey: instance.currentNodeKey });
      await publish(base44, 'workflow.step_failed', instance.id, {
        workflowDefinitionId: instance.workflowDefinitionId, workflowVersionId: instance.workflowVersionId,
        workflowInstanceId: instance.id, organizationId: instance.organizationId, nodeKey: instance.currentNodeKey, status: 'failed',
      });
    }

    const updatedInstance = await svc.entities.WorkflowInstance.update(instance.id, {
      status: 'failed', failedAt: now, lastError: errorText,
    });
    await audit(svc, updatedInstance, 'workflow.instance_failed', instance.currentNodeKey, user.id, { status: 'failed' });
    await publish(base44, 'workflow.instance_failed', instance.id, {
      workflowDefinitionId: instance.workflowDefinitionId, workflowVersionId: instance.workflowVersionId,
      workflowInstanceId: instance.id, organizationId: instance.organizationId, status: 'failed',
    });

    return Response.json({ status: 'failed', instance: updatedInstance });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});