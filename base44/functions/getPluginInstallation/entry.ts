import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Plugin Engine — getPluginInstallation (Phase 5)
// Read-only. Returns the definition, the selected version, and the installation
// state. Resolves by installationId, or by (pluginId + organizationId) for the
// active installation. Read roles only.
//
// Phase 9 hardening: verify OrganizationMember membership of the installation's
// real organization. For (pluginId + organizationId) lookup, membership of the
// requested org is verified BEFORE the lookup. Safe errors. Frozen contract unchanged.

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
      return Response.json({ error: 'Not permitted to read plugin installations' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const installationId = typeof body?.installationId === 'string' ? body.installationId.trim() : '';
    const pluginId = typeof body?.pluginId === 'string' ? body.pluginId.trim() : '';
    const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';

    const svc = base44.asServiceRole;

    // Phase 9: for (pluginId + organizationId) lookup, verify membership first.
    if (!installationId && pluginId && organizationId) {
      if (user.role !== 'super_admin') {
        const membership = await activeMembership(svc, user.id, organizationId);
        if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
      }
    } else if (!installationId) {
      return Response.json({ error: 'installationId or (pluginId and organizationId) is required' }, { status: 400 });
    }

    let installation = null;
    if (installationId) {
      installation = await svc.entities.PluginInstallation.get(installationId).catch(() => null);
    } else {
      const list = await svc.entities.PluginInstallation.filter({ pluginId, organizationId });
      installation = (list || []).find((i) => !i.uninstalledAt) || null;
    }

    if (!installation) return Response.json({ error: 'Installation not found' }, { status: 404 });

    // Phase 9: for id-based reads, verify membership of the real org.
    if (installationId && user.role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, installation.organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const definition = await svc.entities.PluginDefinition.get(installation.pluginId).catch(() => null);
    const version = await svc.entities.PluginVersion.get(installation.pluginVersionId).catch(() => null);

    return Response.json({ status: 'ok', definition, version, installation });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});