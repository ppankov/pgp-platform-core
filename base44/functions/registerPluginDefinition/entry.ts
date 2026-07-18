import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Plugin Engine — registerPluginDefinition (Phase 5)
// Creates a global plugin identity in the catalog. Rejects duplicate keys.
// Management roles only (core_developer, super_admin). The definition contains NO
// executable code. After success, publishes plugin.definition_registered via the
// existing publishEvent service (best-effort — never rolls back the operation).

async function publish(base44, eventType, sourceId, payload) {
  try {
    await base44.functions.invoke('publishEvent', {
      eventType,
      sourceType: 'plugin',
      sourceId: String(sourceId),
      payload,
    });
  } catch (_e) {
    // Best-effort: a publication failure must not roll back a successful operation.
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'core_developer' && role !== 'super_admin') {
      return Response.json({ error: 'Not permitted to manage plugin definitions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!key) return Response.json({ error: 'key is required' }, { status: 400 });
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // key must be unique and is immutable after creation.
    const existing = await svc.entities.PluginDefinition.filter({ key });
    if (existing && existing.length > 0) {
      return Response.json(
        { error: 'Plugin key already exists', definition: existing[0] },
        { status: 409 }
      );
    }

    const definition = await svc.entities.PluginDefinition.create({
      key,
      name,
      description: typeof body?.description === 'string' ? body.description : '',
      vendor: typeof body?.vendor === 'string' ? body.vendor : '',
      category: typeof body?.category === 'string' ? body.category : '',
      active: body?.active === false ? false : true,
      currentVersionId: null,
    });

    await publish(base44, 'plugin.definition_registered', definition.id, {
      pluginId: definition.id,
      key: definition.key,
      name: definition.name,
    });

    return Response.json({ status: 'registered', definition });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});