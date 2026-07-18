import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Platform Event Bus — subscribe
// Registers (or reactivates) a subscription. Idempotent for the same (subscriber, eventType)
// pair: an active match returns as-is; an inactive match is reactivated; otherwise a new
// subscription is created. The Event Bus never knows who consumes; subscribers register
// themselves.

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
    const subscriber = typeof body?.subscriber === 'string' ? body.subscriber.trim() : '';
    const eventType = typeof body?.eventType === 'string' ? body.eventType.trim() : '';
    if (!subscriber || !eventType) {
      return Response.json({ error: 'subscriber and eventType are required' }, { status: 400 });
    }
    // Phase 9: bounded input.
    if (subscriber.length > 128 || eventType.length > 128) {
      return Response.json({ error: 'subscriber or eventType is too long' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Idempotent: if a subscription for (subscriber, eventType) exists, reactivate it.
    const existing = await svc.entities.EventSubscription.filter({ subscriber, eventType });
    if (existing && existing.length > 0) {
      const sub = existing[0];
      if (sub.active) return Response.json({ status: 'already_subscribed', subscription: sub });
      const reactivated = await svc.entities.EventSubscription.update(sub.id, { active: true });
      return Response.json({ status: 'reactivated', subscription: reactivated });
    }

    const subscription = await svc.entities.EventSubscription.create({
      subscriber,
      eventType,
      active: true,
    });
    return Response.json({ status: 'subscribed', subscription });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});