import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lifecycle Execution Runtime — decideApproval
// Entry point of the APPROVAL service (separate from execution). An approver approves
// or rejects a pending LifecycleApprovalRequest. On approval, the persistence service
// applies the transition (updates currentLifecycleStateId). Either way, the audit
// service records the decision. The engine never touches resource storage.
//
// Phase 9 hardening: safe error responses; bounded notes. Frozen contract unchanged.

function safeMsg(e) {
  const m = (e && e.message) ? String(e.message) : 'Unexpected error';
  return m.length > 200 ? m.slice(0, 200) : m;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only approver roles may decide.
    const role = user.role;
    const canDecide = role === 'super_admin' || role === 'admin' || role === 'core_developer';
    if (!canDecide) {
      return Response.json({ error: 'Not permitted to decide approvals' }, { status: 403 });
    }

    const body = await req.json();
    const approvalRequestId = body?.approvalRequestId;
    const decision = body?.decision; // 'approved' | 'rejected'
    let notes = typeof body?.notes === 'string' ? body.notes : '';
    if (!approvalRequestId || !['approved', 'rejected'].includes(decision)) {
      return Response.json(
        { error: 'approvalRequestId and decision (approved|rejected) are required' },
        { status: 400 }
      );
    }
    // Phase 9: bounded notes.
    if (notes.length > 2000) notes = notes.slice(0, 2000);

    const svc = base44.asServiceRole;

    // Approval service: load the pending request.
    const request = await svc.entities.LifecycleApprovalRequest.get(approvalRequestId).catch(() => null);
    if (!request) return Response.json({ error: 'Approval request not found' }, { status: 404 });
    if (request.status !== 'pending') {
      return Response.json({ error: 'Approval request already decided' }, { status: 409 });
    }

    const updatedRequest = await svc.entities.LifecycleApprovalRequest.update(approvalRequestId, {
      status: decision,
      decidedById: user.id,
      decidedDate: new Date().toISOString(),
      notes,
    });

    // Enrich audit with the abstraction fields by reading the binding.
    const binding = await svc.entities.LifecycleBinding.get(request.bindingId).catch(() => null);
    const resourceType = binding?.resourceType || null;
    const resourceId = binding?.resourceId || null;

    if (decision === 'rejected') {
      await svc.entities.LifecycleExecutionEvent.create({
        bindingId: request.bindingId,
        resourceType,
        resourceId,
        lifecycleId: request.lifecycleId,
        transitionId: request.transitionId,
        fromState: request.fromState,
        toState: request.toState,
        outcome: 'rejected',
        actorId: user.id,
      });
      return Response.json({ status: 'rejected', request: updatedRequest });
    }

    // approved → persistence service applies the transition.
    const appliedBinding = binding
      ? await svc.entities.LifecycleBinding.update(binding.id, {
          currentLifecycleStateId: request.toState,
        })
      : null;

    await svc.entities.LifecycleExecutionEvent.create({
      bindingId: request.bindingId,
      resourceType,
      resourceId,
      lifecycleId: request.lifecycleId,
      transitionId: request.transitionId,
      fromState: request.fromState,
      toState: request.toState,
      outcome: 'approved',
      actorId: user.id,
    });

    return Response.json({ status: 'approved', binding: appliedBinding, request: updatedRequest });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});