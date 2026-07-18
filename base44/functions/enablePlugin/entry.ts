import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Plugin Engine — enablePlugin (Phase 5)
// Enables an installed (non-uninstalled) plugin installation. Idempotent when
// already enabled. Rejects uninstalled installations. Admin / super_admin only.
//
// Phase 9 hardening: re-fetch installation, verify OrganizationMember membership
// of installation.organizationId before mutation. Safe errors. Frozen contract unchanged.

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
      eventType, sourceType: 'plugin', sourceId: String(sourceId), payload,
    });
  } catch (_e) { /* best-effort */ }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'admin' && role !== 'super_admin') {
      return Response.json({ error: 'Not permitted to enable plugins' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const installationId = typeof body?.installationId === 'string' ? body.installationId.trim() : '';
    if (!installationId) return Response.json({ error: 'installationId is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const installation = await svc.entities.PluginInstallation.get(installationId).catch(() => null);
    if (!installation) return Response.json({ error: 'Installation not found' }, { status: 404 });

    // Phase 9: verify membership of the installation's real organization.
    if (role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, installation.organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    if (installation.uninstalledAt) {
      return Response.json({ error: 'Cannot enable an uninstalled installation' }, { status: 400 });
    }
    if (installation.enabled === true) {
      return Response.json({ status: 'already_enabled', installation });
    }

    const updated = await svc.entities.PluginInstallation.update(installationId, {
      enabled: true,
      disabledAt: null,
    });

    await publish(base44, 'plugin.enabled', installationId, {
      installationId,
      pluginId: installation.pluginId,
      organizationId: installation.organizationId,
    });

    return Response.json({ status: 'enabled', installation: updated });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});