import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Plugin Engine — releasePluginVersion (Phase 5)
// Validates compatibility and manifest completeness, then marks a draft version
// released. Released versions become immutable (no edit endpoint exists; re-release
// is rejected). Management roles only. No code execution.

const FORBIDDEN_PATTERNS = [
  /\beval\s*\(/, /\bnew\s+Function\b/, /\bFunction\s*\(/, /\bimport\s*\(/,
  /<\s*script/i, /\bjavascript\s*:/i, /\brequire\s*\(/, /\bprocess\.env\b/, /\b__proto__\b/,
];

function isPlainJson(v, depth = 0) {
  if (depth > 10) return false;
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.every((x) => isPlainJson(x, depth + 1));
  if (typeof v === 'object') return Object.values(v).every((x) => isPlainJson(x, depth + 1));
  return false;
}

function scanExecutable(value, path, hits) {
  if (typeof value === 'string') {
    for (const re of FORBIDDEN_PATTERNS) { if (re.test(value)) { hits.push(path); break; } }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => scanExecutable(v, `${path}[${i}]`, hits));
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) scanExecutable(value[k], `${path}.${k}`, hits);
  }
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
      return Response.json({ error: 'Not permitted to release plugin versions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const versionId = typeof body?.versionId === 'string' ? body.versionId.trim() : '';
    if (!versionId) return Response.json({ error: 'versionId is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const version = await svc.entities.PluginVersion.get(versionId).catch(() => null);
    if (!version) return Response.json({ error: 'Plugin version not found' }, { status: 404 });

    if (version.releaseStatus === 'released') {
      return Response.json({ error: 'Version is already released (immutable)', version }, { status: 409 });
    }
    if (version.releaseStatus === 'deprecated') {
      return Response.json({ error: 'Version is deprecated and cannot be released', version }, { status: 409 });
    }

    const definition = await svc.entities.PluginDefinition.get(version.pluginId).catch(() => null);
    if (!definition) return Response.json({ error: 'Plugin definition not found' }, { status: 404 });

    const manifest = version.manifest;
    // Completeness + compatibility validation.
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || !isPlainJson(manifest)) {
      return Response.json({ error: 'manifest is missing or not a plain object' }, { status: 400 });
    }
    const hits = [];
    scanExecutable(manifest, 'manifest', hits);
    if (hits.length) return Response.json({ error: `manifest contains executable-looking values at: ${hits[0]}` }, { status: 400 });

    if (typeof manifest.pluginKey !== 'string' || manifest.pluginKey !== definition.key) {
      return Response.json({ error: 'manifest.pluginKey must match the definition key' }, { status: 400 });
    }
    if (typeof manifest.version !== 'string' || manifest.version !== version.version) {
      return Response.json({ error: 'manifest.version must match the version string' }, { status: 400 });
    }
    if (typeof manifest.displayName !== 'string' || !manifest.displayName.trim()) {
      return Response.json({ error: 'manifest.displayName is required for release' }, { status: 400 });
    }
    const hasCompatibility =
      (typeof version.coreCompatibility === 'string' && version.coreCompatibility.trim()) ||
      (typeof manifest.minimumCoreVersion === 'string' && manifest.minimumCoreVersion.trim());
    if (!hasCompatibility) {
      return Response.json({ error: 'coreCompatibility or manifest.minimumCoreVersion is required for release' }, { status: 400 });
    }
    if (typeof version.checksum !== 'string' || !version.checksum.trim()) {
      return Response.json({ error: 'checksum is required for release' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const released = await svc.entities.PluginVersion.update(versionId, {
      releaseStatus: 'released',
      releasedAt: now,
    });

    // Point the definition at its current released version.
    await svc.entities.PluginDefinition.update(version.pluginId, { currentVersionId: versionId });

    await publish(base44, 'plugin.version_released', versionId, {
      versionId,
      pluginId: version.pluginId,
      version: version.version,
      releaseStatus: 'released',
    });

    return Response.json({ status: 'released', version: released });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});