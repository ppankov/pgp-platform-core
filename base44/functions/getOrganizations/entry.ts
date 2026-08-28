import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Phase 9 — Organization access read function (group 1: Organization + OrganizationMember)
// Returns the organizations the caller may operate on:
//   - super_admin: all organizations
//   - any other authenticated role: organizations where they have an ACTIVE membership
// Organization isolation is function-enforced (Datastore RLS does not simulate the
// OrganizationMember join). No role/actorId is accepted from the request body.
// Redacts sensitive-looking keys; safe errors; bounded.
//
// Phase 10 — Wave 10.4B.2: same-file provider-neutral architecture pattern.
// createBase44Provider owns all Base44 access; executeGetOrganizations owns all
// application policy and references only the explicit user + 3 provider
// capabilities + local pure helpers (0 Base44 / svc / .entities / Deno / req refs).
// HTTP, tenant, role, datastore list/filter, projection and redaction behavior
// are byte-for-byte unchanged.

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

// Same-file Base44 adapter. Owns base44.auth.me(), base44.asServiceRole,
// OrganizationMember entity access, Organization entity access, and the exact
// list() vs filter() selection required for datastore-call parity. Exposes
// exactly 3 provider-neutral capabilities; no raw client / svc / entity
// namespaces / generic CRUD / dynamic entity names leak outside the adapter.
function createBase44Provider(base44) {
  const svc = base44.asServiceRole;
  return {
    async getCurrentUser() {
      return await base44.auth.me();
    },
    async listActiveOrganizationMemberships(userId) {
      const memberships = await svc.entities.OrganizationMember.filter({ user_id: userId, status: 'active' }).catch(() => []);
      return memberships || [];
    },
    async filterOrganizations(filter) {
      // Empty filter (admin/super_admin branch) → Organization.list() exactly
      // as before (no .catch — a list() error propagates to the outer 500).
      if (!filter || Object.keys(filter).length === 0) {
        return await svc.entities.Organization.list();
      }
      // Non-empty filter (membership-restricted branch) → Organization.filter()
      // exactly as before (with .catch(() => []) → empty result on error).
      return await svc.entities.Organization.filter(filter).catch(() => []);
    },
  };
}

// Provider-neutral orchestration. Owns unauthenticated branch, admin/super_admin
// policy branch, membership-restricted branch, empty-memberships branch,
// organization ID construction + dedup, entity-specific filter construction,
// safeOrg projection, settings redaction, and exact response construction.
// 0 references to base44 / svc / .entities / createClientFromRequest / Deno /
// req / auth.me / asServiceRole / Organization.list / Organization.filter /
// OrganizationMember.filter. Provider errors propagate to the outer HTTP catch.
async function executeGetOrganizations(user, provider) {
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };

  if (user.role === 'super_admin' || user.role === 'admin') {
    // admin role is built-in and runtime-real; super_admin sees all orgs,
    // admin sees all orgs (admin is a platform operator role per built-in model).
    const orgs = await provider.filterOrganizations({});
    return { status: 200, body: { status: 'ok', organizations: (orgs || []).map(safeOrg) } };
  }

  // Any other authenticated role: restrict to active memberships.
  const memberships = await provider.listActiveOrganizationMemberships(user.id);
  const orgIds = [...new Set((memberships || []).map((m) => m.organization_id))];
  if (orgIds.length === 0) return { status: 200, body: { status: 'ok', organizations: [] } };
  const orgs = await provider.filterOrganizations({ id: { $in: orgIds } });
  return { status: 200, body: { status: 'ok', organizations: (orgs || []).map(safeOrg) } };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const provider = createBase44Provider(base44);
    const user = await provider.getCurrentUser();
    const result = await executeGetOrganizations(user, provider);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: safeMsg(error) }, { status: 500 });
  }
});