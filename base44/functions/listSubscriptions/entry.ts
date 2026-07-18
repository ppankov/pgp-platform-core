import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Platform Event Bus — listSubscriptions
// Lists subscriptions, optionally filtered by eventType and/or active state. Read-only.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const query = {};
    if (typeof body?.eventType === 'string') query.eventType = body.eventType.trim();
    if (typeof body?.active === 'boolean') query.active = body.active;

    const subscriptions = await svc.entities.EventSubscription.filter(query);
    return Response.json({ status: 'ok', subscriptions });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});