import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lifecycle Execution Runtime — executeTransition
// Core engine. Applies a transition to a resource identified ONLY by the abstraction
// (resourceType, resourceId, currentLifecycleStateId). Never touches resource storage.
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
    const transitionId = body?.transitionId;
    if (!resourceType || !resourceId || !transitionId) {
      return Response.json(
        { error: 'resourceType, resourceId and transitionId are required' },
        { status: 400 }
      );
    }
    // Phase 9: bounded input.
    if (resourceId.length > 256) return Response.json({ error: 'resourceId is too long' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Persistence service: resolve binding by abstraction.
    const bindings = await svc.entities.LifecycleBinding.filter({ resourceType, resourceId });
    if (!bindings || bindings.length === 0) {
      return Response.json({ error: 'Resource is not attached to a lifecycle' }, { status: 404 });
    }
    const binding = bindings[0];

    // Catalog: load transition; must belong to the same lifecycle.
    const transition = await svc.entities.LifecycleTransition.get(transitionId).catch(() => null);
    if (!transition || transition.lifecycleId !== binding.lifecycleId) {
      return Response.json({ error: 'Transition not found for this lifecycle' }, { status: 404 });
    }

    // Engine rule: the transition must start from the current state.
    if (transition.fromState !== binding.currentLifecycleStateId) {
      return Response.json(
        { error: 'Transition is not valid from the current state' },
        { status: 409 }
      );
    }

    // Authorization: engine-level enforcement of allowedRoles. (Backend RLS still applies.)
    const role = user.role;
    const bypass = role === 'super_admin' || role === 'admin';
    const allowed =
      !transition.allowedRoles || transition.allowedRoles.length === 0
        ? true
        : transition.allowedRoles.includes(role);
    if (!bypass && !allowed) {
      return Response.json(
        { error: 'Role not permitted to perform this transition' },
        { status: 403 }
      );
    }

    // Approval service: if approval is required, request it and do NOT mutate state.
    if (transition.requiresApproval) {
      const request = await svc.entities.LifecycleApprovalRequest.create({
        bindingId: binding.id,
        lifecycleId: binding.lifecycleId,
        transitionId: transition.id,
        fromState: transition.fromState,
        toState: transition.toState,
        status: 'pending',
        requestedById: user.id,
        requestedDate: new Date().toISOString(),
      });
      await svc.entities.LifecycleExecutionEvent.create({
        bindingId: binding.id,
        resourceType,
        resourceId,
        lifecycleId: binding.lifecycleId,
        transitionId: transition.id,
        fromState: transition.fromState,
        toState: transition.toState,
        outcome: 'approval_requested',
        actorId: user.id,
      });
      return Response.json({ status: 'approval_requested', approvalRequestId: request.id });
    }

    // Persistence service: apply the transition by updating only currentLifecycleStateId.
    const updated = await svc.entities.LifecycleBinding.update(binding.id, {
      currentLifecycleStateId: transition.toState,
    });

    // Audit service: record the applied transition.
    await svc.entities.LifecycleExecutionEvent.create({
      bindingId: binding.id,
      resourceType,
      resourceId,
      lifecycleId: binding.lifecycleId,
      transitionId: transition.id,
      fromState: transition.fromState,
      toState: transition.toState,
      outcome: 'transitioned',
      actorId: user.id,
    });

    return Response.json({ status: 'transitioned', binding: updated });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});