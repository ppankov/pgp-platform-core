# PGP Core — Core Architecture

## Overview

PGP Core is structured in layers, each with a clear responsibility and strict isolation boundaries.

## Layers

### 1. Identity & Tenancy Layer
- Organization (root tenant)
- OrganizationMember (user ↔ org membership)
- PlatformRole, Permission, RolePermission

### 2. Application Lifecycle Layer
- ApplicationDefinition (catalog)
- ApplicationInstallation (org-scoped install records)
- Marketplace, installed apps, updates, dependencies, enable/disable, version management

### 3. Extensibility Layer
- PluginDefinition / PluginInstallation
- ConnectorDefinition / ConnectorProvider / ConnectorConnection (3-layer connector model)
- ServiceConfiguration (abstracted service config)

### 4. Operations Layer
- Monitoring (system health, performance, errors, queues, scheduler, workers, jobs, platform status)
- System Logs
- AuditEvent (append-only audit trail)
- Notifications

### 5. Configuration Layer
- AI Center (providers, models, routing, prompt library, agents, usage, costs, logs)
- Storage (providers, buckets, media, backups, restore, replication, health)
- Communications (channels, mailboxes, templates, delivery log)
- Search (search, index management, crawler, ranking, AI search, rebuild)
- API Clients, API Keys, Webhooks
- Feature Flags, Licenses

### 6. Experience Layer
- Themes
- Languages (Bulgarian, English, German, Spanish)

### 7. Administration Layer
- System Settings
- Admin Console
- Developer Console (plugin builder, connector builder, app builder, schema designer, API explorer, migration manager, debug console, dev logs)
- Documentation

### 8. Event Bus (Reserved)
- EventTopic catalog
- Future internal event dispatch system
- Producers → Bus → Consumers (webhooks, workflows, plugins, audit)

## Module Isolation Rules

- Every module declares its dependencies, required connectors, required services, required permissions, and supported platform version via a `manifest` object.
- Modules never directly access another module's private data.
- Cross-module communication uses the Event Bus (future) or explicit API contracts.
- No module may execute arbitrary code outside its declared entrypoint type.

## Frontend Architecture

- React + Tailwind CSS on Vite
- `AdminLayout` provides the shell: sidebar + topbar + `<Outlet/>`
- `lib/navigation.js` is the single source of truth for all navigation entries
- `lib/i18n/` provides the translation system with 4 locale files
- `PlaceholderModule` renders clearly-labelled structural placeholders for unimplemented modules
- `PermissionGate` controls frontend visibility (NOT a security boundary)

## Backend Architecture

- Base44 entities with full JSON schemas and documented RLS
- Backend functions (future phases) for all mutation endpoints with explicit authorization
- No business logic in the Core — only infrastructure and platform services
- API-first design: every capability accessible via REST (documented in `API_DESIGN_GUIDE.md`)