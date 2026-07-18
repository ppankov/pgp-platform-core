import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lifecycle Engine — saveLifecycleTransition (Phase 9 / Wave III)
// Creates or updates a LifecycleTransition. Re-fetch validation: lifecycleId
// must exist; fromState/toState must reference existing states within that
// lifecycle. Bounded input; role enforcement per entity RLS.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'admin' && role !== 'super_admin' && role !== 'core_developer') {
      return Response.json({ error: 'Not permitted to manage lifecycle transitions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const lifecycleId = typeof body?.lifecycleId === 'string' ? body.lifecycleId.trim() : '';
    const fromState = typeof body?.fromState === 'string' ? body.fromState.trim() : '';
    const toState = typeof body?.toState === 'string' ? body.toState.trim() : '';
    const allowedRoles = Array.isArray(body?.allowedRoles) ? body.allowedRoles.filter((r) => typeof r === 'string') : [];
    const requiresApproval = body?.requiresApproval === true;
    const notes = typeof body?.notes === 'string' ? body.notes : '';

    if (!lifecycleId) return Response.json({ error: 'lifecycleId is required' }, { status: 400 });
    if (!fromState || !toState) return Response.json({ error: 'fromState and toState are required' }, { status: 400 });
    // Phase 9 bounded input.
    if (notes.length > 2000) return Response.json({ error: 'notes is too long' }, { status: 400 });
    if (allowedRoles.length > 64) return Response.json({ error: 'too many allowedRoles' }, { status: 400 });
    if (allowedRoles.some((r) => r.length > 64)) return Response.json({ error: 'role label is too long' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Re-fetch validation: parent lifecycle must exist.
    const parent = await svc.entities.LifecycleDefinition.get(lifecycleId).catch(() => null);
    if (!parent || !parent.id) return Response.json({ error: 'Lifecycle definition not found' }, { status: 404 });

    // Re-fetch validation: both endpoint states must exist within this lifecycle.
    const fromStateRec = await svc.entities.LifecycleState.get(fromState).catch(() => null);
    if (!fromStateRec || !fromStateRec.id || fromStateRec.lifecycleId !== lifecycleId) {
      return Response.json({ error: 'fromState is invalid for this lifecycle' }, { status: 400 });
    }
    const toStateRec = await svc.entities.LifecycleState.get(toState).catch(() => null);
    if (!toStateRec || !toStateRec.id || toStateRec.lifecycleId !== lifecycleId) {
      return Response.json({ error: 'toState is invalid for this lifecycle' }, { status: 400 });
    }

    const payload = { lifecycleId, fromState, toState, allowedRoles, requiresApproval, notes };

    if (id) {
      const existing = await svc.entities.LifecycleTransition.get(id).catch(() => null);
      if (!existing || !existing.id) return Response.json({ error: 'Transition not found' }, { status: 404 });
      if (existing.lifecycleId !== lifecycleId) return Response.json({ error: 'Transition does not belong to this lifecycle' }, { status: 400 });
      const updated = await svc.entities.LifecycleTransition.update(id, payload);
      return Response.json({ status: 'updated', transition: updated });
    }

    const created = await svc.entities.LifecycleTransition.create(payload);
    return Response.json({ status: 'created', transition: created });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});