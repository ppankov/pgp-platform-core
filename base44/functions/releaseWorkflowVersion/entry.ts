import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { validateWorkflowGraph } from "npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/workflow";

// Workflow Engine — releaseWorkflowVersion (Phase 7)
// Revalidates the graph, marks a draft as released (immutable), sets releasedAt,
// and updates the definition's currentVersionId. Released versions are immutable.
// Wave 10.3B: graph validation delegated to @ppankov/pgp-core-domain (exact version pin).

const str = (v) => (typeof v === 'string' ? v.trim() : '');

async function publish(base44, eventType, sourceId, payload) {
  try {
    await base44.functions.invoke('publishEvent', {
      eventType, sourceType: 'workflow', sourceId: String(sourceId), payload,
    });
  } catch (_e) { /* best-effort */ }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    const body = await req.json().catch(() => ({}));
    const workflowVersionId = str(body?.workflowVersionId);
    if (!workflowVersionId) {
      return Response.json({ error: 'workflowVersionId is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const version = await svc.entities.WorkflowVersion.get(workflowVersionId).catch(() => null);
    if (!version) return Response.json({ error: 'Workflow version not found' }, { status: 404 });

    if (version.releaseStatus !== 'draft') {
      return Response.json({ error: 'Only draft versions can be released; released versions are immutable' }, { status: 400 });
    }

    const def = await svc.entities.WorkflowDefinition.get(version.workflowDefinitionId).catch(() => null);
    if (!def) return Response.json({ error: 'Workflow definition not found' }, { status: 404 });

    if (def.scope === 'platform') {
      if (role !== 'core_developer' && role !== 'super_admin') {
        return Response.json({ error: 'Not permitted to release platform workflow versions' }, { status: 403 });
      }
    } else {
      if (role !== 'admin' && role !== 'super_admin') {
        return Response.json({ error: 'Not permitted to release organization workflow versions' }, { status: 403 });
      }
    }

    // Phase 9: org-scoped definitions require active OrganizationMember membership (Decision B2).
    if (def.scope === 'organization' && role !== 'super_admin') {
      const _members = await svc.entities.OrganizationMember.filter({ user_id: user.id, organization_id: def.organizationId, status: 'active' }).catch(() => []);
      if (!_members || _members.length === 0) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const v = validateWorkflowGraph(version.graph);
    if (!v.ok) return Response.json({ error: 'Graph validation failed on release: ' + v.error }, { status: 400 });

    const now = new Date().toISOString();
    await svc.entities.WorkflowVersion.update(workflowVersionId, {
      releaseStatus: 'released', releasedAt: now,
    });
    await svc.entities.WorkflowDefinition.update(def.id, { currentVersionId: workflowVersionId });

    await publish(base44, 'workflow.version_released', workflowVersionId, {
      workflowDefinitionId: def.id, workflowVersionId, version: version.version,
    });

    return Response.json({ status: 'released', workflowVersionId });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});