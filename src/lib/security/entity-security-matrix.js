// ═══════════════════════════════════════════════════════════════════════
// PGP Core — Phase 9 — Entity Security Matrix (Declarative Registry)
// ═══════════════════════════════════════════════════════════════════════
// WAVE I artifact. This is a DECLARATIVE registry for documentation,
// Security Center posture, and verification-coverage tracking.
//
// It is NOT itself a security boundary. Real enforcement comes from:
//   1. Base44 datastore RLS rules (when present and verifiable)
//   2. Backend function authorization (the authoritative boundary today)
//   3. Frontend UI hiding (NEVER a security boundary — hint only)
//
// Per Decision A2: PGP Core application roles (Developer, Solution
// Architect, Core Developer, Admin, Super Admin) are an
// application/function-level capability model. Base44 datastore RLS can
// only test the built-in auth roles "admin" and "user". This gap is
// documented per entity as a datastore-role limitation. Application roles
// are NOT accepted from request body, query, localStorage, or client
// state.
//
// Per Decision B2: OrganizationMember is the single source of truth for
// tenant membership. user.organizationId is NOT added. Org isolation is
// function-enforced (re-fetch OrganizationMember + compare
// resource.organizationId). Datastore org RLS is NOT claimed because
// RLS cannot join OrganizationMember and users have no org field.
//
// Enforcement-layer values are EXACT — no generic "Protected" claim.

export const ENFORCEMENT_LAYERS = {
  DATASTORE: "Datastore Enforced",
  FUNCTION: "Function Enforced",
  DATASTORE_AND_FUNCTION: "Datastore + Function Enforced",
  PLATFORM_DEFAULT: "Platform Default",
  CODE_INSPECTION: "Code Inspection Only",
  RUNTIME_VERIFIED: "Runtime Verified",
  UNVERIFIED: "Unverified",
  DEFERRED: "Deferred",
};

export const SECURITY_CATEGORIES = {
  A: "GLOBAL_CATALOG",
  B: "ORGANIZATION_CONFIGURATION",
  C: "RUNTIME_MUTABLE",
  D: "RELEASED_IMMUTABLE",
  E: "APPEND_ONLY_AUDIT",
  F: "SENSITIVE_REFERENCE",
  G: "HISTORICAL_RUNTIME",
  H: "PLATFORM_TRANSPORT",
};

export const VERIFICATION_STATUS = {
  RUNTIME_VERIFIED: "Runtime Verified",
  CODE_INSPECTION: "Code Inspection Only",
  UNVERIFIED: "Unverified",
  DEFERRED: "Deferred",
};

// Datastore role boundary — the only roles Base44 RLS can test.
// Documented honestly; application roles are function-layer only.
export const DATASTORE_ROLE_BOUNDARY = {
  supportedByDatastoreRLS: ["admin", "user"],
  applicationRolesNotDatastoreEnforceable: [
    "super_admin", "core_developer", "solution_architect", "developer",
    "auditor", "support",
  ],
  note:
    "user_condition in RLS supports equality on user.role only (admin|user). " +
    "PGP Core application roles are resolved server-side in functions and " +
    "are never accepted from client input. No trusted server-side identity " +
    "source for Core Developer / Super Admin exists today (Decision A2).",
};

// Tenant membership source of truth (Decision B2).
export const TENANT_MODEL = {
  sourceOfTruth: "OrganizationMember",
  userOrganizationIdAdded: false,
  organizationIsolationEnforcement: "Function Enforced",
  mechanism:
    "Each organization-scoped function re-fetches OrganizationMember via " +
    "service role, confirms active membership, re-fetches the target " +
    "resource, and compares resource.organizationId to the authorized org. " +
    "Datastore org RLS is NOT claimed (RLS cannot join OrganizationMember " +
    "and users have no org field).",
};

// ───────────────────────────────────────────────────────────────────────
// Entity inventory. One entry per Core entity (Phases 1–8) + a grouped
// entry for the Architecture Intelligence audit entities.
// ───────────────────────────────────────────────────────────────────────

export const ENTITY_SECURITY_MATRIX = [
  // ── Phase 1 — Identity, Tenancy, Catalog, Platform Admin ──────────────
  {
    entity: "Organization",
    phase: 1,
    scopeModel: "platform (root tenant boundary)",
    category: "A",
    directReadPolicy: "function-preferred (datastore RLS candidate: admin-only read)",
    directCreatePolicy: "denied — function-only (super_admin)",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only (super_admin)",
    functionMutationOnly: true,
    organizationIsolation: "n/a — root boundary",
    sensitiveFields: ["settings (non-sensitive only)"],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "No RLS rule present today; prose description only.",
      "Application 'super_admin' has no trusted identity source (Decision A2) — datastore can only enforce built-in admin.",
    ],
  },
  {
    entity: "OrganizationMember",
    phase: 1,
    scopeModel: "organization",
    category: "B",
    directReadPolicy: "function-preferred (org admin + self)",
    directCreatePolicy: "denied — function-only (admin/super_admin)",
    directUpdatePolicy: "denied — function-only (org admin)",
    directDeletePolicy: "denied — function-only (admin/super_admin)",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced (membership = self or org admin)",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "SOURCE OF TRUTH for tenant membership (Decision B2).",
      "No datastore RLS; direct reads must be denied in Wave II and routed through functions.",
    ],
  },
  {
    entity: "PlatformRole",
    phase: 1,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (platform catalog)",
    directCreatePolicy: "denied — function-only (super_admin)",
    directUpdatePolicy: "denied (system roles immutable)",
    directDeletePolicy: "denied (system roles immutable)",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "is_system=true roles never deleted/updated",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "Immutability is function-layer only; no datastore conditional rule.",
    ],
  },
  {
    entity: "Permission",
    phase: 1,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (platform catalog)",
    directCreatePolicy: "denied — function-only (super_admin)",
    directUpdatePolicy: "denied — function-only (super_admin)",
    directDeletePolicy: "denied — function-only (super_admin)",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [],
  },
  {
    entity: "RolePermission",
    phase: 1,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (admin/super_admin)",
    directCreatePolicy: "denied — function-only (super_admin)",
    directUpdatePolicy: "denied — function-only (super_admin)",
    directDeletePolicy: "denied — function-only (super_admin)",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [],
  },
  {
    entity: "ApplicationDefinition",
    phase: 1,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (all authenticated)",
    directCreatePolicy: "denied — function-only (super_admin)",
    directUpdatePolicy: "denied — function-only (super_admin)",
    directDeletePolicy: "denied — function-only (super_admin)",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "manifest is declarative; secret-looking keys must be rejected (Wave II input bound).",
    ],
  },
  {
    entity: "ApplicationInstallation",
    phase: 1,
    scopeModel: "organization",
    category: "B",
    directReadPolicy: "denied — function-only (org members)",
    directCreatePolicy: "denied — function-only (admin/super_admin)",
    directUpdatePolicy: "denied — function-only (org admin)",
    directDeletePolicy: "denied — function-only (org admin)",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced (OrganizationMember re-fetch)",
    sensitiveFields: ["config (non-sensitive only)"],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "No datastore org RLS (RLS cannot join OrganizationMember).",
    ],
  },
  {
    entity: "ServiceConfiguration",
    phase: 1,
    scopeModel: "organization",
    category: "F",
    directReadPolicy: "denied — function-only (org admin/developer)",
    directCreatePolicy: "denied — function-only",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced (OrganizationMember re-fetch)",
    sensitiveFields: ["config (secrets referenced by name, never inline)"],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "Secrets must never be stored inline; recursive secret-key rejection applies.",
    ],
  },
  {
    entity: "FeatureFlag",
    phase: 1,
    scopeModel: "platform or organization",
    category: "B",
    directReadPolicy: "function-preferred (org-scoped for org flags)",
    directCreatePolicy: "denied — function-only",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced for org flags",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [],
  },
  {
    entity: "SystemSetting",
    phase: 1,
    scopeModel: "platform",
    category: "F",
    directReadPolicy: "denied — function-only (is_sensitive values redacted for non-elevated)",
    directCreatePolicy: "denied — function-only (super_admin/core_developer)",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: ["value (when is_sensitive=true)"],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "Field-level redaction not supported by datastore FLS at app level — function must redact.",
    ],
  },
  {
    entity: "EventTopic",
    phase: 1,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (catalog)",
    directCreatePolicy: "denied — function-only",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
    knownLimitations: ["EventTopic not deeply audited in Wave I; classify in Wave II."],
  },

  // ── Phase 2 — Lifecycle Engine ───────────────────────────────────────
  {
    entity: "LifecycleDefinition",
    phase: 2,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (platform catalog)",
    directCreatePolicy: "denied — function-only (core_developer/admin/super_admin)",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "VIOLATION TODAY: LifecycleDefinitionForm does direct create/update; LifecycleDefinitionsPage does direct delete. Wave II/III must remove.",
    ],
  },
  {
    entity: "LifecycleState",
    phase: 2,
    scopeModel: "platform (child of LifecycleDefinition)",
    category: "A",
    directReadPolicy: "read allowed",
    directCreatePolicy: "denied — function-only",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "VIOLATION TODAY: LifecycleStatesPage does direct delete; LifecycleStateForm likely does direct create/update.",
    ],
  },
  {
    entity: "LifecycleTransition",
    phase: 2,
    scopeModel: "platform (child of LifecycleDefinition)",
    category: "A",
    directReadPolicy: "read allowed",
    directCreatePolicy: "denied — function-only",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "VIOLATION TODAY: LifecycleTransitionsPage does direct delete; form likely does direct create/update.",
    ],
  },
  {
    entity: "LifecycleBinding",
    phase: 2,
    scopeModel: "platform (opaque resource binding)",
    category: "C",
    directReadPolicy: "denied — function-only (developer/solution_architect)",
    directCreatePolicy: "denied — function-only (runtime / core_developer/admin/super_admin via attachLifecycle)",
    directUpdatePolicy: "denied — function-only (runtime service role)",
    directDeletePolicy: "denied",
    functionMutationOnly: true,
    organizationIsolation: "n/a (opaque resourceType/resourceId)",
    sensitiveFields: [],
    immutableConditions: "only currentLifecycleStateId is mutated by the runtime",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: ["Direct status mutation must be denied in Wave II."],
  },
  {
    entity: "LifecycleApprovalRequest",
    phase: 2,
    scopeModel: "platform",
    category: "C",
    directReadPolicy: "denied — function-only (admin/core_developer/solution_architect)",
    directCreatePolicy: "denied — function-only (runtime service role)",
    directUpdatePolicy: "denied — function-only (decideApproval; admin/core_developer/super_admin)",
    directDeletePolicy: "denied (historical after decision)",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "status immutable after approved/rejected",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "Post-decision immutability is function-layer only; no datastore conditional rule.",
    ],
  },
  {
    entity: "LifecycleExecutionEvent",
    phase: 2,
    scopeModel: "platform (audit)",
    category: "E",
    directReadPolicy: "denied — function-only (developer/auditor/admin/core_developer)",
    directCreatePolicy: "denied for clients — runtime service role only",
    directUpdatePolicy: "denied (append-only)",
    directDeletePolicy: "denied (append-only)",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: ["metadata (safe identifiers/status only; no payload/secrets)"],
    immutableConditions: "append-only",
    appendOnlyExpectation: true,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "Append-only is function-layer contract; no datastore update/delete prohibition.",
    ],
  },

  // ── Phase 3 — Event Bus ──────────────────────────────────────────────
  {
    entity: "PlatformEvent",
    phase: 3,
    scopeModel: "platform or organization (organizationId optional)",
    category: "E",
    directReadPolicy: "denied — function-only (developer+)",
    directCreatePolicy: "denied for clients — runtime service role only via publishEvent",
    directUpdatePolicy: "denied (status/processedAt only by a future processor service role)",
    directDeletePolicy: "denied (append-only)",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced when organizationId set",
    sensitiveFields: ["payload (must be identifier/status-only; recursive secret rejection)"],
    immutableConditions: "append-only",
    appendOnlyExpectation: true,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "publishEvent currently accepts actorId/organizationId from request body — must derive from auth in Wave II.",
      "No datastore append-only protection.",
    ],
  },
  {
    entity: "EventSubscription",
    phase: 3,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "denied — function-only (developer+)",
    directCreatePolicy: "denied — function-only (admin/core_developer/super_admin)",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "n/a (platform service registry)",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [],
  },

  // ── Phase 4 — Delivery Runtime ───────────────────────────────────────
  {
    entity: "EventDelivery",
    phase: 4,
    scopeModel: "platform (delivery history)",
    category: "G",
    directReadPolicy: "denied — function-only (developer/solution_architect/core_developer/admin/super_admin)",
    directCreatePolicy: "denied for clients — runtime service role only via dispatchEvent",
    directUpdatePolicy: "denied for clients — runtime service role only via processEventDelivery",
    directDeletePolicy: "denied (historical)",
    functionMutationOnly: true,
    organizationIsolation: "n/a (platform delivery)",
    sensitiveFields: ["lastError (safe bounded text only)"],
    immutableConditions: "historical; never deleted by runtime",
    appendOnlyExpectation: true,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "Uniqueness (eventId,subscriptionId) is function-layer only; no datastore unique constraint.",
    ],
  },

  // ── Phase 5 — Plugin Engine ──────────────────────────────────────────
  {
    entity: "PluginDefinition",
    phase: 5,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (platform catalog)",
    directCreatePolicy: "denied — function-only (core_developer/super_admin)",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "key immutable after creation",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [],
  },
  {
    entity: "PluginVersion",
    phase: 5,
    scopeModel: "platform",
    category: "D",
    directReadPolicy: "read allowed (catalog)",
    directCreatePolicy: "denied — function-only (core_developer/super_admin via registerPluginVersion; draft only)",
    directUpdatePolicy: "denied — function-only; RELEASED is immutable",
    directDeletePolicy: "denied (immutable history)",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: ["manifest (declarative; recursive secret rejection)"],
    immutableConditions: "releaseStatus=released → content immutable; re-release forbidden",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "Released immutability is function-layer only; no datastore conditional rule. Wave II denies all direct update/delete.",
    ],
  },
  {
    entity: "PluginInstallation",
    phase: 5,
    scopeModel: "organization",
    category: "C",
    directReadPolicy: "denied — function-only (org members + developers)",
    directCreatePolicy: "denied — function-only (admin/super_admin via installPlugin)",
    directUpdatePolicy: "denied — function-only (enablePlugin/disablePlugin)",
    directDeletePolicy: "denied (uninstall is non-destructive)",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced (OrganizationMember re-fetch)",
    sensitiveFields: ["configuration (non-sensitive only)"],
    immutableConditions: "uninstalledAt preserved (non-destructive)",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "No datastore org RLS.",
    ],
  },

  // ── Phase 6 — Connector Engine ───────────────────────────────────────
  {
    entity: "ConnectorDefinition",
    phase: 6,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (platform catalog)",
    directCreatePolicy: "denied — function-only (core_developer/super_admin)",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "key immutable after creation",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [],
  },
  {
    entity: "ConnectorProvider",
    phase: 6,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (catalog)",
    directCreatePolicy: "denied — function-only (core_developer/super_admin)",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: ["credentialRequirements (declarative metadata only, never values)"],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [],
  },
  {
    entity: "ConnectorConnection",
    phase: 6,
    scopeModel: "organization",
    category: "F",
    directReadPolicy: "denied — function-only (credentialRef hidden; reveal per frozen Phase 6 contract)",
    directCreatePolicy: "denied — function-only (admin/super_admin via createConnectorConnection)",
    directUpdatePolicy: "denied — function-only (activate/disable/disconnect)",
    directDeletePolicy: "denied (non-destructive)",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced (OrganizationMember re-fetch)",
    sensitiveFields: ["credentialRef (opaque; never in list/Event Bus/audit/logs)"],
    immutableConditions: "disconnect non-destructive",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "No field-level RLS at app level — function must strip credentialRef from all non-reveal reads.",
    ],
  },

  // ── Phase 7 — Workflow Engine ────────────────────────────────────────
  {
    entity: "WorkflowDefinition",
    phase: 7,
    scopeModel: "platform or organization",
    category: "A",
    directReadPolicy: "read allowed (catalog, scope-respecting)",
    directCreatePolicy: "denied — function-only (scope-permitted roles via registerWorkflowDefinition)",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced for organization scope",
    sensitiveFields: [],
    immutableConditions: "key immutable after creation",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [],
  },
  {
    entity: "WorkflowVersion",
    phase: 7,
    scopeModel: "platform or organization",
    category: "D",
    directReadPolicy: "read allowed (catalog)",
    directCreatePolicy: "denied — function-only (registerWorkflowVersion; draft only)",
    directUpdatePolicy: "denied — function-only; RELEASED is immutable",
    directDeletePolicy: "denied (immutable history)",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced for organization scope",
    sensitiveFields: ["graph (declarative; recursive secret/exec rejection)"],
    immutableConditions: "releaseStatus=released → immutable; re-release forbidden",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "Released immutability function-layer only; Wave II denies all direct update/delete.",
    ],
  },
  {
    entity: "WorkflowInstance",
    phase: 7,
    scopeModel: "organization",
    category: "C",
    directReadPolicy: "denied — function-only (input/output redacted if secret-looking)",
    directCreatePolicy: "denied — function-only (startWorkflow)",
    directUpdatePolicy: "denied — function-only (complete/fail/cancel step)",
    directDeletePolicy: "denied (historical)",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced (OrganizationMember re-fetch)",
    sensitiveFields: ["input", "output (redacted on read)"],
    immutableConditions: "terminal instances historical",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "VIOLATION TODAY: WorkflowInstancesPage does direct WorkflowInstance.list() — cross-tenant, exposes raw input/output. Wave III must replace with sanitizing function.",
    ],
  },
  {
    entity: "WorkflowStepRun",
    phase: 7,
    scopeModel: "organization",
    category: "G",
    directReadPolicy: "denied — function-only",
    directCreatePolicy: "denied for clients — runtime only",
    directUpdatePolicy: "denied — function-only (runtime)",
    directDeletePolicy: "denied (historical after terminal)",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced via parent instance",
    sensitiveFields: ["input", "output (redacted on read)"],
    immutableConditions: "completed/failed runs historical",
    appendOnlyExpectation: true,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [],
  },
  {
    entity: "WorkflowExecutionEvent",
    phase: 7,
    scopeModel: "platform or organization (audit)",
    category: "E",
    directReadPolicy: "denied — function-only (developer/auditor/admin/core_developer/solution_architect)",
    directCreatePolicy: "denied for clients — runtime service role only",
    directUpdatePolicy: "denied (append-only)",
    directDeletePolicy: "denied (append-only)",
    functionMutationOnly: true,
    organizationIsolation: "n/a (audit)",
    sensitiveFields: ["metadata (safe identifiers/status only)"],
    immutableConditions: "append-only",
    appendOnlyExpectation: true,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: ["Append-only function-layer only."],
  },

  // ── Phase 8 — Scheduler and Background Job Runtime ───────────────────
  {
    entity: "JobDefinition",
    phase: 8,
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (catalog; payload redacted for developer/solution_architect)",
    directCreatePolicy: "denied — function-only (core_developer/super_admin via registerJobDefinition)",
    directUpdatePolicy: "denied (catalog; active flag is function-managed)",
    directDeletePolicy: "denied (catalog)",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: ["payloadSchema", "resultSchema (recursive secret rejection)"],
    immutableConditions: "key immutable after creation",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "VIOLATION TODAY: JobDefinitionsPage does direct list (read); acceptable for catalog but redaction must be function-side.",
    ],
  },
  {
    entity: "JobSchedule",
    phase: 8,
    scopeModel: "platform or organization",
    category: "C",
    directReadPolicy: "denied — function-only (payload redacted for developer/solution_architect)",
    directCreatePolicy: "denied — function-only (createJobSchedule)",
    directUpdatePolicy: "denied — function-only (pause/resume/cancel)",
    directDeletePolicy: "denied (non-destructive cancel)",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced for organization scope",
    sensitiveFields: ["payload (redacted)"],
    immutableConditions: "cancel non-destructive",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: ["No datastore org RLS."],
  },
  {
    entity: "BackgroundJob",
    phase: 8,
    scopeModel: "platform or organization",
    category: "C",
    directReadPolicy: "denied — function-only (getBackgroundJob; payload/result redacted)",
    directCreatePolicy: "denied — function-only (scheduler or enqueueBackgroundJob)",
    directUpdatePolicy: "denied for clients — worker runtime service role only",
    directDeletePolicy: "denied (terminal jobs preserved)",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced for organization scope",
    sensitiveFields: ["payload", "result (redacted)", "lastError (safe bounded text)"],
    immutableConditions: "terminal jobs never deleted by runtime",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: [
      "Lease/dedup are function-logic-only (at-least-once); no datastore atomic claim.",
    ],
  },
  {
    entity: "JobAttempt",
    phase: 8,
    scopeModel: "platform or organization (historical)",
    category: "G",
    directReadPolicy: "denied — function-only (developer/solution_architect/core_developer/admin/super_admin)",
    directCreatePolicy: "denied for clients — worker runtime only",
    directUpdatePolicy: "denied — function-only (worker runtime)",
    directDeletePolicy: "denied (historical)",
    functionMutationOnly: true,
    organizationIsolation: "via parent job",
    sensitiveFields: ["lastError (safe bounded text)"],
    immutableConditions: "abandoned attempts preserved",
    appendOnlyExpectation: true,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: ["No payload/result stored on attempts (by contract)."],
  },
  {
    entity: "JobExecutionEvent",
    phase: 8,
    scopeModel: "platform or organization (audit)",
    category: "E",
    directReadPolicy: "denied — function-only (developer/auditor/solution_architect/core_developer/admin)",
    directCreatePolicy: "denied for clients — runtime service role only",
    directUpdatePolicy: "denied (append-only)",
    directDeletePolicy: "denied (append-only)",
    functionMutationOnly: true,
    organizationIsolation: "n/a (audit)",
    sensitiveFields: ["metadata (safe identifiers/status only)"],
    immutableConditions: "append-only",
    appendOnlyExpectation: true,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.CODE_INSPECTION,
    knownLimitations: ["Append-only function-layer only."],
  },

  // ── Architecture Intelligence (audit) entities — grouped ──────────────
  {
    entity: "AuditProfileDefinition",
    phase: "AI",
    scopeModel: "platform",
    category: "A",
    directReadPolicy: "read allowed (catalog)",
    directCreatePolicy: "denied — function-only",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "n/a",
    sensitiveFields: [],
    immutableConditions: "none",
    appendOnlyExpectation: false,
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
    knownLimitations: ["Detailed classification deferred; grouped audit module."],
  },
  {
    entity: "AuditEntities (grouped: AuditCategoryDefinition, AuditRuleDefinition, AuditProject, AuditProjectSource, AuditRun, AuditRuleEvaluation, AuditCategoryScore, AuditFinding, AuditReport, AuditBenchmark, AuditBenchmarkComparison, AuditKnowledgeArticle, AuditAssistantThread, AuditAssistantMessage)",
    phase: "AI",
    scopeModel: "mixed platform/organization",
    category: "C/G",
    directReadPolicy: "function-preferred (scope-respecting)",
    directCreatePolicy: "denied — function-only",
    directUpdatePolicy: "denied — function-only",
    directDeletePolicy: "denied — function-only",
    functionMutationOnly: true,
    organizationIsolation: "function-enforced for org-scoped members",
    sensitiveFields: ["AuditFinding/AuditReport content (evaluative, non-secret)"],
    immutableConditions: "AuditRun/evaluations historical",
    appendOnlyExpectation: "AuditRun/AuditRuleEvaluation/AuditFinding — append-style historical",
    enforcementLayer: ENFORCEMENT_LAYERS.FUNCTION,
    verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
    knownLimitations: [
      "15 audit entities grouped for Wave I; per-entity detailed classification and sensitive-field audit deferred to a later hardening pass.",
    ],
  },
];

// ───────────────────────────────────────────────────────────────────────
// Aggregates for Security Center / dashboard (registry-derived posture,
// NOT runtime attack telemetry).
// ───────────────────────────────────────────────────────────────────────

export function getMatrixCounts() {
  const total = ENTITY_SECURITY_MATRIX.length;
  const functionOnly = ENTITY_SECURITY_MATRIX.filter(
    (e) => e.functionMutationOnly
  ).length;
  const orgIsolated = ENTITY_SECURITY_MATRIX.filter(
    (e) => e.organizationIsolation && e.organizationIsolation.startsWith("function")
  ).length;
  const immutable = ENTITY_SECURITY_MATRIX.filter(
    (e) =>
      e.immutableConditions &&
      (e.immutableConditions.includes("released") ||
        e.immutableConditions.includes("immutable") ||
        e.immutableConditions.includes("terminal") ||
        e.immutableConditions.includes("non-destructive") ||
        e.immutableConditions.includes("post-decision"))
  ).length;
  const appendOnly = ENTITY_SECURITY_MATRIX.filter(
    (e) => e.appendOnlyExpectation === true
  ).length;
  const sensitiveRead = ENTITY_SECURITY_MATRIX.filter(
    (e) =>
      e.category === "F" ||
      (e.sensitiveFields && e.sensitiveFields.length > 0 &&
        e.sensitiveFields.some((f) => /credentialRef|input|output|payload|result|value/i.test(f)))
  ).length;
  const unverified = ENTITY_SECURITY_MATRIX.filter(
    (e) => e.verificationStatus === VERIFICATION_STATUS.UNVERIFIED
  ).length;
  const deferred = ENTITY_SECURITY_MATRIX.filter(
    (e) => e.verificationStatus === VERIFICATION_STATUS.DEFERRED
  ).length;
  return {
    inventoriedEntities: total,
    functionOnlyMutationEntities: functionOnly,
    organizationIsolatedEntities: orgIsolated,
    immutableEntities: immutable,
    appendOnlyEntities: appendOnly,
    sensitiveFunctionReadEntities: sensitiveRead,
    unverifiedControls: unverified,
    deferredControls: deferred,
  };
}

// Direct-SDK violation inventory found in Wave I (Wave III removes them).
export const DIRECT_SDK_VIOLATIONS_WAVE_I = [
  {
    file: "src/pages/lifecycle/LifecycleDefinitionsPage.jsx",
    entity: "LifecycleDefinition",
    operations: ["entities.LifecycleDefinition.delete(id)"],
    severity: "write violation",
  },
  {
    file: "src/components/lifecycle/LifecycleDefinitionForm.jsx",
    entity: "LifecycleDefinition",
    operations: ["entities.LifecycleDefinition.create(payload)", "entities.LifecycleDefinition.update(id,payload)"],
    severity: "write violation",
  },
  {
    file: "src/pages/lifecycle/LifecycleStatesPage.jsx",
    entity: "LifecycleState",
    operations: ["entities.LifecycleState.delete(id)"],
    severity: "write violation",
  },
  {
    file: "src/pages/lifecycle/LifecycleTransitionsPage.jsx",
    entity: "LifecycleTransition",
    operations: ["entities.LifecycleTransition.delete(id)"],
    severity: "write violation",
  },
  {
    file: "src/pages/workflows/WorkflowInstancesPage.jsx",
    entity: "WorkflowInstance",
    operations: ["entities.WorkflowInstance.list()"],
    severity: "sensitive read violation (cross-tenant, raw input/output)",
  },
  {
    file: "src/components/lifecycle/LifecycleStateForm.jsx",
    entity: "LifecycleState",
    operations: ["likely direct create/update (pattern match)"],
    severity: "write violation (to confirm in Wave III)",
  },
  {
    file: "src/components/lifecycle/LifecycleTransitionForm.jsx",
    entity: "LifecycleTransition",
    operations: ["likely direct create/update (pattern match)"],
    severity: "write violation (to confirm in Wave III)",
  },
];

// Frontend direct reads that are acceptable as catalog reads but should be
// confirmed function-side for redaction/scope in Wave III.
export const DIRECT_SDK_READS_REVIEW = [
  { file: "src/pages/plugins/PluginDetailPage.jsx", entity: "Organization", op: "list()" },
  { file: "src/pages/connectors/OrganizationConnectionsPage.jsx", entity: "Organization", op: "list()" },
  { file: "src/pages/plugins/InstalledPluginsPage.jsx", entity: "Organization", op: "list()" },
  { file: "src/pages/jobs/JobDefinitionsPage.jsx", entity: "JobDefinition", op: "list()" },
  { file: "src/pages/jobs/JobSchedulesPage.jsx", entity: "JobDefinition", op: "list()" },
  { file: "src/pages/jobs/JobQueuePage.jsx", entity: "JobDefinition", op: "list()" },
  { file: "src/pages/lifecycle/LifecycleStatesPage.jsx", entity: "LifecycleDefinition", op: "list()" },
  { file: "src/pages/lifecycle/LifecycleStatesPage.jsx", entity: "LifecycleState", op: "filter()" },
  { file: "src/pages/lifecycle/LifecycleTransitionsPage.jsx", entity: "LifecycleDefinition", op: "list()" },
  { file: "src/pages/lifecycle/LifecycleTransitionsPage.jsx", entity: "LifecycleState", op: "filter()" },
  { file: "src/pages/lifecycle/LifecycleTransitionsPage.jsx", entity: "LifecycleTransition", op: "filter()" },
];