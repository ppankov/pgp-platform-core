import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduler and Background Job Runtime — registerJobDefinition
// Creates a platform-global job definition. Core Developer / Super Admin only.
// handlerKey must reference a built-in static handler. Schemas are declarative only;
// executable-looking values and secret-looking keys are rejected.

const HANDLER_KEYS = ["system.health_check"];

const SECRET_KEYS = ["password","passwd","secret","token","access_token","refresh_token","api_key","apikey","client_secret","private_key","credential","authorization","cookie","session"];
function hasSecretKey(v, d=0) {
  if (d > 12 || v == null || typeof v !== "object") return false;
  for (const k of Object.keys(v)) {
    const lk = String(k).toLowerCase();
    if (SECRET_KEYS.some(s => lk.includes(s))) return true;
    if (hasSecretKey(v[k], d + 1)) return true;
  }
  return false;
}

const EXEC_PATTERNS = ["eval(","new Function","function(","function {","=>","import(","require(","process.env","<script","javascript:"];
function hasExecutable(v, d=0) {
  if (d > 12 || v == null) return false;
  if (typeof v === "string") return EXEC_PATTERNS.some(p => v.includes(p));
  if (typeof v === "object") { for (const k of Object.keys(v)) if (hasExecutable(v[k], d + 1)) return true; }
  return false;
}

function validateRetryPolicy(rp) {
  if (rp === undefined || rp === null) return null;
  if (typeof rp !== "object" || Array.isArray(rp)) return "retryPolicy must be an object";
  const ma = Number(rp.maxAttempts);
  if (!Number.isInteger(ma) || ma < 1 || ma > 10) return "maxAttempts must be an integer 1..10";
  const bt = rp.backoffType || "none";
  if (!["none","fixed","exponential"].includes(bt)) return "invalid backoffType";
  if (bt !== "none") {
    const base = Number(rp.baseDelaySeconds);
    if (!Number.isInteger(base) || base < 5 || base > 3600) return "baseDelaySeconds must be 5..3600";
    const maxd = Number(rp.maxDelaySeconds);
    if (!Number.isInteger(maxd) || maxd < base || maxd > 86400) return "maxDelaySeconds must be baseDelaySeconds..86400";
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const role = user.role;
    if (role !== "core_developer" && role !== "super_admin") {
      return Response.json({ error: "Not permitted to register job definitions" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const key = typeof body?.key === "string" ? body.key.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const handlerKey = typeof body?.handlerKey === "string" ? body.handlerKey.trim() : "";
    if (!key || !name || !handlerKey) {
      return Response.json({ error: "key, name and handlerKey are required" }, { status: 400 });
    }
    if (!HANDLER_KEYS.includes(handlerKey)) {
      return Response.json({ error: "unknown handlerKey: handler must be present in the static registry" }, { status: 400 });
    }

    const payloadSchema = body?.payloadSchema && typeof body.payloadSchema === "object" && !Array.isArray(body.payloadSchema) ? body.payloadSchema : {};
    const resultSchema = body?.resultSchema && typeof body.resultSchema === "object" && !Array.isArray(body.resultSchema) ? body.resultSchema : {};
    if (hasSecretKey(payloadSchema)) return Response.json({ error: "payloadSchema contains secret-looking keys" }, { status: 400 });
    if (hasSecretKey(resultSchema)) return Response.json({ error: "resultSchema contains secret-looking keys" }, { status: 400 });
    if (hasExecutable(payloadSchema)) return Response.json({ error: "payloadSchema contains executable-looking values" }, { status: 400 });
    if (hasExecutable(resultSchema)) return Response.json({ error: "resultSchema contains executable-looking values" }, { status: 400 });

    const defaultRetryPolicy = body?.defaultRetryPolicy && typeof body.defaultRetryPolicy === "object" ? body.defaultRetryPolicy : null;
    if (defaultRetryPolicy) {
      const rpErr = validateRetryPolicy(defaultRetryPolicy);
      if (rpErr) return Response.json({ error: rpErr }, { status: 400 });
    }

    // Duplicate key check (store-level uniqueness not guaranteed; enforced in logic).
    const existing = await base44.asServiceRole.entities.JobDefinition.filter({ key });
    if (existing && existing.length > 0) {
      return Response.json({ error: "job definition key already exists" }, { status: 400 });
    }

    const def = await base44.asServiceRole.entities.JobDefinition.create({
      key, name,
      description: typeof body?.description === "string" ? body.description : "",
      handlerKey,
      payloadSchema, resultSchema,
      defaultRetryPolicy: defaultRetryPolicy || null,
      active: body?.active === false ? false : true,
      createdAt: new Date().toISOString(),
    });

    // Best-effort event publication.
    try {
      await base44.asServiceRole.functions.invoke("publishEvent", {
        eventType: "job.definition_registered", sourceType: "job", sourceId: def.id,
        payload: { jobDefinitionId: def.id, handlerKey }, actorId: user.id, organizationId: null,
      });
    } catch (e) {}

    return Response.json({ status: "registered", definition: { id: def.id, key: def.key, handlerKey: def.handlerKey } });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});