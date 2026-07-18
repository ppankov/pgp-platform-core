import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Connector Engine — createConnectorConnection (Phase 6)
// Creates an organization-scoped connection to an active provider. admin/super_admin only.
// Validates non-secret configuration, accepts an opaque credentialRef, sets status=configured.
// Idempotent for equivalent active connection identity (provider + org + name). Best-effort event.
//
// Phase 9 hardening: OrganizationMember active-membership verification on the
// requested organizationId (Decision B2). credentialRef stored opaque; never
// returned by generic reads (see getConnectorConnection/listConnectors). Safe
// error responses. Frozen business contract unchanged.

const SECRET_KEY = /secret|token|password|passwd|credential|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|bearer|authorization/i;

function hasSecretKey(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  for (const k of Object.keys(obj)) {
    if (SECRET_KEY.test(k)) return k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      const inner = hasSecretKey(obj[k]);
      if (inner) return `${k}.${inner}`;
    }
  }
  return false;
}

// Phase 9 security helpers (inline — functions deploy standalone)
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
      return Response.json({ error: 'Not permitted to create connector connections' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const connectorDefinitionId = typeof body?.connectorDefinitionId === 'string' ? body.connectorDefinitionId.trim() : '';
    const connectorProviderId = typeof body?.connectorProviderId === 'string' ? body.connectorProviderId.trim() : '';
    const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!connectorDefinitionId || !connectorProviderId || !organizationId || !name) {
      return Response.json({ error: 'connectorDefinitionId, connectorProviderId, organizationId and name are required' }, { status: 400 });
    }
    // Phase 9: bounded input
    if (name.length > 256) return Response.json({ error: 'name is too long' }, { status: 400 });

    let configuration = body?.configuration;
    if (configuration === undefined || configuration === null) configuration = {};
    if (typeof configuration !== 'object' || Array.isArray(configuration)) {
      return Response.json({ error: 'configuration must be an object' }, { status: 400 });
    }
    const secretField = hasSecretKey(configuration);
    if (secretField) {
      return Response.json({ error: `configuration must not contain secret-looking field: ${secretField}` }, { status: 400 });
    }

    const credentialRef = typeof body?.credentialRef === 'string' ? body.credentialRef.trim() : '';

    const svc = base44.asServiceRole;

    // Phase 9: verify the caller is an active member of the target organization.
    // super_admin (kept per Decision A2; identity unavailable today) bypasses.
    if (role !== 'super_admin') {
      const membership = await activeMembership(svc, user.id, organizationId);
      if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const definition = await svc.entities.ConnectorDefinition.get(connectorDefinitionId).catch(() => null);
    if (!definition) return Response.json({ error: 'Connector definition not found' }, { status: 404 });
    if (definition.active === false) {
      return Response.json({ error: 'Connector definition is not active' }, { status: 400 });
    }

    const provider = await svc.entities.ConnectorProvider.get(connectorProviderId).catch(() => null);
    if (!provider) return Response.json({ error: 'Connector provider not found' }, { status: 404 });
    if (provider.connectorDefinitionId !== connectorDefinitionId) {
      return Response.json({ error: 'Provider does not belong to this definition' }, { status: 400 });
    }
    if (provider.active === false) {
      return Response.json({ error: 'Connector provider is not active' }, { status: 400 });
    }

    // One active (non-disconnected) connection per provider + organization + name.
    const existing = await svc.entities.ConnectorConnection.filter({ connectorProviderId, organizationId });
    const active = (existing || []).find((c) => c.status !== 'disconnected' && c.name === name);
    if (active) {
      if (active.connectorDefinitionId === connectorDefinitionId &&
          active.connectorProviderId === connectorProviderId &&
          active.name === name) {
        return Response.json({ status: 'already_created', connection: active });
      }
      return Response.json(
        { error: 'An active connection with this name already exists for this provider and organization' },
        { status: 409 }
      );
    }

    const connection = await svc.entities.ConnectorConnection.create({
      connectorDefinitionId, connectorProviderId, organizationId, name,
      configuration, credentialRef,
      status: 'configured', enabled: false,
      createdById: user.id,
      enabledAt: null, disabledAt: null, disconnectedAt: null, lastError: null,
    });

    await publish(base44, 'connector.connection_created', connection.id, {
      connectionId: connection.id, connectorDefinitionId, connectorProviderId, organizationId, status: 'configured', enabled: false,
    });

    return Response.json({ status: 'created', connection });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});