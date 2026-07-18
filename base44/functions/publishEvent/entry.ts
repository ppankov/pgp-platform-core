import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Platform Event Bus — publishEvent
// Stores an event. Executes NO business logic and does NOT notify subscribers.
// Subscribers consume events later; asynchronous processing is a future concern.
// The publisher never knows the subscribers. status is always 'pending' on publish;
// 'processed'/'failed' can only be set by a future processor, never by a publisher.
//
// Phase 9 hardening:
//  - actorId is derived from the authenticated user when present (Decision: no
//    client-supplied actorId for user-context calls). For trusted service-role
//    runtime invocations with no user context (e.g. the Scheduler/Worker invoking
//    via asServiceRole), the caller-provided actorId is accepted as-is.
//  - organizationId, when provided in a USER-context call, requires active
//    OrganizationMember membership (Decision B2) — a client cannot publish events
//    scoped to a foreign org. Service-role runtime calls skip membership (the
//    calling authoritative function has already enforced its own boundary).
//  - Bounded input on eventType/sourceType/sourceId/correlationId.
//  - Recursive secret-looking-key rejection on payload.
//  - Safe error responses.
// Frozen event payload contract (identifier/status-only) unchanged.

const SECRET_KEY = /secret|token|password|passwd|credential|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|bearer|authorization|cookie|session/i;

function findSecretKey(v, d = 0) {
  if (d > 16 || v == null || typeof v !== 'object' || Array.isArray(v)) return null;
  for (const k of Object.keys(v)) {
    if (SECRET_KEY.test(String(k))) return k;
    const inner = findSecretKey(v[k], d + 1);
    if (inner) return `${k}.${inner}`;
  }
  return null;
}
function safeMsg(e) {
  const m = (e && e.message) ? String(e.message) : 'Unexpected error';
  return m.length > 200 ? m.slice(0, 200) : m;
}
async function activeMembership(svc, userId, orgId) {
  if (!orgId) return null;
  const list = await svc.entities.OrganizationMember.filter({ user_id: userId, organization_id: orgId }).catch(() => []);
  return (list || []).find((m) => m.status === 'active') || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // User-context (direct / frontend / base44.functions.invoke) vs trusted
    // service-role runtime (asServiceRole.functions.invoke with no user).
    const user = await base44.auth.me().catch(() => null);
    const isUserContext = !!user;

    const body = await req.json().catch(() => ({}));
    const eventType = typeof body?.eventType === 'string' ? body.eventType.trim() : '';
    const sourceType = typeof body?.sourceType === 'string' ? body.sourceType.trim() : '';
    const sourceId =
      body?.sourceId !== undefined && body?.sourceId !== null
        ? String(body.sourceId).trim()
        : '';

    if (!eventType || !sourceType || !sourceId) {
      return Response.json(
        { error: 'eventType, sourceType and sourceId are required' },
        { status: 400 }
      );
    }
    if (eventType.length > 128) return Response.json({ error: 'eventType is too long' }, { status: 400 });
    if (sourceType.length > 128) return Response.json({ error: 'sourceType is too long' }, { status: 400 });
    if (sourceId.length > 256) return Response.json({ error: 'sourceId is too long' }, { status: 400 });

    const rawPayload = body?.payload;
    let payload = {};
    if (rawPayload === undefined || rawPayload === null) {
      payload = {};
    } else if (typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
      payload = rawPayload;
    } else {
      return Response.json({ error: 'payload must be an object' }, { status: 400 });
    }
    const secretField = findSecretKey(payload);
    if (secretField) {
      return Response.json({ error: `payload contains a secret-looking field: ${secretField}` }, { status: 400 });
    }

    const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : null;
    const correlationId = typeof body?.correlationId === 'string' ? body.correlationId.trim() : null;
    if (correlationId && correlationId.length > 512) {
      return Response.json({ error: 'correlationId is too long' }, { status: 400 });
    }

    // actorId resolution by context.
    let actorId;
    if (isUserContext) {
      // User-context: actorId always derived from auth, never client-supplied.
      actorId = user.id;
      // Membership enforcement for org-scoped user-context events.
      if (organizationId && user.role !== 'super_admin') {
        const membership = await activeMembership(base44.asServiceRole, user.id, organizationId);
        if (!membership) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
      }
    } else {
      // Trusted service-role runtime: require an explicit actorId; no membership
      // check (the authoritative caller has already enforced its own boundary).
      actorId = typeof body?.actorId === 'string' ? body.actorId.trim() : null;
      if (!actorId) {
        return Response.json({ error: 'actorId is required for service-role invocations' }, { status: 400 });
      }
    }

    const event = await base44.asServiceRole.entities.PlatformEvent.create({
      eventType,
      sourceType,
      sourceId,
      actorId,
      organizationId,
      correlationId,
      payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
      processedAt: null,
    });

    return Response.json({ status: 'published', event });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});