import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Connector Engine — registerConnectorProvider (Phase 6)
// Creates a provider for an existing ACTIVE definition. core_developer/super_admin only.
// Validates authModes against the enum, rejects secret-looking configurationSchema keys,
// rejects duplicate (definitionId, provider key). Best-effort event publication.

const ALLOWED_AUTH_MODES = new Set(['oauth2', 'api_key', 'basic', 'service_account', 'none']);
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
    if (role !== 'core_developer' && role !== 'super_admin') {
      return Response.json({ error: 'Not permitted to manage connector providers' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const connectorDefinitionId = typeof body?.connectorDefinitionId === 'string' ? body.connectorDefinitionId.trim() : '';
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!connectorDefinitionId) return Response.json({ error: 'connectorDefinitionId is required' }, { status: 400 });
    if (!key) return Response.json({ error: 'key is required' }, { status: 400 });
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

    let authModes = body?.authModes;
    if (!Array.isArray(authModes) || !authModes.length) {
      return Response.json({ error: 'authModes must be a non-empty array' }, { status: 400 });
    }
    authModes = authModes.map((m) => String(m).trim()).filter(Boolean);
    if (!authModes.length) return Response.json({ error: 'authModes must be a non-empty array' }, { status: 400 });
    for (const m of authModes) {
      if (!ALLOWED_AUTH_MODES.has(m)) {
        return Response.json({ error: `Unsupported auth mode: ${m}` }, { status: 400 });
      }
    }

    let configurationSchema = body?.configurationSchema;
    if (configurationSchema === undefined || configurationSchema === null) configurationSchema = {};
    if (typeof configurationSchema !== 'object' || Array.isArray(configurationSchema)) {
      return Response.json({ error: 'configurationSchema must be an object' }, { status: 400 });
    }
    const secretField = hasSecretKey(configurationSchema);
    if (secretField) {
      return Response.json({ error: `configurationSchema must not contain secret-looking field: ${secretField}` }, { status: 400 });
    }

    let credentialRequirements = body?.credentialRequirements;
    if (credentialRequirements === undefined || credentialRequirements === null) credentialRequirements = [];
    if (!Array.isArray(credentialRequirements) || !credentialRequirements.every((c) => typeof c === 'string')) {
      return Response.json({ error: 'credentialRequirements must be an array of strings' }, { status: 400 });
    }

    const active = body?.active !== false;
    const description = typeof body?.description === 'string' ? body.description : '';

    const svc = base44.asServiceRole;
    const definition = await svc.entities.ConnectorDefinition.get(connectorDefinitionId).catch(() => null);
    if (!definition) return Response.json({ error: 'Connector definition not found' }, { status: 404 });
    if (definition.active === false) {
      return Response.json({ error: 'Connector definition is not active' }, { status: 400 });
    }

    const dup = await svc.entities.ConnectorProvider.filter({ connectorDefinitionId, key });
    if (dup && dup.length) {
      return Response.json({ error: 'Provider key already exists for this definition' }, { status: 409 });
    }

    const provider = await svc.entities.ConnectorProvider.create({
      connectorDefinitionId, key, name, description, authModes,
      configurationSchema, credentialRequirements, active,
    });

    await publish(base44, 'connector.provider_registered', provider.id, {
      connectorProviderId: provider.id, connectorDefinitionId, key,
    });

    return Response.json({ status: 'registered', provider });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});