// Centralized entity registry — Phase 1 metadata.
// Runtime entity discovery is not available in Phase 1.
// This registry is the single source of truth for entity counts
// until the backend exposes an entity catalog API in Phase 2.

export const CORE_ENTITIES = [
  "Organization",
  "OrganizationMember",
  "PlatformRole",
  "Permission",
  "RolePermission",
  "ApplicationDefinition",
  "ApplicationInstallation",
  "PluginDefinition",
  "PluginVersion",
  "PluginInstallation",
  "ConnectorDefinition",
  "ConnectorProvider",
  "ConnectorConnection",
  "ServiceConfiguration",
  "FeatureFlag",
  "AuditEvent",
  "SystemSetting",
  "EventTopic",
  "WorkflowDefinition",
  "WorkflowVersion",
  "WorkflowInstance",
  "WorkflowStepRun",
  "WorkflowExecutionEvent",
  "JobDefinition",
  "JobSchedule",
  "BackgroundJob",
  "JobAttempt",
  "JobExecutionEvent",
];

export const LIFECYCLE_ENTITIES = [
  "LifecycleDefinition",
  "LifecycleState",
  "LifecycleTransition",
  "LifecycleBinding",
  "LifecycleApprovalRequest",
  "LifecycleExecutionEvent",
];

export const EVENT_BUS_ENTITIES = [
  "PlatformEvent",
  "EventSubscription",
  "EventDelivery",
];

export const PLUGIN_ENGINE_ENTITIES = [
  "PluginDefinition",
  "PluginVersion",
  "PluginInstallation",
];

export const CONNECTOR_ENGINE_ENTITIES = [
  "ConnectorDefinition",
  "ConnectorProvider",
  "ConnectorConnection",
];

export const WORKFLOW_ENGINE_ENTITIES = [
  "WorkflowDefinition",
  "WorkflowVersion",
  "WorkflowInstance",
  "WorkflowStepRun",
  "WorkflowExecutionEvent",
];

export const JOB_ENGINE_ENTITIES = [
  "JobDefinition",
  "JobSchedule",
  "BackgroundJob",
  "JobAttempt",
  "JobExecutionEvent",
];

export const ARCHITECTURE_INTELLIGENCE_ENTITIES = [
  "AuditProfileDefinition",
  "AuditCategoryDefinition",
  "AuditRuleDefinition",
  "AuditProject",
  "AuditProjectSource",
  "AuditRun",
  "AuditRuleEvaluation",
  "AuditCategoryScore",
  "AuditFinding",
  "AuditReport",
  "AuditBenchmark",
  "AuditBenchmarkComparison",
  "AuditKnowledgeArticle",
  "AuditAssistantThread",
  "AuditAssistantMessage",
];