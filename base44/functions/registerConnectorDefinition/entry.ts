import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Connector Engine — registerConnectorDefinition (Phase 6)
// Creates a global connector definition (catalog entry). core_developer/super_admin only.
// Rejects duplicate keys. Validates declarative capabilities. Best-effort event publication.

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
      return Response.json({ error: 'Not permitted to manage connector definitions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!key) return Response.json({ error: 'key is required' }, { status: 400 });
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

    const description = typeof body?.description === 'string' ? body.description : '';
    const category = typeof body?.category === 'string' ? body.category.trim() : '';
    const active = body?.active !== false;

    let capabilities = body?.capabilities;
    if (capabilities === undefined || capabilities === null) capabilities = [];
    if (!Array.isArray(capabilities) || !capabilities.every((c) => typeof c === 'string' && c.trim())) {
      return Response.json({ error: 'capabilities must be an array of strings' }, { status: 400 });
    }
    capabilities = capabilities.map((c) => c.trim()).filter(Boolean);

    const svc = base44.asServiceRole;
    const existing = await svc.entities.ConnectorDefinition.filter({ key });
    if (existing && existing.length) {
      return Response.json({ error: 'Connector definition key already exists' }, { status: 409 });
    }

    const definition = await svc.entities.ConnectorDefinition.create({
      key, name, description, category, active, capabilities,
    });

    await publish(base44, 'connector.definition_registered', definition.id, {
      connectorDefinitionId: definition.id, key,
    });

    return Response.json({ status: 'registered', definition });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});