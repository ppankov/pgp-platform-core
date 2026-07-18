import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Platform Event Bus — unsubscribe
// Deactivates a subscription (preserves the record and history rather than deleting).
// Accepts either a subscriptionId, or (subscriber, eventType) to resolve it.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    const canManage = role === 'super_admin' || role === 'admin' || role === 'core_developer';
    if (!canManage) {
      return Response.json({ error: 'Not permitted to manage subscriptions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const subscriptionId = typeof body?.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
    const subscriber = typeof body?.subscriber === 'string' ? body.subscriber.trim() : '';
    const eventType = typeof body?.eventType === 'string' ? body.eventType.trim() : '';
    // Phase 9: bounded input.
    if (subscriber.length > 128 || eventType.length > 128) {
      return Response.json({ error: 'subscriber or eventType is too long' }, { status: 400 });
    }
    if (!subscriptionId && !(subscriber && eventType)) {
      return Response.json(
        { error: 'subscriptionId or (subscriber and eventType) is required' },
        { status: 400 }
      );
    }

    const svc = base44.asServiceRole;
    let sub = null;
    if (subscriptionId) {
      sub = await svc.entities.EventSubscription.get(subscriptionId).catch(() => null);
    } else {
      const found = await svc.entities.EventSubscription.filter({ subscriber, eventType });
      sub = found && found.length > 0 ? found[0] : null;
    }
    if (!sub) return Response.json({ error: 'Subscription not found' }, { status: 404 });

    const updated = await svc.entities.EventSubscription.update(sub.id, { active: false });
    return Response.json({ status: 'unsubscribed', subscription: updated });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});