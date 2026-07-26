import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { validateWorkflowGraph } from "npm:@ppankov/pgp-core-domain@0.1.0-alpha.1/workflow";

// Workflow Engine — registerWorkflowVersion (Phase 7)
// Creates a draft version with a validated declarative graph. Respects definition scope.
// workflowDefinitionId + version must be unique. Graph is declarative-only.
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
    const workflowDefinitionId = str(body?.workflowDefinitionId);
    const version = str(body?.version);
    if (!workflowDefinitionId || !version) {
      return Response.json({ error: 'workflowDefinitionId and version are required' }, { status: 400 });
    }
    const graph = body?.graph;
    if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
      return Response.json({ error: 'graph is required and must be an object' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const def = await svc.entities.WorkflowDefinition.get(workflowDefinitionId).catch(() => null);
    if (!def) return Response.json({ error: 'Workflow definition not found' }, { status: 404 });

    // scope permission
    if (def.scope === 'platform') {
      if (role !== 'core_developer' && role !== 'super_admin') {
        return Response.json({ error: 'Not permitted to manage versions for platform workflow definitions' }, { status: 403 });
      }
    } else {
      if (role !== 'admin' && role !== 'super_admin') {
        return Response.json({ error: 'Not permitted to manage versions for organization workflow definitions' }, { status: 403 });
      }
    }

    // Phase 9: org-scoped definitions require active OrganizationMember membership (Decision B2).
    if (def.scope === 'organization' && role !== 'super_admin') {
      const _members = await svc.entities.OrganizationMember.filter({ user_id: user.id, organization_id: def.organizationId, status: 'active' }).catch(() => []);
      if (!_members || _members.length === 0) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // duplicate version
    const existing = await svc.entities.WorkflowVersion.filter({ workflowDefinitionId, version });
    if (existing && existing.length > 0) {
      return Response.json({ error: 'Version already exists for this definition' }, { status: 409 });
    }

    const v = validateWorkflowGraph(graph);
    if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

    const checksum = str(body?.checksum);
    const now = new Date().toISOString();
    const wfVersion = await svc.entities.WorkflowVersion.create({
      workflowDefinitionId, version, graph,
      releaseStatus: 'draft', checksum, createdAt: now, releasedAt: null,
    });

    await publish(base44, 'workflow.version_registered', wfVersion.id, {
      workflowDefinitionId, workflowVersionId: wfVersion.id, version,
    });

    return Response.json({ status: 'created', version: wfVersion });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});