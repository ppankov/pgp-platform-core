import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Workflow Engine — registerWorkflowDefinition (Phase 7)
// Creates a workflow definition identity. platform scope: core_developer/super_admin;
// organization scope: admin/super_admin. key is unique within scope.

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
    const key = str(body?.key);
    const name = str(body?.name);
    const scope = str(body?.scope);
    const organizationId = str(body?.organizationId);
    const description = str(body?.description);

    if (!key || !name || !scope) {
      return Response.json({ error: 'key, name and scope are required' }, { status: 400 });
    }
    if (scope !== 'platform' && scope !== 'organization') {
      return Response.json({ error: 'scope must be platform or organization' }, { status: 400 });
    }

    if (scope === 'platform') {
      if (organizationId) {
        return Response.json({ error: 'Platform-scoped definitions must not specify organizationId' }, { status: 400 });
      }
      if (role !== 'core_developer' && role !== 'super_admin') {
        return Response.json({ error: 'Not permitted to manage platform workflow definitions' }, { status: 403 });
      }
    } else {
      if (!organizationId) {
        return Response.json({ error: 'organizationId is required for organization-scoped definitions' }, { status: 400 });
      }
      if (role !== 'admin' && role !== 'super_admin') {
        return Response.json({ error: 'Not permitted to manage organization workflow definitions' }, { status: 403 });
      }
    }

    const svc = base44.asServiceRole;

    // Phase 9: org-scoped definitions require active OrganizationMember membership (Decision B2).
    if (scope === 'organization' && role !== 'super_admin') {
      const _members = await svc.entities.OrganizationMember.filter({ user_id: user.id, organization_id: organizationId, status: 'active' }).catch(() => []);
      if (!_members || _members.length === 0) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Phase 9: bounded input.
    if (key.length > 128 || name.length > 256) return Response.json({ error: 'key or name is too long' }, { status: 400 });

    // Uniqueness within scope: platform -> (scope, key); organization -> (scope, organizationId, key)
    const existing = await svc.entities.WorkflowDefinition.filter(
      scope === 'platform' ? { scope: 'platform', key } : { scope: 'organization', organizationId, key }
    );
    if (existing && existing.length > 0) {
      return Response.json({ error: 'Workflow definition key already exists in this scope' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const definition = await svc.entities.WorkflowDefinition.create({
      key, name, description, scope,
      organizationId: scope === 'platform' ? null : organizationId,
      active: true,
      currentVersionId: null,
      createdAt: now,
    });

    await publish(base44, 'workflow.definition_registered', definition.id, {
      workflowDefinitionId: definition.id, scope, organizationId: scope === 'platform' ? null : organizationId,
    });

    return Response.json({ status: 'created', definition });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});