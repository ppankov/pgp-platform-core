import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Workflow Engine — listWorkflows (Phase 7)
// Read-only catalog mode with optional organization instance view.
// Filters by scope, status and organization. developer/solution_architect/core_developer/admin/super_admin.
//
// Phase 9 hardening: the organization instance view requires active OrganizationMember
// membership (Decision B2). Without an explicit organizationId, non-super_admin callers
// are restricted to their membership orgs for the instance view (no cross-tenant reads).
// Safe errors. Frozen catalog contract unchanged.

const str = (v) => (typeof v === 'string' ? v.trim() : '');

async function activeMembership(svc, userId, orgId) {
  if (!orgId) return null;
  const list = await svc.entities.OrganizationMember.filter({ user_id: userId, organization_id: orgId }).catch(() => []);
  return (list || []).find((m) => m.status === 'active') || null;
}
async function activeMemberships(svc, userId) {
  const list = await svc.entities.OrganizationMember.filter({ user_id: userId, status: "active" }).catch(() => []);
  return (list || []).map((m) => m.organization_id);
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
      return Response.json({ error: 'Not permitted to view workflows' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    let organizationId = str(body?.organizationId);
    const scope = str(body?.scope);
    const status = str(body?.status);

    const svc = base44.asServiceRole;

    // Phase 9: if an organizationId is provided, verify membership before revealing
    // organization-scoped definitions/instances.
    if (organizationId && role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Catalog: definitions
    let definitions = await svc.entities.WorkflowDefinition.list();
    if (scope) definitions = definitions.filter((d) => d.scope === scope);
    if (organizationId) definitions = definitions.filter((d) => d.scope === 'platform' || d.organizationId === organizationId);

    // Versions (released only for the catalog view)
    const defIds = definitions.map((d) => d.id);
    let versions = await svc.entities.WorkflowVersion.list();
    versions = versions.filter((v) => defIds.includes(v.workflowDefinitionId));

    const result = { definitions, versions };

    // Optional organization instance view
    if (organizationId) {
      let instances = await svc.entities.WorkflowInstance.filter({ organizationId });
      if (status) instances = instances.filter((i) => i.status === status);
      result.instances = instances;
    } else if (role !== 'super_admin') {
      // Phase 9: no explicit org — restrict the instance view to the caller's orgs.
      const orgs = await activeMemberships(svc, user.id);
      if (orgs.length > 0) {
        let instances = await svc.entities.WorkflowInstance.filter({ organizationId: { $in: orgs } });
        if (status) instances = instances.filter((i) => i.status === status);
        result.instances = instances;
      } else {
        result.instances = [];
      }
    }

    return Response.json({ status: 'ok', ...result });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});