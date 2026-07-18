import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lifecycle Execution Runtime — getLifecycleState
// Read-only query operating only on the abstraction (resourceType, resourceId).
// Returns the current state and the transitions available from it. Does not touch
// resource storage and does not mutate any lifecycle state.
//
// Phase 9 hardening: safe error responses; bounded input on resourceId. Frozen contract unchanged.

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
    if (!resourceType || !resourceId) {
      return Response.json(
        { error: 'resourceType and resourceId are required' },
        { status: 400 }
      );
    }
    // Phase 9: bounded input.
    if (resourceId.length > 256) return Response.json({ error: 'resourceId is too long' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Persistence service: resolve binding by abstraction.
    const bindings = await svc.entities.LifecycleBinding.filter({ resourceType, resourceId });
    if (!bindings || bindings.length === 0) {
      return Response.json(
        { attached: false, error: 'Resource is not attached to a lifecycle' },
        { status: 404 }
      );
    }
    const binding = bindings[0];

    // Catalog: load states + transitions for this lifecycle in parallel.
    const [states, transitions] = await Promise.all([
      svc.entities.LifecycleState.filter({ lifecycleId: binding.lifecycleId }),
      svc.entities.LifecycleTransition.filter({ lifecycleId: binding.lifecycleId }),
    ]);

    const currentState = states.find((s) => s.id === binding.currentLifecycleStateId) || null;
    const availableTransitions = transitions.filter(
      (t) => t.fromState === binding.currentLifecycleStateId
    );

    return Response.json({ attached: true, binding, currentState, availableTransitions });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});