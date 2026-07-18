import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Phase 9 — Platform Event Bus read function for PlatformEvent (Template B entity).
// PlatformEvent.organizationId is nullable (platform-level events). OrganizationMember
// cannot be reliably established for platform-scoped events, so the raw payload is NEVER
// returned — only a redacted, bounded preview. status filter is allow-listed; pagination
// is bounded. auth.me() required; role gate developer+ (only admin is runtime-real).
// Safe errors; no unbounded reads.

const READ_ROLES = new Set(['super_admin', 'admin', 'core_developer', 'developer', 'solution_architect']);
const ALLOWED_STATUS = new Set(['pending', 'processed', 'failed']);
const SECRET_KEYS = ['password', 'passwd', 'secret', 'token', 'access_token', 'refresh_token', 'api_key', 'apikey', 'client_secret', 'private_key', 'credential', 'credentialref', 'authorization', 'cookie', 'session'];
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
  try { serialized = JSON.stringify(safe); } catch (_) { return { preview: null, truncated: false, error: 'payload not serializable' }; }
  if (serialized.length <= MAX_PAYLOAD_PREVIEW) return { preview: safe, truncated: false, size: serialized.length };
  const truncatedStr = serialized.slice(0, MAX_PAYLOAD_PREVIEW);
  return {
    preview: (() => { try { return JSON.parse(truncatedStr); } catch (_) { return truncatedStr; } })(),
    truncated: true,
    size: serialized.length,
    maxSize: MAX_PAYLOAD_PREVIEW,
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

function safeMsg(e) {
  const m = (e && e.message) ? String(e.message) : 'Unexpected error';
  return m.length > 200 ? m.slice(0, 200) : m;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!READ_ROLES.has(user.role)) return Response.json({ error: 'Not permitted to read platform events' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const filter = {};
    const statusFilter = typeof body?.status === 'string' ? body.status.slice(0, 32) : '';
    if (statusFilter && ALLOWED_STATUS.has(statusFilter)) filter.status = statusFilter;
    if (typeof body?.eventType === 'string' && body.eventType.trim()) filter.eventType = body.eventType.trim().slice(0, 128);

    let limit = 50;
    if (body?.limit !== undefined && body?.limit !== null) {
      const n = Number(body.limit);
      if (Number.isInteger(n)) limit = n;
    }
    if (limit < 1) limit = 50;
    if (limit > 100) limit = 100;
    const offset = Number.isInteger(body?.offset) && body.offset >= 0 ? body.offset : 0;

    const svc = base44.asServiceRole;
    const all = await svc.entities.PlatformEvent.filter(filter, '-createdAt', 1000);
    const total = all.length;
    const paged = all.slice(offset, offset + limit);
    return Response.json({ status: 'ok', events: paged.map(safeEvent), total, limit, offset });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});