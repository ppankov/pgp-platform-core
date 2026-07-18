import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lifecycle Execution Runtime — attachLifecycle
// Attaches a lifecycle definition to a resource identified ONLY by the abstraction
// (resourceType, resourceId). The engine never touches resource storage.
// Creates a LifecycleBinding (persistence service) at the lifecycle's initial state
// and emits a LifecycleExecutionEvent (audit service).
//
// Phase 9 hardening: safe error responses; bounded input on resourceId. The lifecycle
// binding is resource-keyed (no organization on the binding), so org membership is
// not enforced at this layer. Frozen contract unchanged.

function safeMsg(e) {
  const m = (e && e.message) ? String(e.message) : 'Unexpected error';
  return m.length > 200 ? m.slice(0, 200) : m;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const resourceType = body?.resourceType;
    const resourceId = String(body?.resourceId ?? '');
    const lifecycleId = body?.lifecycleId;

    if (!resourceType || !resourceId || !lifecycleId) {
      return Response.json(
        { error: 'resourceType, resourceId and lifecycleId are required' },
        { status: 400 }
      );
    }
    // Phase 9: bounded input.
    if (resourceId.length > 256) return Response.json({ error: 'resourceId is too long' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Persistence service: a resource may be attached to at most one lifecycle.
    const existing = await svc.entities.LifecycleBinding.filter({ resourceType, resourceId });
    if (existing && existing.length > 0) {
      return Response.json(
        { error: 'Resource is already attached to a lifecycle', binding: existing[0] },
        { status: 409 }
      );
    }

    // Catalog: lifecycle must exist and be active.
    const def = await svc.entities.LifecycleDefinition.get(lifecycleId).catch(() => null);
    if (!def) return Response.json({ error: 'Lifecycle definition not found' }, { status: 404 });
    if (def.active === false) {
      return Response.json({ error: 'Lifecycle definition is not active' }, { status: 400 });
    }

    // Catalog: resolve the initial state.
    const states = await svc.entities.LifecycleState.filter({ lifecycleId: lifecycleId });
    const initial = states.find((s) => s.isInitial === true);
    if (!initial) {
      return Response.json({ error: 'Lifecycle has no initial state' }, { status: 400 });
    }

    // Persistence service: create the binding (operates only on the abstraction).
    const binding = await svc.entities.LifecycleBinding.create({
      resourceType,
      resourceId,
      lifecycleId,
      currentLifecycleStateId: initial.id,
    });

    // Audit service: record the attachment.
    await svc.entities.LifecycleExecutionEvent.create({
      bindingId: binding.id,
      resourceType,
      resourceId,
      lifecycleId,
      transitionId: null,
      fromState: null,
      toState: initial.id,
      outcome: 'attached',
      actorId: user.id,
    });

    return Response.json({ status: 'attached', binding });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});