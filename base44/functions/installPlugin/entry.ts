import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Plugin Engine — installPlugin (Phase 5)
// Installs a RELEASED version of an ACTIVE definition into an organization.
// Idempotent for the same plugin + organization + version. Preserves installation
// history (uninstalled records are never reused). Creates no executable runtime.
// Admin / super_admin only. Best-effort event.
//
// Phase 9 hardening: verify OrganizationMember active membership of the target
// organizationId before installing (Decision B2). Safe errors. Frozen contract
// unchanged.

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
      return Response.json({ error: 'Not permitted to install plugins' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const pluginId = typeof body?.pluginId === 'string' ? body.pluginId.trim() : '';
    const pluginVersionId = typeof body?.pluginVersionId === 'string' ? body.pluginVersionId.trim() : '';
    const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
    if (!pluginId || !pluginVersionId || !organizationId) {
      return Response.json({ error: 'pluginId, pluginVersionId and organizationId are required' }, { status: 400 });
    }

    const configuration = body?.configuration;
    if (configuration !== undefined && configuration !== null) {
      if (typeof configuration !== 'object' || Array.isArray(configuration)) {
        return Response.json({ error: 'configuration must be an object' }, { status: 400 });
      }
    }

    const svc = base44.asServiceRole;

    // Phase 9: verify membership of the target organization.
    if (role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Definition must exist and be active.
    const definition = await svc.entities.PluginDefinition.get(pluginId).catch(() => null);
    if (!definition) return Response.json({ error: 'Plugin definition not found' }, { status: 404 });
    if (definition.active === false) {
      return Response.json({ error: 'Plugin definition is not active' }, { status: 400 });
    }

    // Version must exist, belong to this definition, and be released.
    const version = await svc.entities.PluginVersion.get(pluginVersionId).catch(() => null);
    if (!version) return Response.json({ error: 'Plugin version not found' }, { status: 404 });
    if (version.pluginId !== pluginId) {
      return Response.json({ error: 'Plugin version does not belong to this definition' }, { status: 400 });
    }
    if (version.releaseStatus !== 'released') {
      return Response.json({ error: 'Plugin version is not released' }, { status: 400 });
    }

    // One active installation per plugin + organization (uninstalledAt == null).
    const existing = await svc.entities.PluginInstallation.filter({ pluginId, organizationId });
    const active = (existing || []).find((i) => !i.uninstalledAt);
    if (active) {
      if (active.pluginVersionId === pluginVersionId) {
        // Idempotent: same version already installed.
        return Response.json({ status: 'already_installed', installation: active });
      }
      return Response.json(
        { error: 'Plugin is already installed for this organization with a different version; uninstall first' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const installation = await svc.entities.PluginInstallation.create({
      pluginId,
      pluginVersionId,
      organizationId,
      configuration: configuration || {},
      enabled: false,
      installedById: user.id,
      installedAt: now,
      disabledAt: null,
      uninstalledAt: null,
    });

    await publish(base44, 'plugin.installed', installation.id, {
      installationId: installation.id,
      pluginId,
      pluginVersionId,
      organizationId,
    });

    return Response.json({ status: 'installed', installation });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});