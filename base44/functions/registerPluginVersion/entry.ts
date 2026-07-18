import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Plugin Engine — registerPluginVersion (Phase 5)
// Creates a DRAFT version of a plugin definition with a declarative manifest.
// Validates manifest shape and rejects executable-looking values. Rejects duplicate
// (pluginId, version). No package download or code execution. Management roles only.

const ALLOWED_MANIFEST_KEYS = new Set([
  'pluginKey', 'version', 'displayName', 'description', 'capabilities',
  'requiredPermissions', 'providedEvents', 'subscribedEvents', 'configurationSchema',
  'dependencies', 'minimumCoreVersion', 'maximumCoreVersion',
]);

const FORBIDDEN_PATTERNS = [
  /\beval\s*\(/,
  /\bnew\s+Function\b/,
  /\bFunction\s*\(/,
  /\bimport\s*\(/,
  /<\s*script/i,
  /\bjavascript\s*:/i,
  /\brequire\s*\(/,
  /\bprocess\.env\b/,
  /\b__proto__\b/,
];

function isPlainJson(v, depth = 0) {
  if (depth > 10) return false;
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.every((x) => isPlainJson(x, depth + 1));
  if (typeof v === 'object') return Object.values(v).every((x) => isPlainJson(x, depth + 1));
  return false; // functions, symbols, undefined, etc.
}

function scanExecutable(value, path, hits) {
  if (typeof value === 'string') {
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(value)) { hits.push(path); break; }
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => scanExecutable(v, `${path}[${i}]`, hits));
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) scanExecutable(value[k], `${path}.${k}`, hits);
  }
}

function validateManifest(manifest) {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return 'manifest must be an object';
  }
  if (!isPlainJson(manifest)) {
    return 'manifest must contain only JSON-safe values (no functions)';
  }
  for (const k of Object.keys(manifest)) {
    if (!ALLOWED_MANIFEST_KEYS.has(k)) return `manifest field not allowed: ${k}`;
  }
  const hits = [];
  scanExecutable(manifest, 'manifest', hits);
  if (hits.length) return `manifest contains executable-looking values at: ${hits[0]}`;
  return null;
}

async function publish(base44, eventType, sourceId, payload) {
  try {
    await base44.functions.invoke('publishEvent', {
      eventType, sourceType: 'plugin', sourceId: String(sourceId), payload,
    });
  } catch (_e) { /* best-effort */ }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'core_developer' && role !== 'super_admin') {
      return Response.json({ error: 'Not permitted to manage plugin versions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const pluginId = typeof body?.pluginId === 'string' ? body.pluginId.trim() : '';
    const version = typeof body?.version === 'string' ? body.version.trim() : '';
    if (!pluginId) return Response.json({ error: 'pluginId is required' }, { status: 400 });
    if (!version) return Response.json({ error: 'version is required' }, { status: 400 });

    const manifest = body?.manifest;
    const manifestError = validateManifest(manifest);
    if (manifestError) return Response.json({ error: manifestError }, { status: 400 });

    const svc = base44.asServiceRole;

    // Definition must exist.
    const definition = await svc.entities.PluginDefinition.get(pluginId).catch(() => null);
    if (!definition) return Response.json({ error: 'Plugin definition not found' }, { status: 404 });

    // (pluginId, version) must be unique.
    const dup = await svc.entities.PluginVersion.filter({ pluginId, version });
    if (dup && dup.length > 0) {
      return Response.json(
        { error: 'Plugin version already exists for this definition', version: dup[0] },
        { status: 409 }
      );
    }

    const created = await svc.entities.PluginVersion.create({
      pluginId,
      version,
      coreCompatibility: typeof body?.coreCompatibility === 'string' ? body.coreCompatibility.trim() : '',
      manifest,
      releaseStatus: 'draft',
      checksum: typeof body?.checksum === 'string' ? body.checksum.trim() : '',
      releasedAt: null,
    });

    await publish(base44, 'plugin.version_registered', created.id, {
      versionId: created.id,
      pluginId,
      version: created.version,
      releaseStatus: 'draft',
    });

    return Response.json({ status: 'registered', version: created });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});