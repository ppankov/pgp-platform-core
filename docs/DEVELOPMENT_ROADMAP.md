# PGP Core — Development Roadmap

## Phase 1 — Architecture Foundation (Current)

**Status**: Implemented

- ✅ Folder structure
- ✅ AdminLayout + sidebar (collapsible groups) + topbar (org switcher, env indicator, role indicator, search, notifications, user menu)
- ✅ Navigation tree with all expanded groups (~60 routes)
- ✅ i18n scaffold: `t()`, 4 locales (en active, bg/de/es prepared)
- ✅ ~60 module pages as structural placeholders via `PlaceholderModule`
- ✅ Dashboard — read-only overview
- ✅ 17 Core entity schemas (full JSON, RLS documented)
- ✅ 15 PGP Architecture Intelligence entity schemas
- ✅ `solution_architect` role integrated
- ✅ 25 technical documents
- ✅ Platform implementation rule documented
- ✅ Router wiring (auth scaffold preserved)

## Phase 2 — Authorization & Lifecycle

**Status**: Deferred

- Backend authorization functions for all mutation endpoints
- Application install/enable/disable/update flows (with dependency validation)
- Connector connection flows (OAuth/shared/app_user)
- AI Center routing & model registry
- Storage bucket & backup flows
- Communications channel configuration
- Search index management
- API key issuance & scoping
- Event Bus dispatch runtime + webhook delivery
- Org switcher backed by real memberships
- Audit event emission on every mutating action
- Service configuration test/connection flows

## Phase 3 — Runtime & Builders

**Status**: Deferred

- Plugin runtime, feature flag evaluation engine
- Monitoring ingestion & log streaming
- Theme/language editor UIs
- Developer Console builder tools (Plugin/Connector/Application Builder, Schema Designer, API Explorer, Migration Manager)
- Import connector ingestion (for Architecture Intelligence)
- Q&A assistant (Core AI Center) with citation contract
- Benchmark engine

## Phase 4 — Reporting & Knowledge

**Status**: Deferred

- Report generation runtime + PDF export
- Knowledge-base linking engine
- Report delivery via Core Communications
- Theme/language editor UIs
- Reference-architecture library

## Phase 5 — Business Applications

**Status**: Deferred

- MyFeed, DocFlowTools, QuickReceipt, CreatorHub, CRM, HelpDesk, Wiki, Marketplace
- Each application installed independently via the application lifecycle
- Marketplace publishing for third-party applications
- Consultant/enterprise multi-tenant workflows
- Scheduled/recurring audits (Architecture Intelligence)

## Out of Scope (Permanent)

- Arbitrary code execution, browser terminal, unsafe DB editors
- Modification of customer projects by PGP Architecture Intelligence
- Direct provider dependencies in the Core (always via connectors)
- Fake functionality or buttons that claim to work without a backend