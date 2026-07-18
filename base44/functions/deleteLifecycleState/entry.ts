import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lifecycle Engine — deleteLifecycleState (Phase 9 / Wave III)
// Authoritative boundary: re-fetch before delete; referential integrity 409
// when referenced by a transition or binding. Bounded id. Role gate admin/
// super_admin/core_developer per entity RLS intent — admin is the only
// runtime-real gate; other branches Code Inspection Only.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'admin' && role !== 'super_admin' && role !== 'core_developer') {
      return Response.json({ error: 'Not permitted to delete lifecycle states' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
    if (id.length > 128) return Response.json({ error: 'id is too long' }, { status: 400 });

    const svc = base44.asServiceRole;
    const existing = await svc.entities.LifecycleState.get(id).catch(() => null);
    if (!existing || !existing.id) return Response.json({ error: 'State not found' }, { status: 404 });

    // Phase 9 referential integrity: refuse delete if the state is referenced.
    const asFrom = await svc.entities.LifecycleTransition.filter({ fromState: id }).catch(() => []);
    if (asFrom && asFrom.length) return Response.json({ error: 'State is used as fromState in a transition' }, { status: 409 });
    const asTo = await svc.entities.LifecycleTransition.filter({ toState: id }).catch(() => []);
    if (asTo && asTo.length) return Response.json({ error: 'State is used as toState in a transition' }, { status: 409 });
    const bindings = await svc.entities.LifecycleBinding.filter({ currentLifecycleStateId: id }).catch(() => []);
    if (bindings && bindings.length) return Response.json({ error: 'State is the current state of a binding' }, { status: 409 });

    await svc.entities.LifecycleState.delete(id);
    return Response.json({ status: 'deleted', id });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});