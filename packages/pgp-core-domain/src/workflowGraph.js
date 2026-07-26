// PGP Core — Workflow Graph Domain (provider-independent)
// Behavioral parity with deployed Base44 functions:
//   registerWorkflowVersion/entry.ts (validateGraph)
//   releaseWorkflowVersion/entry.ts (validateGraph)
// Pure: no Base44, no Deno, no Supabase, no network, no filesystem, no env,
// no implicit current time, no side effects, no input mutation.

const SUPPORTED_NODE_TYPES = ["start", "manual", "end"];
const EXEC_PATTERN = /function|eval\(|new\s+Function|import\(|require\(|__proto__|<script|javascript:/i;

export function validateWorkflowGraph(graph) {
  if (!graph || typeof graph !== "object" || Array.isArray(graph))
    return { ok: false, error: "graph must be an object" };
  const nodes = graph.nodes, edges = graph.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges))
    return { ok: false, error: "graph requires nodes and edges arrays" };
  if (nodes.length === 0)
    return { ok: false, error: "graph must contain at least one node" };
  const keys = new Set();
  for (const n of nodes) {
    if (!n || typeof n !== "object") return { ok: false, error: "invalid node" };
    if (typeof n.key !== "string" || !n.key) return { ok: false, error: "node key is required" };
    if (keys.has(n.key)) return { ok: false, error: "duplicate node key: " + n.key };
    keys.add(n.key);
    if (typeof n.type !== "string" || !n.type) return { ok: false, error: "node type is required" };
    if (!SUPPORTED_NODE_TYPES.includes(n.type)) return { ok: false, error: "unsupported node type: " + n.type };
  }
  const starts = nodes.filter((n) => n.type === "start");
  if (starts.length !== 1)
    return { ok: false, error: "graph must contain exactly one start node" };
  const ends = nodes.filter((n) => n.type === "end");
  if (ends.length === 0)
    return { ok: false, error: "graph must contain at least one end node" };
  const edgeSet = new Set();
  for (const e of edges) {
    if (!e || typeof e !== "object") return { ok: false, error: "invalid edge" };
    if (typeof e.from !== "string" || typeof e.to !== "string") return { ok: false, error: "edge from/to are required" };
    if (!keys.has(e.from) || !keys.has(e.to)) return { ok: false, error: "edge references unknown node" };
    // Open contract reconciliation item — no behavior change in Wave 10.3A:
    // Deployed code identity: from + "|" + to + "|" + label  (label participates in uniqueness)
    // Frozen Phase 7 spec identity: repeated (from, to) pair  (label does NOT participate)
    // Package uses deployed behavior to guarantee no runtime semantic change on integration.
    const ek = e.from + "|" + e.to + "|" + (e.label || "");
    if (edgeSet.has(ek)) return { ok: false, error: "duplicate edge: " + e.from + "->" + e.to };
    edgeSet.add(ek);
  }
  for (const e of edges) if (e.to === starts[0].key) return { ok: false, error: "start node cannot have incoming edges" };
  for (const n of ends) for (const e of edges) if (e.from === n.key) return { ok: false, error: "end nodes cannot have outgoing edges" };
  for (const n of nodes) {
    if (n.type === "end") continue;
    if (!edges.some((e) => e.from === n.key)) return { ok: false, error: "node " + n.key + " has no outgoing edges" };
  }
  // reachability from start
  const reachable = new Set([starts[0].key]);
  let q = [starts[0].key];
  while (q.length) {
    const cur = q.shift();
    for (const e of edges) if (e.from === cur && !reachable.has(e.to)) { reachable.add(e.to); q.push(e.to); }
  }
  for (const k of keys) if (!reachable.has(k)) return { ok: false, error: "unreachable node: " + k };
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
  if (cycle) return { ok: false, error: "graph must not contain cycles" };
  if (EXEC_PATTERN.test(JSON.stringify(graph))) return { ok: false, error: "graph contains executable-looking values" };
  return { ok: true };
}