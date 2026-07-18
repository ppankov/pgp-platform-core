// Single source of truth for PGP Core navigation.
// Each item: { key, labelKey, path, roles, children? }
// roles = platform roles allowed to SEE the nav item (frontend visibility only — backend enforces real auth).
// "authenticated_member" means any recognized authenticated platform role except guest.

export const NAV_GROUPS = [
  { key: "platform", labelKey: "nav.group.platform", order: 1 },
  { key: "identity", labelKey: "nav.group.identity", order: 2 },
  { key: "extensibility", labelKey: "nav.group.extensibility", order: 3 },
  { key: "workflow", labelKey: "nav.group.workflow", order: 4 },
  { key: "lifecycle", labelKey: "nav.group.lifecycle", order: 5 },
  { key: "event_bus", labelKey: "nav.group.event_bus", order: 6 },
  { key: "operations", labelKey: "nav.group.operations", order: 7 },
  { key: "configuration", labelKey: "nav.group.configuration", order: 8 },
  { key: "experience", labelKey: "nav.group.experience", order: 9 },
  { key: "administration", labelKey: "nav.group.administration", order: 10 },
  { key: "architecture_intelligence", labelKey: "nav.group.architecture_intelligence", order: 11 },
  { key: "jobs", labelKey: "nav.group.jobs", order: 12 },
];

const ADMIN_ROLES = ["super_admin", "admin"];
const DEV_ROLES = ["super_admin", "core_developer", "developer"];
const ARCH_ROLES = ["super_admin", "core_developer", "solution_architect"];
const OPS_ROLES = ["super_admin", "core_developer", "developer", "auditor", "admin"];
// Lifecycle Engine: developer/solution_architect = read; core_developer/admin/super_admin = full.
const LIFECYCLE_ROLES = ["super_admin", "admin", "core_developer", "developer", "solution_architect"];
const EVENT_BUS_ROLES = ["super_admin", "admin", "core_developer", "developer", "solution_architect"];
const PLUGIN_ROLES = ["super_admin", "admin", "core_developer", "developer", "solution_architect"];
const WORKFLOW_ROLES = ["super_admin", "admin", "core_developer", "developer", "solution_architect"];
const JOBS_ROLES = ["super_admin", "admin", "core_developer", "developer", "solution_architect"];

export const NAV_ITEMS = [
  // --- Platform ---
  { key: "dashboard", labelKey: "nav.dashboard", path: "/", group: "platform", roles: "authenticated_member", isPage: true },
  { key: "organizations", labelKey: "nav.organizations", path: "/organizations", group: "platform", roles: ADMIN_ROLES },
  {
    key: "applications", labelKey: "nav.applications", path: "/applications", group: "platform", roles: [...ADMIN_ROLES, ...DEV_ROLES, "solution_architect"],
    children: [
      { key: "app_marketplace", labelKey: "nav.app_marketplace", path: "/applications/marketplace", roles: [...ADMIN_ROLES, ...DEV_ROLES, "solution_architect"] },
      { key: "app_installed", labelKey: "nav.app_installed", path: "/applications/installed", roles: [...ADMIN_ROLES, ...DEV_ROLES] },
      { key: "app_updates", labelKey: "nav.app_updates", path: "/applications/updates", roles: [...ADMIN_ROLES, ...DEV_ROLES] },
    ],
  },

  // --- Identity ---
  { key: "users", labelKey: "nav.users", path: "/users", group: "identity", roles: [...ADMIN_ROLES, "support"] },
  { key: "roles", labelKey: "nav.roles", path: "/roles", group: "identity", roles: ADMIN_ROLES },
  { key: "permissions", labelKey: "nav.permissions", path: "/permissions", group: "identity", roles: ADMIN_ROLES },

  // --- Extensibility ---
  { key: "plugins", labelKey: "nav.plugins", path: "/plugins", group: "extensibility", roles: PLUGIN_ROLES, isPage: true },
  { key: "plugin_installed", labelKey: "nav.plugin_installed", path: "/plugins/installed", group: "extensibility", roles: PLUGIN_ROLES, isPage: true },
  { key: "connectors", labelKey: "nav.connectors", path: "/connectors", group: "extensibility", roles: [...DEV_ROLES, ...ADMIN_ROLES], isPage: true },
  { key: "connector_connections", labelKey: "nav.connector_connections", path: "/connectors/connections", group: "extensibility", roles: [...DEV_ROLES, ...ADMIN_ROLES], isPage: true },
  { key: "services", labelKey: "nav.services", path: "/services", group: "extensibility", roles: [...DEV_ROLES, ...ADMIN_ROLES] },

  // --- Workflow Engine (declarative graph + manual progression) ---
  { key: "workflows", labelKey: "nav.workflows", path: "/workflows", group: "workflow", roles: WORKFLOW_ROLES, isPage: true },
  { key: "workflow_instances", labelKey: "nav.workflow_instances", path: "/workflows/instances", group: "workflow", roles: WORKFLOW_ROLES, isPage: true },

  // --- Scheduler and Background Job Runtime (declarative scheduling + queue + worker) ---
  { key: "job_definitions", labelKey: "nav.job_definitions", path: "/jobs/definitions", group: "jobs", roles: JOBS_ROLES, isPage: true },
  { key: "job_schedules", labelKey: "nav.job_schedules", path: "/jobs/schedules", group: "jobs", roles: JOBS_ROLES, isPage: true },
  { key: "job_queue", labelKey: "nav.job_queue", path: "/jobs/queue", group: "jobs", roles: JOBS_ROLES, isPage: true },
  { key: "job_history", labelKey: "nav.job_history", path: "/jobs/history", group: "jobs", roles: JOBS_ROLES, isPage: true },
  { key: "dead_letter", labelKey: "nav.dead_letter", path: "/jobs/dead-letter", group: "jobs", roles: JOBS_ROLES, isPage: true },

  // --- Lifecycle Engine (platform-wide infrastructure, generic by targetType) ---
  { key: "lifecycle_definitions", labelKey: "nav.lifecycle_definitions", path: "/lifecycle/definitions", group: "lifecycle", roles: LIFECYCLE_ROLES, isPage: true },
  { key: "lifecycle_states", labelKey: "nav.lifecycle_states", path: "/lifecycle/states", group: "lifecycle", roles: LIFECYCLE_ROLES, isPage: true },
  { key: "lifecycle_transitions", labelKey: "nav.lifecycle_transitions", path: "/lifecycle/transitions", group: "lifecycle", roles: LIFECYCLE_ROLES, isPage: true },
  { key: "lifecycle_viewer", labelKey: "nav.lifecycle_viewer", path: "/lifecycle/viewer", group: "lifecycle", roles: LIFECYCLE_ROLES, isPage: true },

  // --- Event Bus (platform-wide delivery runtime, generic by eventType) ---
  { key: "event_deliveries", labelKey: "nav.event_deliveries", path: "/event-bus/deliveries", group: "event_bus", roles: EVENT_BUS_ROLES, isPage: true },
  { key: "event_delivery_failed", labelKey: "nav.event_delivery_failed", path: "/event-bus/deliveries/failed", group: "event_bus", roles: EVENT_BUS_ROLES, isPage: true },

  // --- Operations ---
  {
    key: "monitoring", labelKey: "nav.monitoring", path: "/monitoring", group: "operations", roles: OPS_ROLES,
    children: [
      { key: "mon_health", labelKey: "nav.mon_health", path: "/monitoring/health", roles: OPS_ROLES },
      { key: "mon_performance", labelKey: "nav.mon_performance", path: "/monitoring/performance", roles: OPS_ROLES },
      { key: "mon_errors", labelKey: "nav.mon_errors", path: "/monitoring/errors", roles: OPS_ROLES },
      { key: "mon_queues", labelKey: "nav.mon_queues", path: "/monitoring/queues", roles: OPS_ROLES },
      { key: "mon_scheduler", labelKey: "nav.mon_scheduler", path: "/monitoring/scheduler", roles: OPS_ROLES },
      { key: "mon_workers", labelKey: "nav.mon_workers", path: "/monitoring/workers", roles: OPS_ROLES },
      { key: "mon_jobs", labelKey: "nav.mon_jobs", path: "/monitoring/jobs", roles: OPS_ROLES },
      { key: "mon_status", labelKey: "nav.mon_status", path: "/monitoring/status", roles: OPS_ROLES },
    ],
  },
  { key: "system_logs", labelKey: "nav.system_logs", path: "/system-logs", group: "operations", roles: [...DEV_ROLES, "auditor"] },
  { key: "audit_log", labelKey: "nav.audit_log", path: "/audit-log", group: "operations", roles: ["auditor", ...ADMIN_ROLES] },
  { key: "notifications", labelKey: "nav.notifications", path: "/notifications", group: "operations", roles: "authenticated_member" },

  // --- Configuration ---
  {
    key: "ai_center", labelKey: "nav.ai_center", path: "/ai-center", group: "configuration", roles: DEV_ROLES,
    children: [
      { key: "ai_providers", labelKey: "nav.ai_providers", path: "/ai-center/providers", roles: DEV_ROLES },
      { key: "ai_models", labelKey: "nav.ai_models", path: "/ai-center/models", roles: DEV_ROLES },
      { key: "ai_routing", labelKey: "nav.ai_routing", path: "/ai-center/routing", roles: DEV_ROLES },
      { key: "ai_prompt_library", labelKey: "nav.ai_prompt_library", path: "/ai-center/prompt-library", roles: DEV_ROLES },
      { key: "ai_agents", labelKey: "nav.ai_agents", path: "/ai-center/agents", roles: DEV_ROLES },
      { key: "ai_usage", labelKey: "nav.ai_usage", path: "/ai-center/usage", roles: [...DEV_ROLES, "admin"] },
      { key: "ai_costs", labelKey: "nav.ai_costs", path: "/ai-center/costs", roles: [...DEV_ROLES, "admin"] },
      { key: "ai_logs", labelKey: "nav.ai_logs", path: "/ai-center/logs", roles: DEV_ROLES },
    ],
  },
  {
    key: "storage", labelKey: "nav.storage", path: "/storage", group: "configuration", roles: DEV_ROLES,
    children: [
      { key: "storage_providers", labelKey: "nav.storage_providers", path: "/storage/providers", roles: DEV_ROLES },
      { key: "storage_buckets", labelKey: "nav.storage_buckets", path: "/storage/buckets", roles: DEV_ROLES },
      { key: "storage_media", labelKey: "nav.storage_media", path: "/storage/media", roles: DEV_ROLES },
      { key: "storage_backups", labelKey: "nav.storage_backups", path: "/storage/backups", roles: DEV_ROLES },
      { key: "storage_restore", labelKey: "nav.storage_restore", path: "/storage/restore", roles: DEV_ROLES },
      { key: "storage_replication", labelKey: "nav.storage_replication", path: "/storage/replication", roles: DEV_ROLES },
      { key: "storage_health", labelKey: "nav.storage_health", path: "/storage/health", roles: DEV_ROLES },
    ],
  },
  {
    key: "communications", labelKey: "nav.communications", path: "/communications", group: "configuration", roles: DEV_ROLES,
    children: [
      { key: "comm_channels", labelKey: "nav.comm_channels", path: "/communications/channels", roles: DEV_ROLES },
      { key: "comm_mailboxes", labelKey: "nav.comm_mailboxes", path: "/communications/mailboxes", roles: DEV_ROLES },
      { key: "comm_templates", labelKey: "nav.comm_templates", path: "/communications/templates", roles: DEV_ROLES },
      { key: "comm_delivery_log", labelKey: "nav.comm_delivery_log", path: "/communications/delivery-log", roles: DEV_ROLES },
    ],
  },
  {
    key: "search", labelKey: "nav.search", path: "/search", group: "configuration", roles: DEV_ROLES,
    children: [
      { key: "search_main", labelKey: "nav.search_main", path: "/search", roles: DEV_ROLES },
      { key: "search_indexes", labelKey: "nav.search_indexes", path: "/search/indexes", roles: DEV_ROLES },
      { key: "search_crawler", labelKey: "nav.search_crawler", path: "/search/crawler", roles: DEV_ROLES },
      { key: "search_ranking", labelKey: "nav.search_ranking", path: "/search/ranking", roles: DEV_ROLES },
      { key: "search_ai", labelKey: "nav.search_ai", path: "/search/ai", roles: DEV_ROLES },
      { key: "search_rebuild", labelKey: "nav.search_rebuild", path: "/search/rebuild", roles: DEV_ROLES },
    ],
  },
  { key: "api_clients", labelKey: "nav.api_clients", path: "/api-clients", group: "configuration", roles: DEV_ROLES },
  { key: "api_keys", labelKey: "nav.api_keys", path: "/api-keys", group: "configuration", roles: DEV_ROLES },
  { key: "webhooks", labelKey: "nav.webhooks", path: "/webhooks", group: "configuration", roles: DEV_ROLES },
  { key: "feature_flags", labelKey: "nav.feature_flags", path: "/feature-flags", group: "configuration", roles: [...DEV_ROLES, ...ADMIN_ROLES] },
  { key: "licenses", labelKey: "nav.licenses", path: "/licenses", group: "configuration", roles: ADMIN_ROLES },

  // --- Experience ---
  { key: "themes", labelKey: "nav.themes", path: "/themes", group: "experience", roles: ADMIN_ROLES },
  { key: "languages", labelKey: "nav.languages", path: "/languages", group: "experience", roles: ADMIN_ROLES },

  // --- Administration ---
  { key: "security_center", labelKey: "nav.security_center", path: "/security", group: "administration", roles: ["super_admin", "core_developer", "solution_architect", "admin"], isPage: true },
  { key: "system_settings", labelKey: "nav.system_settings", path: "/system-settings", group: "administration", roles: [...ADMIN_ROLES, "core_developer"] },
  { key: "admin_console", labelKey: "nav.admin_console", path: "/admin-console", group: "administration", roles: ADMIN_ROLES },
  {
    key: "developer_console", labelKey: "nav.developer_console", path: "/developer-console", group: "administration", roles: DEV_ROLES,
    children: [
      { key: "dc_plugin_builder", labelKey: "nav.dc_plugin_builder", path: "/developer-console/plugin-builder", roles: DEV_ROLES },
      { key: "dc_connector_builder", labelKey: "nav.dc_connector_builder", path: "/developer-console/connector-builder", roles: DEV_ROLES },
      { key: "dc_app_builder", labelKey: "nav.dc_app_builder", path: "/developer-console/application-builder", roles: DEV_ROLES },
      { key: "dc_schema_designer", labelKey: "nav.dc_schema_designer", path: "/developer-console/schema-designer", roles: DEV_ROLES },
      { key: "dc_api_explorer", labelKey: "nav.dc_api_explorer", path: "/developer-console/api-explorer", roles: DEV_ROLES },
      { key: "dc_migration_manager", labelKey: "nav.dc_migration_manager", path: "/developer-console/migration-manager", roles: ["core_developer", "super_admin"] },
      { key: "dc_debug", labelKey: "nav.dc_debug", path: "/developer-console/debug", roles: DEV_ROLES },
      { key: "dc_logs", labelKey: "nav.dc_logs", path: "/developer-console/logs", roles: DEV_ROLES },
    ],
  },
  { key: "documentation", labelKey: "nav.documentation", path: "/documentation", group: "administration", roles: "authenticated_member" },

  // --- Architecture Intelligence (installable app) ---
  { key: "ai_projects", labelKey: "nav.ai_projects", path: "/architecture-intelligence/projects", group: "architecture_intelligence", roles: "authenticated_member" },
  { key: "ai_runs", labelKey: "nav.ai_runs", path: "/architecture-intelligence/runs", group: "architecture_intelligence", roles: "authenticated_member" },
  { key: "ai_findings", labelKey: "nav.ai_findings", path: "/architecture-intelligence/findings", group: "architecture_intelligence", roles: "authenticated_member" },
  { key: "ai_reports", labelKey: "nav.ai_reports", path: "/architecture-intelligence/reports", group: "architecture_intelligence", roles: "authenticated_member" },
  { key: "ai_benchmarks", labelKey: "nav.ai_benchmarks", path: "/architecture-intelligence/benchmarks", group: "architecture_intelligence", roles: "authenticated_member" },
  { key: "ai_assistant", labelKey: "nav.ai_assistant", path: "/architecture-intelligence/assistant", group: "architecture_intelligence", roles: "authenticated_member" },
  { key: "ai_profiles", labelKey: "nav.ai_profiles", path: "/architecture-intelligence/profiles", group: "architecture_intelligence", roles: ARCH_ROLES },
  { key: "ai_categories", labelKey: "nav.ai_categories", path: "/architecture-intelligence/categories", group: "architecture_intelligence", roles: ARCH_ROLES },
  { key: "ai_rules", labelKey: "nav.ai_rules", path: "/architecture-intelligence/rules", group: "architecture_intelligence", roles: ARCH_ROLES },
  { key: "ai_knowledge", labelKey: "nav.ai_knowledge", path: "/architecture-intelligence/knowledge", group: "architecture_intelligence", roles: ARCH_ROLES },
  { key: "ai_settings", labelKey: "nav.ai_settings", path: "/architecture-intelligence/settings", group: "architecture_intelligence", roles: [...ADMIN_ROLES, ...DEV_ROLES] },
];

// Flatten all routes (including children) for router generation.
export const ALL_ROUTES = NAV_ITEMS.flatMap((item) => {
  if (item.children) {
    return item.children.map((child) => ({ ...child, group: item.group, parentKey: item.key }));
  }
  return [{ ...item, parentKey: null }];
});

// Helper: check if a role is allowed for a nav item.
// "authenticated_member" = any recognized authenticated platform role except guest.
// Unknown roles and unresolved access context (null) deny by default.
export function isRoleAllowed(roles, currentRole) {
  if (roles === "authenticated_member") {
    return currentRole !== null && currentRole !== undefined && currentRole !== "guest";
  }
  return Array.isArray(roles) && roles.includes(currentRole);
}

// Development-only validation: detect duplicate literal route paths.
if (import.meta.env?.DEV) {
  const _seen = new Map();
  for (const _r of ALL_ROUTES) {
    if (_seen.has(_r.path)) {
      console.error(
        `[navigation] Duplicate route path detected: "${_r.path}" — keys: "${_seen.get(_r.path)}" and "${_r.key}"`
      );
    } else {
      _seen.set(_r.path, _r.key);
    }
  }
}