import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lifecycle Engine — saveLifecycleDefinition (Phase 9 / Wave III)
// Creates or updates a platform-level LifecycleDefinition.
// Authoritative boundary: no direct frontend SDK mutations. Role gate is
// admin/super_admin/core_developer per entity RLS intent, but Base44 user.role
// resolves only to built-in admin/user — so admin is the single runtime-real
// gate; super_admin and core_developer branches are retained but Code
// Inspection Only. Re-fetch validation on update; bounded input; safe errors.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'admin' && role !== 'super_admin' && role !== 'core_developer') {
      return Response.json({ error: 'Not permitted to manage lifecycle definitions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const targetType = typeof body?.targetType === 'string' ? body.targetType.trim() : '';
    const description = typeof body?.description === 'string' ? body.description : '';
    const active = body?.active === false ? false : true;

    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });
    if (!targetType) return Response.json({ error: 'targetType is required' }, { status: 400 });
    // Phase 9 bounded input.
    if (name.length > 256 || targetType.length > 128 || description.length > 2000) {
      return Response.json({ error: 'field is too long' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    if (id) {
      // Re-fetch validation: confirm the record exists before mutating.
      const existing = await svc.entities.LifecycleDefinition.get(id).catch(() => null);
      if (!existing || !existing.id) return Response.json({ error: 'Definition not found' }, { status: 404 });
      const updated = await svc.entities.LifecycleDefinition.update(id, { name, targetType, description, active });
      return Response.json({ status: 'updated', definition: updated });
    }

    const created = await svc.entities.LifecycleDefinition.create({ name, targetType, description, active });
    return Response.json({ status: 'created', definition: created });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});