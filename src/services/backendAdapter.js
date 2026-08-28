// src/services/backendAdapter.js
// Provider-neutral frontend facade.
//
// Wave 10.1 — Base44 is the only provider. This facade delegates to the
// canonical Base44 adapter (base44Adapter.js) without changing method names,
// argument shapes, return shapes, or error propagation. Frontend consumers
// import `backend` from here instead of touching the Base44 SDK or the raw
// provider client directly.
//
// Wave 10.2 — Frontend Provider Facade Hardening.
// The broad `backend.entities` passthrough from Wave 10.1 is REMOVED. Direct
// frontend reads now go through a narrow, read-only `backend.catalog` API
// backed by an explicit Template A / Template C read allow-list (frozen
// Phase 9 entity security matrix). Template B (function-only) and unknown
// entity names are rejected BEFORE any provider call. No create/update/
// delete/bulk, no `asServiceRole`, no RLS bypass, no eval / reflective
// arbitrary invocation, no dynamic method names (only list/filter/get).
// `backend.functions.invoke` (Template B reads + mutations) and
// `backend.auth.*` keep their Wave 10.1 contracts unchanged. `backend.raw`
// and the raw provider client are NOT exposed.

import { getBoundProvider } from '@/services/providerBootstrap';

// Wave 10.5C.2 — provider is bound by providerBootstrap before this module
// evaluates (App.jsx is dynamically imported only after bootstrap succeeds).
// getBoundProvider is synchronous and returns the exact frozen bundle.
const { providerClient, fetchPublicSettings } = getBoundProvider();

// Read allow-list (authoritative: frozen Phase 9 entity security matrix).
// Template A — authenticated direct read (datastore RLS: read admin/user).
const TEMPLATE_A_READ = new Set([
  "ApplicationDefinition",
  "PluginDefinition",
  "ConnectorDefinition",
  "ConnectorProvider",
  "JobDefinition",
  "EventTopic",
  "LifecycleDefinition",
  "LifecycleState",
  "LifecycleTransition",
  "AuditCategoryDefinition",
  "AuditRuleDefinition",
  "AuditProfileDefinition",
  "AuditKnowledgeArticle",
]);

// Template C — admin-only datastore read (datastore RLS restricts to admin).
const TEMPLATE_C_ADMIN_READ = new Set([
  "PlatformRole",
  "Permission",
  "RolePermission",
]);

const ALLOWED_READ = new Set([...TEMPLATE_A_READ, ...TEMPLATE_C_ADMIN_READ]);

function assertReadable(entityName) {
  // Reject Template B (function-only) and unknown names before any provider
  // call. Template B reads remain the contract of protected backend functions
  // invoked via backend.functions.invoke. No RLS weakening, no bypass.
  if (typeof entityName !== "string" || !ALLOWED_READ.has(entityName)) {
    throw new Error(
      `backend.catalog: entity "${String(entityName)}" is not in the read allow-list.`
    );
  }
}

// Read-only catalog facade. Fixed methods only (list / filter / get); the
// entity name is the only string parameter. Sort and limit are forwarded
// positionally to the provider exactly as before; no new query language, no
// pagination semantics change, response shapes unchanged. No create/update/
// delete/bulk methods are exposed.
export const catalog = {
  list(entityName, options = {}) {
    assertReadable(entityName);
    return providerClient.entities[entityName].list(options.sort, options.limit);
  },
  filter(entityName, filters = {}, options = {}) {
    assertReadable(entityName);
    return providerClient.entities[entityName].filter(filters, options.sort, options.limit);
  },
  get(entityName, id) {
    assertReadable(entityName);
    return providerClient.entities[entityName].get(id);
  },
};

export const backend = {
  auth: providerClient.auth,
  functions: providerClient.functions,
  catalog,
  fetchPublicSettings,
};