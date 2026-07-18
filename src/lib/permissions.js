// Platform role definitions and capability map.
// NOTE: This is for FRONTEND VISIBILITY ONLY — real authorization is backend-enforced.
// Frontend hiding is never the security boundary.

export const PLATFORM_ROLES = [
  { key: "super_admin", labelKey: "role.super_admin", branch: "admin", scope: "platform" },
  { key: "admin", labelKey: "role.admin", branch: "admin", scope: "platform" },
  { key: "solution_architect", labelKey: "role.solution_architect", branch: "architecture", scope: "platform" },
  { key: "developer", labelKey: "role.developer", branch: "developer", scope: "platform" },
  { key: "core_developer", labelKey: "role.core_developer", branch: "developer", scope: "platform" },
  { key: "auditor", labelKey: "role.auditor", branch: "oversight", scope: "platform" },
  { key: "support", labelKey: "role.support", branch: "operations", scope: "organization" },
  { key: "user", labelKey: "role.user", branch: "end_user", scope: "organization" },
  { key: "guest", labelKey: "role.guest", branch: "limited", scope: "none" },
];

// Capability matrix: role -> set of capability keys (frontend hint only).
export const ROLE_CAPABILITIES = {
  super_admin: ["*"],
  admin: [
    "platform.dashboard.view", "platform.organizations.manage", "platform.users.manage",
    "platform.roles.manage", "platform.permissions.manage", "platform.applications.manage",
    "platform.feature_flags.manage", "platform.licenses.manage", "platform.themes.manage",
    "platform.languages.manage", "platform.system_settings.manage", "platform.admin_console.access",
    "platform.audit.read", "platform.monitoring.view", "platform.lifecycle.manage", "platform.eventbus.read", "platform.eventbus.dispatch", "platform.eventbus.process",
    "platform.plugins.read", "platform.plugins.install", "platform.connectors.read", "platform.connectors.connect", "platform.workflows.read", "platform.workflows.connect", "platform.jobs.read", "platform.jobs.connect",
  ],
  solution_architect: [
    "platform.dashboard.view", "platform.architecture.view",
    "platform.architecture.documentation.manage", "platform.architecture.standards.manage",
    "platform.module_design.approve", "platform.connector_design.approve",
    "platform.plugin_design.approve", "platform.lifecycle.read", "platform.eventbus.read", "platform.plugins.read", "platform.connectors.read", "platform.workflows.read", "platform.jobs.read",
  ],
  developer: [
    "platform.dashboard.view", "platform.plugins.read", "platform.connectors.read",
    "platform.services.configure", "platform.api_clients.manage", "platform.api_keys.manage",
    "platform.webhooks.manage", "platform.system_logs.read", "platform.monitoring.view",
    "platform.developer_console.access", "platform.feature_flags.manage",
    "platform.lifecycle.read", "platform.eventbus.read", "platform.workflows.read", "platform.jobs.read",
  ],
  core_developer: [
    "platform.dashboard.view", "platform.plugins.manage", "platform.connectors.manage", "platform.connectors.read",
    "platform.services.configure", "platform.api_clients.manage", "platform.api_keys.manage",
    "platform.webhooks.manage", "platform.system_logs.read", "platform.monitoring.view",
    "platform.developer_console.access", "platform.core.migrations.manage",
    "platform.core.version.manage", "platform.core.platform_api.manage",
    "platform.system_settings.manage", "platform.feature_flags.manage",
    "platform.lifecycle.manage", "platform.eventbus.read", "platform.eventbus.dispatch", "platform.eventbus.process",
    "platform.plugins.read", "platform.plugins.release", "platform.workflows.manage", "platform.workflows.read", "platform.jobs.manage", "platform.jobs.read",
  ],
  auditor: [
    "platform.dashboard.view", "platform.audit.read", "platform.system_logs.read",
    "platform.monitoring.view",
  ],
  support: ["platform.dashboard.view"],
  user: ["platform.dashboard.view"],
  guest: [],
};

export function hasCapability(role, capability) {
  const caps = ROLE_CAPABILITIES[role] || [];
  if (caps.includes("*")) return true;
  return caps.includes(capability);
}