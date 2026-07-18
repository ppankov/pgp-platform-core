import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lifecycle Engine — saveLifecycleState (Phase 9 / Wave III)
// Creates or updates a LifecycleState. Re-fetch validation: lifecycleId must
// reference an existing LifecycleDefinition; on update, the state must exist.
// Bounded input. Role gate admin/super_admin/core_developer per entity RLS
// intent — admin is the only runtime-real gate (Base44 user.role is admin/user);
// other branches Code Inspection Only.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'admin' && role !== 'super_admin' && role !== 'core_developer') {
      return Response.json({ error: 'Not permitted to manage lifecycle states' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const lifecycleId = typeof body?.lifecycleId === 'string' ? body.lifecycleId.trim() : '';
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description : '';
    const color = typeof body?.color === 'string' ? body.color : '';
    const icon = typeof body?.icon === 'string' ? body.icon : '';
    const order = typeof body?.order === 'number' ? body.order : Number(body?.order) || 0;
    const isInitial = body?.isInitial === true;
    const isFinal = body?.isFinal === true;

    if (!lifecycleId) return Response.json({ error: 'lifecycleId is required' }, { status: 400 });
    if (!key) return Response.json({ error: 'key is required' }, { status: 400 });
    if (!title) return Response.json({ error: 'title is required' }, { status: 400 });
    // Phase 9 bounded input.
    if (key.length > 128 || title.length > 256 || description.length > 2000 || color.length > 32 || icon.length > 64) {
      return Response.json({ error: 'field is too long' }, { status: 400 });
    }
    if (order < 0 || order > 100000) return Response.json({ error: 'order out of range' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Re-fetch validation: parent lifecycle must exist.
    const parent = await svc.entities.LifecycleDefinition.get(lifecycleId).catch(() => null);
    if (!parent || !parent.id) return Response.json({ error: 'Lifecycle definition not found' }, { status: 404 });

    const payload = { lifecycleId, key, title, description, color, icon, order, isInitial, isFinal };

    if (id) {
      const existing = await svc.entities.LifecycleState.get(id).catch(() => null);
      if (!existing || !existing.id) return Response.json({ error: 'State not found' }, { status: 404 });
      // State must belong to the declared lifecycle.
      if (existing.lifecycleId !== lifecycleId) return Response.json({ error: 'State does not belong to this lifecycle' }, { status: 400 });
      const updated = await svc.entities.LifecycleState.update(id, payload);
      return Response.json({ status: 'updated', state: updated });
    }

    const created = await svc.entities.LifecycleState.create(payload);
    return Response.json({ status: 'created', state: created });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});