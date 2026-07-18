import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Platform Event Bus — getEventDeliveryDetailSecure (Phase 9 read function)
// Returns delivery metadata + safe linked PlatformEvent metadata + safe linked
// EventSubscription metadata. NEVER returns raw PlatformEvent.payload — only a
// sanitized, redacted preview capped at 4 KB.
// Authorization: auth.me() required; role gate admin/super_admin/core_developer/
// developer/solution_architect (only admin is runtime-real). Delivery is re-
// fetched before any linked read; 404 returns no foreign body, 403 returns no
// foreign body. organizationId is never accepted from the request.

const SECRET_KEYS = [
  'password', 'passwd', 'secret', 'token', 'access_token', 'refresh_token',
  'api_key', 'apikey', 'client_secret', 'private_key', 'credential',
  'credentialref', 'authorization', 'cookie', 'session',
];

const MAX_PAYLOAD_PREVIEW = 4096;

function isSecretKey(k) {
  if (typeof k !== 'string') return false;
  return SECRET_KEYS.includes(k.toLowerCase());
}

function sanitize(value, depth = 0) {
  if (depth > 12 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSecretKey(k)) out[k] = '[REDACTED]';
      else out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

function payloadPreview(payload) {
  if (payload === null || payload === undefined) return null;
  const safe = sanitize(payload);
  let serialized;
  try {
    serialized = JSON.stringify(safe);
  } catch (_) {
    return { preview: null, truncated: false, error: 'payload not serializable' };
  }
  if (serialized.length <= MAX_PAYLOAD_PREVIEW) {
    return { preview: safe, truncated: false, size: serialized.length };
  }
  const truncatedStr = serialized.slice(0, MAX_PAYLOAD_PREVIEW);
  return {
    preview: (() => { try { return JSON.parse(truncatedStr); } catch (_) { return truncatedStr; } })(),
    truncated: true,
    size: serialized.length,
    maxSize: MAX_PAYLOAD_PREVIEW,
  };
}

function safeDelivery(d) {
  if (!d) return null;
  return {
    id: d.id,
    eventId: d.eventId,
    subscriptionId: d.subscriptionId,
    subscriber: d.subscriber,
    eventType: d.eventType,
    status: d.status,
    attemptCount: d.attemptCount,
    lastError: typeof d.lastError === 'string' ? d.lastError.slice(0, 200) : d.lastError,
    createdAt: d.createdAt,
    startedAt: d.startedAt,
    processedAt: d.processedAt,
    failedAt: d.failedAt,
  };
}

function safeEvent(e) {
  if (!e) return null;
  return {
    id: e.id,
    eventType: e.eventType,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    actorId: e.actorId,
    organizationId: e.organizationId,
    correlationId: e.correlationId,
    status: e.status,
    createdAt: e.createdAt,
    payloadPreview: payloadPreview(e.payload),
  };
}

function safeSubscription(s) {
  if (!s) return null;
  return {
    id: s.id,
    subscriber: s.subscriber,
    eventType: s.eventType,
    active: s.active,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    const canRead = ['super_admin', 'admin', 'core_developer', 'developer', 'solution_architect'].includes(role);
    if (!canRead) {
      return Response.json({ error: 'Not permitted to read delivery detail' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const deliveryId = typeof body?.deliveryId === 'string' ? body.deliveryId.trim().slice(0, 128) : '';
    if (!deliveryId) return Response.json({ error: 'deliveryId is required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Re-fetch delivery FIRST — 404 reveals no foreign body.
    const delivery = await svc.entities.EventDelivery.get(deliveryId).catch(() => null);
    if (!delivery) return Response.json({ error: 'Delivery not found' }, { status: 404 });

    // Only AFTER authorization + delivery re-fetch, read linked records.
    let event = null;
    let subscription = null;
    if (delivery.eventId) {
      event = await svc.entities.PlatformEvent.get(delivery.eventId).catch(() => null);
    }
    if (delivery.subscriptionId) {
      subscription = await svc.entities.EventSubscription.get(delivery.subscriptionId).catch(() => null);
    }

    return Response.json({
      status: 'ok',
      delivery: safeDelivery(delivery),
      event: safeEvent(event),
      subscription: safeSubscription(subscription),
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});