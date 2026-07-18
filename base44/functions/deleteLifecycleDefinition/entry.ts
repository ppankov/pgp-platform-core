import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lifecycle Engine — deleteLifecycleDefinition (Phase 9 / Wave III)
// Authoritative boundary: re-fetch before delete; referential integrity 409
// when in use (no cascade, no audit/history deletion). Bounded id. Role gate
// admin/super_admin/core_developer per entity RLS intent — admin is the only
// runtime-real gate (Base44 user.role is admin/user); other branches Code
// Inspection Only.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'admin' && role !== 'super_admin' && role !== 'core_developer') {
      return Response.json({ error: 'Not permitted to delete lifecycle definitions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
    if (id.length > 128) return Response.json({ error: 'id is too long' }, { status: 400 });

    const svc = base44.asServiceRole;
    const existing = await svc.entities.LifecycleDefinition.get(id).catch(() => null);
    if (!existing || !existing.id) return Response.json({ error: 'Definition not found' }, { status: 404 });

    // Phase 9 referential integrity: refuse delete if the definition is in use.
    // No cascade; no audit/history deletion. Safe 409. Repeated delete of an
    // unknown id returns 404; repeated delete of a just-deleted id returns 404.
    const states = await svc.entities.LifecycleState.filter({ lifecycleId: id }).catch(() => []);
    if (states && states.length) return Response.json({ error: 'Definition is in use by one or more states' }, { status: 409 });
    const transitions = await svc.entities.LifecycleTransition.filter({ lifecycleId: id }).catch(() => []);
    if (transitions && transitions.length) return Response.json({ error: 'Definition is in use by one or more transitions' }, { status: 409 });
    const bindings = await svc.entities.LifecycleBinding.filter({ lifecycleId: id }).catch(() => []);
    if (bindings && bindings.length) return Response.json({ error: 'Definition is in use by one or more bindings' }, { status: 409 });
    const approvals = await svc.entities.LifecycleApprovalRequest.filter({ lifecycleId: id }).catch(() => []);
    if (approvals && approvals.length) return Response.json({ error: 'Definition is referenced by approval history' }, { status: 409 });
    const events = await svc.entities.LifecycleExecutionEvent.filter({ lifecycleId: id }).catch(() => []);
    if (events && events.length) return Response.json({ error: 'Definition is referenced by execution history' }, { status: 409 });

    await svc.entities.LifecycleDefinition.delete(id);
    return Response.json({ status: 'deleted', id });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});