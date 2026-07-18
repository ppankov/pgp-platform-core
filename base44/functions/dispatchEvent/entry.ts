import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Platform Event Bus — dispatchEvent (Phase 4 delivery runtime)
// Matches a stored PlatformEvent with active EventSubscriptions (exact eventType OR wildcard
// '*') and creates one EventDelivery per matching subscription. Idempotent: never creates a
// duplicate delivery for the same (eventId, subscriptionId). Does NOT execute subscriber
// business logic. Publishing and delivery remain separate operations.

// Aggregate event status derived from its deliveries.
// - no deliveries → 'processed' (vacuous: nothing to deliver)
// - any pending/processing → 'pending'
// - all terminal with any failed → 'failed'
// - all processed → 'processed'
function aggregateStatus(deliveries) {
  if (!deliveries || deliveries.length === 0) return 'processed';
  const hasPending = deliveries.some((d) => d.status === 'pending' || d.status === 'processing');
  if (hasPending) return 'pending';
  const hasFailed = deliveries.some((d) => d.status === 'failed');
  if (hasFailed) return 'failed';
  return 'processed';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    const canManage = role === 'super_admin' || role === 'admin' || role === 'core_developer';
    if (!canManage) {
      return Response.json({ error: 'Not permitted to dispatch events' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const event = await svc.entities.PlatformEvent.get(eventId).catch(() => null);
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });

    // Find active subscriptions matching the exact eventType and the wildcard '*'.
    const [exact, wildcard] = await Promise.all([
      svc.entities.EventSubscription.filter({ active: true, eventType: event.eventType }),
      svc.entities.EventSubscription.filter({ active: true, eventType: '*' }),
    ]);
    const subs = [];
    const seen = new Set();
    for (const s of [...exact, ...wildcard]) {
      if (!seen.has(s.id)) { seen.add(s.id); subs.push(s); }
    }

    if (subs.length === 0) {
      // No subscribers — not a system error. Create no deliveries.
      // Aggregate decision: zero deliveries → event considered processed (vacuous completion).
      const now = new Date().toISOString();
      await svc.entities.PlatformEvent.update(eventId, { status: 'processed', processedAt: now });
      return Response.json({ status: 'no_subscribers', eventId, deliveries: [], matched: 0 });
    }

    // Create one delivery per matching subscription, idempotently.
    const existing = await svc.entities.EventDelivery.filter({ eventId });
    const existingByKey = new Set(existing.map((d) => `${d.eventId}|${d.subscriptionId}`));
    const now = new Date().toISOString();
    const created = [];
    for (const s of subs) {
      const key = `${eventId}|${s.id}`;
      if (existingByKey.has(key)) continue; // idempotent: never duplicate
      const d = await svc.entities.EventDelivery.create({
        eventId,
        subscriptionId: s.id,
        subscriber: s.subscriber,
        eventType: event.eventType,
        status: 'pending',
        attemptCount: 0,
        lastError: null,
        createdAt: now,
        startedAt: null,
        processedAt: null,
        failedAt: null,
      });
      created.push(d);
    }

    // Recompute aggregate event status (deliveries now pending → event pending).
    const allDeliveries = await svc.entities.EventDelivery.filter({ eventId });
    await svc.entities.PlatformEvent.update(eventId, { status: aggregateStatus(allDeliveries) });

    return Response.json({
      status: 'dispatched',
      eventId,
      matched: subs.length,
      created: created.length,
      deliveries: allDeliveries,
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});