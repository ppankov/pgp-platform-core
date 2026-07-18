import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Connector Engine — disableConnectorConnection (Phase 6)
// Moves an active/configured connection to disabled. admin/super_admin only.
// Idempotent when already disabled or disconnected. Preserves configuration and credentialRef.
//
// Phase 9 hardening: re-fetch + OrganizationMember membership verification of
// connection.organizationId before mutation. Safe errors. Frozen contract unchanged.

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
      return Response.json({ error: 'Not permitted to disable connector connections' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body?.connectionId === 'string' ? body.connectionId.trim() : '';
    if (!connectionId) return Response.json({ error: 'connectionId is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const connection = await svc.entities.ConnectorConnection.get(connectionId).catch(() => null);
    if (!connection) return Response.json({ error: 'Connector connection not found' }, { status: 404 });

    if (role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, connection.organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    if (connection.status === 'disabled' || connection.status === 'disconnected') {
      return Response.json({ status: 'already_disabled', connection });
    }

    const now = new Date().toISOString();
    const updated = await svc.entities.ConnectorConnection.update(connectionId, {
      status: 'disabled', enabled: false, disabledAt: now,
    });

    await publish(base44, 'connector.connection_disabled', connectionId, {
      connectionId: connectionId, connectorProviderId: connection.connectorProviderId,
      organizationId: connection.organizationId, status: 'disabled', enabled: false,
    });

    return Response.json({ status: 'disabled', connection: updated });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});