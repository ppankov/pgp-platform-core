import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Workflow Engine — registerWorkflowVersion (Phase 7)
// Creates a draft version with a validated declarative graph. Respects definition scope.
// workflowDefinitionId + version must be unique. Graph is declarative-only.

const str = (v) => (typeof v === 'string' ? v.trim() : '');

const SUPPORTED_NODE_TYPES = ['start', 'manual', 'end'];
const EXEC_PATTERN = /function|eval\(|new\s+Function|import\(|require\(|__proto__|<script|javascript:/i;

function validateGraph(graph) {
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return { ok: false, error: 'graph must be an object' };
  const nodes = graph.nodes, edges = graph.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return { ok: false, error: 'graph requires nodes and edges arrays' };
  if (nodes.length === 0) return { ok: false, error: 'graph must contain at least one node' };
  const keys = new Set();
  for (const n of nodes) {
    if (!n || typeof n !== 'object') return { ok: false, error: 'invalid node' };
    if (typeof n.key !== 'string' || !n.key) return { ok: false, error: 'node key is required' };
    if (keys.has(n.key)) return { ok: false, error: 'duplicate node key: ' + n.key };
    keys.add(n.key);
    if (typeof n.type !== 'string' || !n.type) return { ok: false, error: 'node type is required' };
    if (!SUPPORTED_NODE_TYPES.includes(n.type)) return { ok: false, error: 'unsupported node type: ' + n.type };
  }
  const starts = nodes.filter((n) => n.type === 'start');
  if (starts.length !== 1) return { ok: false, error: 'graph must contain exactly one start node' };
  const ends = nodes.filter((n) => n.type === 'end');
  if (ends.length === 0) return { ok: false, error: 'graph must contain at least one end node' };
  const edgeSet = new Set();
  for (const e of edges) {
    if (!e || typeof e !== 'object') return { ok: false, error: 'invalid edge' };
    if (typeof e.from !== 'string' || typeof e.to !== 'string') return { ok: false, error: 'edge from/to are required' };
    if (!keys.has(e.from) || !keys.has(e.to)) return { ok: false, error: 'edge references unknown node' };
    const ek = e.from + '|' + e.to + '|' + (e.label || '');
    if (edgeSet.has(ek)) return { ok: false, error: 'duplicate edge: ' + e.from + '->' + e.to };
    edgeSet.add(ek);
  }
  for (const e of edges) if (e.to === starts[0].key) return { ok: false, error: 'start node cannot have incoming edges' };
  for (const n of ends) for (const e of edges) if (e.from === n.key) return { ok: false, error: 'end nodes cannot have outgoing edges' };
  for (const n of nodes) {
    if (n.type === 'end') continue;
    if (!edges.some((e) => e.from === n.key)) return { ok: false, error: 'node ' + n.key + ' has no outgoing edges' };
  }
  // reachability from start
  const reachable = new Set([starts[0].key]);
  let q = [starts[0].key];
  while (q.length) {
    const cur = q.shift();
    for (const e of edges) if (e.from === cur && !reachable.has(e.to)) { reachable.add(e.to); q.push(e.to); }
  }
  for (const k of keys) if (!reachable.has(k)) return { ok: false, error: 'unreachable node: ' + k };
  // cycle detection (iterative DFS)
  const adj = new Map();
  for (const k of keys) adj.set(k, []);
  for (const e of edges) adj.get(e.from).push(e.to);
  const color = new Map();
  for (const k of keys) color.set(k, 0);
  let cycle = false;
  const stack = [[starts[0].key, 0]];
  while (stack.length) {
    const top = stack[stack.length - 1];
    const u = top[0], i = top[1];
    color.set(u, 1);
    const neighbors = adj.get(u);
    if (i < neighbors.length) {
      top[1] = i + 1;
      const v = neighbors[i];
      if (color.get(v) === 1) { cycle = true; break; }
      if (color.get(v) === 0) stack.push([v, 0]);
    } else {
      color.set(u, 2);
      stack.pop();
    }
  }
  if (cycle) return { ok: false, error: 'graph must not contain cycles' };
  if (EXEC_PATTERN.test(JSON.stringify(graph))) return { ok: false, error: 'graph contains executable-looking values' };
  return { ok: true };
}

async function publish(base44, eventType, sourceId, payload) {
  try {
    await base44.functions.invoke('publishEvent', {
      eventType, sourceType: 'workflow', sourceId: String(sourceId), payload,
    });
  } catch (_e) { /* best-effort */ }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    const body = await req.json().catch(() => ({}));
    const workflowDefinitionId = str(body?.workflowDefinitionId);
    const version = str(body?.version);
    if (!workflowDefinitionId || !version) {
      return Response.json({ error: 'workflowDefinitionId and version are required' }, { status: 400 });
    }
    const graph = body?.graph;
    if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
      return Response.json({ error: 'graph is required and must be an object' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const def = await svc.entities.WorkflowDefinition.get(workflowDefinitionId).catch(() => null);
    if (!def) return Response.json({ error: 'Workflow definition not found' }, { status: 404 });

    // scope permission
    if (def.scope === 'platform') {
      if (role !== 'core_developer' && role !== 'super_admin') {
        return Response.json({ error: 'Not permitted to manage versions for platform workflow definitions' }, { status: 403 });
      }
    } else {
      if (role !== 'admin' && role !== 'super_admin') {
        return Response.json({ error: 'Not permitted to manage versions for organization workflow definitions' }, { status: 403 });
      }
    }

    // Phase 9: org-scoped definitions require active OrganizationMember membership (Decision B2).
    if (def.scope === 'organization' && role !== 'super_admin') {
      const _members = await svc.entities.OrganizationMember.filter({ user_id: user.id, organization_id: def.organizationId, status: 'active' }).catch(() => []);
      if (!_members || _members.length === 0) return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // duplicate version
    const existing = await svc.entities.WorkflowVersion.filter({ workflowDefinitionId, version });
    if (existing && existing.length > 0) {
      return Response.json({ error: 'Version already exists for this definition' }, { status: 409 });
    }

    const v = validateGraph(graph);
    if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

    const checksum = str(body?.checksum);
    const now = new Date().toISOString();
    const wfVersion = await svc.entities.WorkflowVersion.create({
      workflowDefinitionId, version, graph,
      releaseStatus: 'draft', checksum, createdAt: now, releasedAt: null,
    });

    await publish(base44, 'workflow.version_registered', wfVersion.id, {
      workflowDefinitionId, workflowVersionId: wfVersion.id, version,
    });

    return Response.json({ status: 'created', version: wfVersion });
  } catch (error) {
    return Response.json({ error: String(error?.message || 'Unexpected error').slice(0, 200) }, { status: 500 });
  }
});