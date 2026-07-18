import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Workflow Engine — startWorkflow (Phase 7)
// Starts an instance of a released workflow version. admin/super_admin.
// Processes the start node internally, then advances to the next node:
//   - manual -> create a waiting StepRun (instance waiting)
//   - end -> complete the instance
// Start must have a single outgoing edge to auto-advance.
//
// Phase 9 hardening: verify active OrganizationMember membership of the requested
// organizationId before starting (Decision B2). Safe errors. Frozen contract unchanged.

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
      return Response.json({ error: 'Not permitted to start workflow instances' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const workflowDefinitionId = str(body?.workflowDefinitionId);
    const organizationId = str(body?.organizationId);
    if (!workflowDefinitionId || !organizationId) {
      return Response.json({ error: 'workflowDefinitionId and organizationId are required' }, { status: 400 });
    }
    const resourceType = body?.resourceType ? String(body.resourceType) : null;
    const resourceId = body?.resourceId ? String(body.resourceId) : null;
    const input = (body?.input && typeof body.input === 'object' && !Array.isArray(body.input)) ? body.input : {};
    const correlationId = body?.correlationId ? String(body.correlationId) : null;

    const svc = base44.asServiceRole;

    // Phase 9: verify membership of the target organization.
    if (role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const def = await svc.entities.WorkflowDefinition.get(workflowDefinitionId).catch(() => null);
    if (!def) return Response.json({ error: 'Workflow definition not found' }, { status: 404 });
    if (def.active === false) {
      return Response.json({ error: 'Workflow definition is not active' }, { status: 400 });
    }

    if (def.scope === 'organization') {
      if (def.organizationId !== organizationId) {
        return Response.json({ error: 'Organization scope mismatch: instance organization must match the definition organization' }, { status: 400 });
      }
    }

    let version;
    const requestedVersionId = str(body?.workflowVersionId);
    if (requestedVersionId) {
      version = await svc.entities.WorkflowVersion.get(requestedVersionId).catch(() => null);
      if (!version) return Response.json({ error: 'Workflow version not found' }, { status: 404 });
      if (version.workflowDefinitionId !== workflowDefinitionId) {
        return Response.json({ error: 'Version does not belong to this definition' }, { status: 400 });
      }
      if (version.releaseStatus !== 'released') {
        return Response.json({ error: 'Workflow version is not released' }, { status: 400 });
      }
    } else {
      if (!def.currentVersionId) {
        return Response.json({ error: 'No released version available for this workflow' }, { status: 400 });
      }
      version = await svc.entities.WorkflowVersion.get(def.currentVersionId).catch(() => null);
      if (!version) return Response.json({ error: 'Current released version not found' }, { status: 400 });
    }

    const graph = version.graph || {};
    const startNode = (graph.nodes || []).find((n) => n.type === 'start');
    if (!startNode) {
      return Response.json({ error: 'Graph has no start node' }, { status: 400 });
    }
    const startOut = outgoingEdges(graph, startNode.key);
    if (startOut.length === 0) {
      return Response.json({ error: 'Start node has no outgoing edge' }, { status: 400 });
    }
    if (startOut.length > 1) {
      return Response.json({ error: 'Start node must have a single outgoing edge to auto-start; use a manual node for branching' }, { status: 400 });
    }
    const nextNodeKey = startOut[0].to;
    const nextNode = getNode(graph, nextNodeKey);
    if (!nextNode) {
      return Response.json({ error: 'Start node points to an unknown node' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const instance = await svc.entities.WorkflowInstance.create({
      workflowDefinitionId, workflowVersionId: version.id, organizationId,
      resourceType, resourceId,
      status: 'running', currentNodeKey: startNode.key,
      input, output: {},
      correlationId, startedById: user.id, startedAt: now,
      completedAt: null, failedAt: null, cancelledAt: null, lastError: null,
    });

    await audit(svc, instance, 'workflow.instance_started', startNode.key, user.id, { status: 'running' });
    await svc.entities.WorkflowStepRun.create({
      workflowInstanceId: instance.id, nodeKey: startNode.key, nodeType: 'start',
      status: 'completed', attemptCount: 1, input: {}, output: {},
      startedAt: now, completedAt: now, failedAt: null, lastError: null,
    });
    await publish(base44, 'workflow.instance_started', instance.id, {
      workflowDefinitionId, workflowVersionId: version.id, workflowInstanceId: instance.id, organizationId, nodeKey: startNode.key, status: 'running',
    });

    let updatedInstance = instance;
    if (nextNode.type === 'end') {
      await svc.entities.WorkflowStepRun.create({
        workflowInstanceId: instance.id, nodeKey: nextNode.key, nodeType: 'end',
        status: 'completed', attemptCount: 1, input: {}, output: {},
        startedAt: now, completedAt: now, failedAt: null, lastError: null,
      });
      updatedInstance = await svc.entities.WorkflowInstance.update(instance.id, {
        status: 'completed', currentNodeKey: nextNode.key, output: input, completedAt: now,
      });
      await audit(svc, updatedInstance, 'workflow.instance_completed', nextNode.key, user.id, { status: 'completed', nodeKey: nextNode.key });
      await publish(base44, 'workflow.instance_completed', instance.id, {
        workflowDefinitionId, workflowVersionId: version.id, workflowInstanceId: instance.id, organizationId, nodeKey: nextNode.key, status: 'completed',
      });
    } else if (nextNode.type === 'manual') {
      await svc.entities.WorkflowStepRun.create({
        workflowInstanceId: instance.id, nodeKey: nextNode.key, nodeType: 'manual',
        status: 'waiting', attemptCount: 0, input: {}, output: {},
        startedAt: now, completedAt: null, failedAt: null, lastError: null,
      });
      updatedInstance = await svc.entities.WorkflowInstance.update(instance.id, {
        status: 'waiting', currentNodeKey: nextNode.key,
      });
      await audit(svc, updatedInstance, 'workflow.step_waiting', nextNode.key, user.id, { status: 'waiting', nodeKey: nextNode.key });
    } else {
      return Response.json({ error: 'Unsupported next node type after start' }, { status: 400 });
    }

    return Response.json({ status: 'started', instance: updatedInstance, currentNodeKey: updatedInstance.currentNodeKey });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});