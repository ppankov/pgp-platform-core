import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Platform Event Bus — processEventDelivery (Phase 4 delivery runtime)
// Processes a single EventDelivery: pending → processing → (processed | failed).
// Invokes ONLY the registered subscriber handler abstraction. Never mutates the event
// payload. Failure of one delivery never affects another (failure isolation). No automatic
// retry in Phase 4.

// Subscriber handler registry — the "registered platform subscriber handler abstraction".
// Keyed by subscriber identifier. EMPTY in Phase 4: no business modules register handlers
// yet. Future platform services register handlers here. The dispatcher knows subscribers
// only through their registered subscriber identifier, never their domain logic.
const HANDLERS = {};
function getSubscriberHandler(subscriber) {
  return Object.prototype.hasOwnProperty.call(HANDLERS, subscriber) ? HANDLERS[subscriber] : null;
}

function aggregateStatus(deliveries) {
  if (!deliveries || deliveries.length === 0) return 'processed';
  const hasPending = deliveries.some((d) => d.status === 'pending' || d.status === 'processing');
  if (hasPending) return 'pending';
  const hasFailed = deliveries.some((d) => d.status === 'failed');
  if (hasFailed) return 'failed';
  return 'processed';
}

async function recomputeEventStatus(svc, eventId) {
  const deliveries = await svc.entities.EventDelivery.filter({ eventId });
  await svc.entities.PlatformEvent.update(eventId, { status: aggregateStatus(deliveries) });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    const canManage = role === 'super_admin' || role === 'admin' || role === 'core_developer';
    if (!canManage) {
      return Response.json({ error: 'Not permitted to process deliveries' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const deliveryId = typeof body?.deliveryId === 'string' ? body.deliveryId.trim() : '';
    if (!deliveryId) {
      return Response.json({ error: 'deliveryId is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const delivery = await svc.entities.EventDelivery.get(deliveryId).catch(() => null);
    if (!delivery) return Response.json({ error: 'Delivery not found' }, { status: 404 });

    // Idempotent / non-destructive for already-terminal deliveries.
    if (delivery.status === 'processing') {
      return Response.json({ status: 'already_processing', delivery });
    }
    if (delivery.status === 'processed') {
      return Response.json({ status: 'already_processed', delivery });
    }
    if (delivery.status === 'failed') {
      // No automatic retry in Phase 4.
      return Response.json({ status: 'already_failed', delivery });
    }

    // Load subscription; reject inactive/missing cleanly (failure, not a crash).
    const subscription = await svc.entities.EventSubscription.get(delivery.subscriptionId).catch(() => null);
    if (!subscription) {
      const failed = await svc.entities.EventDelivery.update(deliveryId, {
        status: 'failed',
        attemptCount: (delivery.attemptCount || 0) + 1,
        lastError: 'Subscription not found',
        failedAt: new Date().toISOString(),
      });
      await recomputeEventStatus(svc, delivery.eventId);
      return Response.json({ status: 'failed', delivery: failed, reason: 'subscription_not_found' });
    }
    if (!subscription.active) {
      const failed = await svc.entities.EventDelivery.update(deliveryId, {
        status: 'failed',
        attemptCount: (delivery.attemptCount || 0) + 1,
        lastError: 'Subscription inactive',
        failedAt: new Date().toISOString(),
      });
      await recomputeEventStatus(svc, delivery.eventId);
      return Response.json({ status: 'failed', delivery: failed, reason: 'subscription_inactive' });
    }

    // Move pending → processing (counts as one attempt).
    const now = new Date().toISOString();
    await svc.entities.EventDelivery.update(deliveryId, {
      status: 'processing',
      startedAt: now,
      attemptCount: (delivery.attemptCount || 0) + 1,
      lastError: null,
    });

    // Load the event for the handler contract. The payload is read-only here.
    const event = await svc.entities.PlatformEvent.get(delivery.eventId).catch(() => null);
    if (!event) {
      const failed = await svc.entities.EventDelivery.update(deliveryId, {
        status: 'failed',
        failedAt: new Date().toISOString(),
        lastError: 'Event not found',
      });
      await recomputeEventStatus(svc, delivery.eventId);
      return Response.json({ status: 'failed', delivery: failed, reason: 'event_not_found' });
    }

    const handlerContext = {
      deliveryId,
      eventId: event.id,
      eventType: event.eventType,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      actorId: event.actorId,
      organizationId: event.organizationId,
      correlationId: event.correlationId,
      payload: event.payload, // transport data — never mutated by the runtime
    };

    // Invoke the registered handler abstraction only.
    const handler = getSubscriberHandler(subscription.subscriber);
    try {
      if (!handler) {
        throw new Error(`No handler registered for subscriber '${subscription.subscriber}'`);
      }
      await handler(handlerContext);
      const processed = await svc.entities.EventDelivery.update(deliveryId, {
        status: 'processed',
        processedAt: new Date().toISOString(),
      });
      await recomputeEventStatus(svc, delivery.eventId);
      return Response.json({ status: 'processed', delivery: processed });
    } catch (handlerError) {
      const failed = await svc.entities.EventDelivery.update(deliveryId, {
        status: 'failed',
        failedAt: new Date().toISOString(),
        lastError: String(handlerError?.message || handlerError),
      });
      await recomputeEventStatus(svc, delivery.eventId);
      return Response.json({ status: 'failed', delivery: failed, reason: 'handler_error' });
    }
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});