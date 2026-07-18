import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Platform Event Bus — getEventDeliveries (Phase 9 hardened read function)
// Two modes:
//   1. eventId provided  -> returns { status, event(safe), deliveries(safe), summary }
//      (preserves the original Phase 4 response contract, now redacted)
//   2. eventId omitted   -> returns { status, deliveries, total, limit, offset }
//      (list mode with optional status filter + pagination)
// Authorization: auth.me() required; role gate admin/super_admin/core_developer/
// developer/solution_architect (only admin is runtime-real). Organization
// scope is NOT request-supplied; PlatformEvent/EventDelivery are platform-scoped
// (no organizationId), so OrganizationMember cannot be reliably established —
// therefore raw payload is never returned; only a redacted sanitized preview.

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
    const canRead = ['super_admin', 'admin', 'core_developer', 'developer', 'solution_architect'].includes(role);
    if (!canRead) {
      return Response.json({ error: 'Not permitted to read deliveries' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim().slice(0, 128) : '';
    const statusFilter = typeof body?.status === 'string' ? body.status.slice(0, 32) : '';

    let limit = 50;
    if (body?.limit !== undefined && body?.limit !== null) {
      const n = Number(body.limit);
      if (Number.isInteger(n)) limit = n;
    }
    if (limit < 1) limit = 50;
    if (limit > 100) limit = 100;
    const offset = Number.isInteger(body?.offset) && body.offset >= 0 ? body.offset : 0;

    const svc = base44.asServiceRole;

    // Mode 1: event-scoped (preserves original contract)
    if (eventId) {
      const event = await svc.entities.PlatformEvent.get(eventId).catch(() => null);
      if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });

      const deliveries = await svc.entities.EventDelivery.filter({ eventId });
      const summary = {
        total: deliveries.length,
        pending: deliveries.filter((d) => d.status === 'pending').length,
        processing: deliveries.filter((d) => d.status === 'processing').length,
        processed: deliveries.filter((d) => d.status === 'processed').length,
        failed: deliveries.filter((d) => d.status === 'failed').length,
        aggregateEventStatus: aggregateStatus(deliveries),
      };
      return Response.json({
        status: 'ok',
        event: safeEvent(event),
        deliveries: deliveries.map(safeDelivery),
        summary,
      });
    }

    // Mode 2: list mode with pagination + optional status filter
    const filter = {};
    if (['pending', 'processing', 'processed', 'failed'].includes(statusFilter)) {
      filter.status = statusFilter;
    }
    const all = await svc.entities.EventDelivery.filter(filter, '-created_date', 1000);
    const total = all.length;
    const paged = all.slice(offset, offset + limit);
    return Response.json({
      status: 'ok',
      deliveries: paged.map(safeDelivery),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});