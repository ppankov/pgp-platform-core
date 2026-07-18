import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Workflow Engine — completeWorkflowStep (Phase 7)
// Completes the current waiting manual step and advances. admin/super_admin.
// nextNodeKey required only when the current manual node has multiple outgoing edges.
// Idempotent when the instance is already terminal. Never executes arbitrary node logic.
//
// Phase 9 hardening: re-fetch instance, verify OrganizationMember membership of
// instance.organizationId before mutation. Safe errors. Frozen contract unchanged.

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function outgoingEdges(graph, key) { return (graph.edges || []).filter((e) => e.from === key); }
function getNode(graph, key) { return (graph.nodes || []).find((n) => n.key === key); }

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
      return Response.json({ error: 'Not permitted to progress workflow instances' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const workflowInstanceId = str(body?.workflowInstanceId);
    if (!workflowInstanceId) {
      return Response.json({ error: 'workflowInstanceId is required' }, { status: 400 });
    }
    const output = (body?.output && typeof body.output === 'object' && !Array.isArray(body.output)) ? body.output : {};
    const requestedNext = str(body?.nextNodeKey);

    const svc = base44.asServiceRole;
    const instance = await svc.entities.WorkflowInstance.get(workflowInstanceId).catch(() => null);
    if (!instance) return Response.json({ error: 'Workflow instance not found' }, { status: 404 });

    // Phase 9: verify membership of the instance's real organization.
    if (role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, instance.organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // idempotent on terminal states
    if (instance.status === 'completed') return Response.json({ status: 'already_completed', instance });
    if (instance.status === 'failed') return Response.json({ status: 'already_failed', instance });
    if (instance.status === 'cancelled') return Response.json({ status: 'already_cancelled', instance });
    if (instance.status !== 'waiting') {
      return Response.json({ error: 'No waiting step to complete (instance is not waiting)' }, { status: 400 });
    }

    const stepRuns = await svc.entities.WorkflowStepRun.filter({ workflowInstanceId, nodeKey: instance.currentNodeKey });
    const current = (stepRuns || []).find((s) => s.status === 'waiting');
    if (!current) {
      return Response.json({ error: 'No waiting step found for the current node' }, { status: 400 });
    }

    const version = await svc.entities.WorkflowVersion.get(instance.workflowVersionId).catch(() => null);
    if (!version) return Response.json({ error: 'Workflow version not found' }, { status: 400 });
    const graph = version.graph || {};
    const out = outgoingEdges(graph, instance.currentNodeKey);

    let nextNodeKey;
    if (out.length === 0) {
      return Response.json({ error: 'Current node has no outgoing edges' }, { status: 400 });
    } else if (out.length === 1) {
      nextNodeKey = out[0].to;
    } else {
      if (!requestedNext) {
        return Response.json({ error: 'nextNodeKey is required when multiple outgoing edges exist' }, { status: 400 });
      }
      if (!out.some((e) => e.to === requestedNext)) {
        return Response.json({ error: 'Invalid nextNodeKey: not among outgoing edges' }, { status: 400 });
      }
      nextNodeKey = requestedNext;
    }

    const now = new Date().toISOString();
    await svc.entities.WorkflowStepRun.update(current.id, {
      status: 'completed', output, completedAt: now,
    });
    await audit(svc, instance, 'workflow.step_completed', instance.currentNodeKey, user.id, { status: 'completed', nodeKey: instance.currentNodeKey });
    await publish(base44, 'workflow.step_completed', instance.id, {
      workflowDefinitionId: instance.workflowDefinitionId, workflowVersionId: instance.workflowVersionId,
      workflowInstanceId: instance.id, organizationId: instance.organizationId, nodeKey: instance.currentNodeKey, status: 'completed',
    });

    const nextNode = getNode(graph, nextNodeKey);
    if (!nextNode) return Response.json({ error: 'Next node not found' }, { status: 400 });

    let updatedInstance = instance;
    if (nextNode.type === 'end') {
      await svc.entities.WorkflowStepRun.create({
        workflowInstanceId: instance.id, nodeKey: nextNode.key, nodeType: 'end',
        status: 'completed', attemptCount: 1, input: {}, output,
        startedAt: now, completedAt: now, failedAt: null, lastError: null,
      });
      updatedInstance = await svc.entities.WorkflowInstance.update(instance.id, {
        status: 'completed', currentNodeKey: nextNode.key, output, completedAt: now,
      });
      await audit(svc, updatedInstance, 'workflow.instance_completed', nextNode.key, user.id, { status: 'completed', nodeKey: nextNode.key });
      await publish(base44, 'workflow.instance_completed', instance.id, {
        workflowDefinitionId: instance.workflowDefinitionId, workflowVersionId: instance.workflowVersionId,
        workflowInstanceId: instance.id, organizationId: instance.organizationId, nodeKey: nextNode.key, status: 'completed',
      });
    } else if (nextNode.type === 'manual') {
      await svc.entities.WorkflowStepRun.create({
        workflowInstanceId: instance.id, nodeKey: nextNode.key, nodeType: 'manual',
        status: 'waiting', attemptCount: 0, input: output, output: {},
        startedAt: now, completedAt: null, failedAt: null, lastError: null,
      });
      updatedInstance = await svc.entities.WorkflowInstance.update(instance.id, {
        status: 'waiting', currentNodeKey: nextNode.key,
      });
      await audit(svc, updatedInstance, 'workflow.step_waiting', nextNode.key, user.id, { status: 'waiting', nodeKey: nextNode.key });
    } else {
      return Response.json({ error: 'Unsupported next node type' }, { status: 400 });
    }

    return Response.json({ status: 'progressed', instance: updatedInstance, currentNodeKey: updatedInstance.currentNodeKey });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});