import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Connector Engine — listConnectors (Phase 6)
// Read-only catalog mode (definitions + providers) and optional organization connection view.
// Supports definitionId / providerId / status filters. Redacts credentialRef from all returned connections.
//
// Phase 9 hardening: when an organizationId view is requested, verify the
// caller is an active member of that organization (Decision B2). Allow-listed
// filters only. Safe errors. Frozen redaction contract unchanged.

const READ_ROLES = new Set(['super_admin', 'admin', 'core_developer', 'developer', 'solution_architect']);
const ALLOWED_STATUS = new Set(['configured', 'active', 'disabled', 'disconnected', 'error']);

function redact(connection) {
  if (!connection) return connection;
  const r = { ...connection };
  r.credentialRef = null;
  r.hasCredential = !!connection.credentialRef;
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
      return Response.json({ error: 'Not permitted to read connectors' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
    const definitionId = typeof body?.definitionId === 'string' ? body.definitionId.trim() : '';
    const providerId = typeof body?.providerId === 'string' ? body.providerId.trim() : '';
    const statusFilter = typeof body?.status === 'string' ? body.status.trim() : '';

    // Phase 9: allow-list the status filter; reject unknown filters.
    if (statusFilter && !ALLOWED_STATUS.has(statusFilter)) {
      return Response.json({ error: 'invalid status filter' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Phase 9: organization view requires active membership.
    if (organizationId && user.role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    let definitions = await svc.entities.ConnectorDefinition.list();
    let providers = await svc.entities.ConnectorProvider.list();
    if (definitionId) definitions = definitions.filter((d) => d.id === definitionId);
    if (definitionId) providers = providers.filter((p) => p.connectorDefinitionId === definitionId);
    if (providerId) providers = providers.filter((p) => p.id === providerId);

    const result = { status: 'ok', view: organizationId ? 'connections' : 'catalog', definitions, providers };

    if (organizationId) {
      let connections = await svc.entities.ConnectorConnection.filter({ organizationId });
      if (providerId) connections = connections.filter((c) => c.connectorProviderId === providerId);
      if (statusFilter) connections = connections.filter((c) => c.status === statusFilter);
      result.organizationId = organizationId;
      result.connections = connections.map(redact);
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});