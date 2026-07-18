import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Connector Engine — getConnectorConnection (Phase 6)
// Read-only, organization-scoped resolution of a connection by id or by (provider, org, name).
// Returns definition + provider + connection metadata. Redacts credentialRef unless explicitly
// permitted for backend management use (revealCredentialRef=true AND core_developer/super_admin).
//
// Phase 9 hardening: verify OrganizationMember membership of the connection's
// real organizationId before returning data (Decision B2). For (provider,org,name)
// lookup, membership of the requested org is verified BEFORE the lookup. Safe
// errors. Frozen redaction contract unchanged.

const READ_ROLES = new Set(['super_admin', 'admin', 'core_developer', 'developer', 'solution_architect']);

function redact(connection, reveal) {
  if (!connection) return connection;
  const r = { ...connection };
  if (!reveal) {
    r.credentialRef = null;
    r.hasCredential = !!connection.credentialRef;
  }
  return r;
}

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
      return Response.json({ error: 'Not permitted to read connector connections' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body?.connectionId === 'string' ? body.connectionId.trim() : '';
    const connectorProviderId = typeof body?.connectorProviderId === 'string' ? body.connectorProviderId.trim() : '';
    const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
    const byName = typeof body?.name === 'string' ? body.name.trim() : '';

    const reveal = body?.revealCredentialRef === true &&
      (user.role === 'core_developer' || user.role === 'super_admin');

    const svc = base44.asServiceRole;

    // Phase 9: for the (provider, org, name) lookup, verify membership BEFORE
    // resolving, so a foreign organizationId cannot be probed.
    if (!connectionId && connectorProviderId && organizationId && byName) {
      if (user.role !== 'super_admin') {
        const membership = await activeMembership(svc, user.id, organizationId);
        if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
      }
    } else if (!connectionId) {
      return Response.json({ error: 'connectionId or (connectorProviderId, organizationId, name) is required' }, { status: 400 });
    }

    let connection = null;
    if (connectionId) {
      connection = await svc.entities.ConnectorConnection.get(connectionId).catch(() => null);
    } else {
      const list = await svc.entities.ConnectorConnection.filter({ connectorProviderId, organizationId });
      connection = (list || []).find((c) => c.name === byName && c.status !== 'disconnected') || null;
    }

    if (!connection) return Response.json({ error: 'Connector connection not found' }, { status: 404 });

    // Phase 9: for id-based reads, verify membership of the connection's real org.
    if (connectionId && user.role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, connection.organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const definition = await svc.entities.ConnectorDefinition.get(connection.connectorDefinitionId).catch(() => null);
    const provider = await svc.entities.ConnectorProvider.get(connection.connectorProviderId).catch(() => null);

    return Response.json({
      status: 'ok',
      definition, provider,
      connection: redact(connection, reveal),
    });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});