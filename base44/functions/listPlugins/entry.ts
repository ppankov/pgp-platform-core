import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Plugin Engine — listPlugins (Phase 5)
// Read-only. Supports two views:
//   - catalog (no organizationId): all definitions + all versions
//   - installed (organizationId provided): installations for that org + their
//     definitions and versions
// Read roles only.
//
// Phase 9 hardening: the installed (organizationId) view requires active
// OrganizationMember membership (Decision B2). Safe errors. Frozen contract unchanged.

const READ_ROLES = new Set(['super_admin', 'admin', 'core_developer', 'developer', 'solution_architect']);

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
    if (!READ_ROLES.has(user.role)) {
      return Response.json({ error: 'Not permitted to read the plugin catalog' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';

    const svc = base44.asServiceRole;

    if (organizationId) {
      // Phase 9: organization view requires active membership.
      if (user.role !== 'super_admin') {
        const membership = await activeMembership(svc, user.id, organizationId);
        if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
      }
      const installations = await svc.entities.PluginInstallation.filter({ organizationId });
      const defIds = [...new Set((installations || []).map((i) => i.pluginId))];
      const verIds = [...new Set((installations || []).map((i) => i.pluginVersionId))];
      const definitions = defIds.length
        ? await svc.entities.PluginDefinition.filter({ id: { $in: defIds } }).catch(() => [])
        : [];
      const versions = verIds.length
        ? await svc.entities.PluginVersion.filter({ id: { $in: verIds } }).catch(() => [])
        : [];
      return Response.json({
        status: 'ok',
        view: 'installed',
        organizationId,
        installations: installations || [],
        definitions: definitions || [],
        versions: versions || [],
      });
    }

    const definitions = await svc.entities.PluginDefinition.list();
    const versions = await svc.entities.PluginVersion.list();
    return Response.json({
      status: 'ok',
      view: 'catalog',
      definitions: definitions || [],
      versions: versions || [],
    });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});