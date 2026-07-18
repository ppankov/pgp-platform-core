import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lifecycle Engine — deleteLifecycleTransition (Phase 9 / Wave III)
// Authoritative boundary: re-fetch before delete; referential integrity 409
// when a pending approval or execution history references it. Bounded id.
// Role gate admin/super_admin/core_developer per entity RLS intent — admin is
// the only runtime-real gate; other branches Code Inspection Only.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'admin' && role !== 'super_admin' && role !== 'core_developer') {
      return Response.json({ error: 'Not permitted to delete lifecycle transitions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
    if (id.length > 128) return Response.json({ error: 'id is too long' }, { status: 400 });

    const svc = base44.asServiceRole;
    const existing = await svc.entities.LifecycleTransition.get(id).catch(() => null);
    if (!existing || !existing.id) return Response.json({ error: 'Transition not found' }, { status: 404 });

    // Phase 9 referential integrity: refuse delete if the transition is in use.
    const pending = await svc.entities.LifecycleApprovalRequest.filter({ transitionId: id, status: 'pending' }).catch(() => []);
    if (pending && pending.length) return Response.json({ error: 'Transition has a pending approval request' }, { status: 409 });
    const events = await svc.entities.LifecycleExecutionEvent.filter({ transitionId: id }).catch(() => []);
    if (events && events.length) return Response.json({ error: 'Transition is referenced by execution history' }, { status: 409 });

    await svc.entities.LifecycleTransition.delete(id);
    return Response.json({ status: 'deleted', id });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});