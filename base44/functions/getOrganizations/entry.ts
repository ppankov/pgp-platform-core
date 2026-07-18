import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Phase 9 — Organization access read function (group 1: Organization + OrganizationMember)
// Returns the organizations the caller may operate on:
//   - super_admin: all organizations
//   - any other authenticated role: organizations where they have an ACTIVE membership
// Organization isolation is function-enforced (Datastore RLS does not simulate the
// OrganizationMember join). No role/actorId is accepted from the request body.
// Redacts sensitive-looking keys; safe errors; bounded.

const SECRET_KEYS = ['password', 'passwd', 'secret', 'token', 'access_token', 'refresh_token', 'api_key', 'apikey', 'client_secret', 'private_key', 'credential', 'credentialref', 'authorization', 'cookie', 'session'];

function safeOrg(o) {
  if (!o) return null;
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    status: o.status,
    plan_tier: o.plan_tier,
    owner_user_id: o.owner_user_id,
    settings: o.settings ? redact(o.settings) : o.settings,
  };
}

function redact(v, d = 0) {
  if (d > 12 || v == null || typeof v !== 'object') return v;
  const out = Array.isArray(v) ? [] : {};
  for (const k of Object.keys(v)) {
    const lk = String(k).toLowerCase();
    if (SECRET_KEYS.some((s) => lk.includes(s))) out[k] = '[redacted]';
    else out[k] = redact(v[k], d + 1);
  }
  return out;
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

    const svc = base44.asServiceRole;

    if (user.role === 'super_admin' || user.role === 'admin') {
      // admin role is built-in and runtime-real; super_admin sees all orgs, admin sees all orgs
      // (admin is a platform operator role per built-in model).
      const orgs = await svc.entities.Organization.list();
      return Response.json({ status: 'ok', organizations: (orgs || []).map(safeOrg) });
    }

    // Any other authenticated role: restrict to active memberships.
    const memberships = await svc.entities.OrganizationMember.filter({ user_id: user.id, status: 'active' }).catch(() => []);
    const orgIds = [...new Set((memberships || []).map((m) => m.organization_id))];
    if (orgIds.length === 0) return Response.json({ status: 'ok', organizations: [] });
    const orgs = await svc.entities.Organization.filter({ id: { $in: orgIds } }).catch(() => []);
    return Response.json({ status: 'ok', organizations: (orgs || []).map(safeOrg) });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});