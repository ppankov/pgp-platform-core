import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Connector Engine — activateConnectorConnection (Phase 6)
// Moves a configured/disabled connection to active. admin/super_admin only.
// Requires credentialRef when the provider auth mode requires credentials.
// Performs NO external API call. active means administratively enabled, NOT externally verified.
// Idempotent when already active; rejects activation of a disconnected connection.
//
// Phase 9 hardening: re-fetch connection, verify OrganizationMember active
// membership of connection.organizationId before mutation (Decision B2).
// Safe error responses. Frozen business contract unchanged.

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
      eventType, sourceType: 'connector', sourceId: String(sourceId), payload,
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
      return Response.json({ error: 'Not permitted to activate connector connections' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body?.connectionId === 'string' ? body.connectionId.trim() : '';
    if (!connectionId) return Response.json({ error: 'connectionId is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const connection = await svc.entities.ConnectorConnection.get(connectionId).catch(() => null);
    if (!connection) return Response.json({ error: 'Connector connection not found' }, { status: 404 });

    // Phase 9: verify membership of the connection's real organization.
    if (role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, connection.organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    if (connection.status === 'disconnected') {
      return Response.json({ error: 'Cannot activate a disconnected connection' }, { status: 400 });
    }
    if (connection.status === 'active') {
      return Response.json({ status: 'already_active', connection });
    }

    // Require credentialRef when provider auth mode requires credentials.
    const provider = await svc.entities.ConnectorProvider.get(connection.connectorProviderId).catch(() => null);
    if (!provider) return Response.json({ error: 'Connector provider not found' }, { status: 404 });
    const requiresCredentials = !provider.authModes || !provider.authModes.every((m) => m === 'none');
    if (requiresCredentials && !connection.credentialRef) {
      return Response.json({ error: 'credentialRef is required to activate this connection' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updated = await svc.entities.ConnectorConnection.update(connectionId, {
      status: 'active', enabled: true, enabledAt: now, disabledAt: null,
    });

    await publish(base44, 'connector.connection_activated', connectionId, {
      connectionId: connectionId, connectorProviderId: connection.connectorProviderId,
      organizationId: connection.organizationId, status: 'active', enabled: true,
    });

    return Response.json({ status: 'activated', connection: updated });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});