# PGP Core — Platform Vision

## Purpose

PGP Core is an **operating system for SaaS applications**, not a single application. It provides a reusable foundation upon which multiple independent business applications are built, installed, and operated.

## Applications on PGP Core

The following applications are designed to run on top of PGP Core:

- **MyFeed** — social feed / content stream
- **DocFlowTools** — document workflow and automation
- **QuickReceipt** — receipt generation and management
- **CreatorHub** — creator tooling and monetization
- **CRM** — customer relationship management
- **HelpDesk** — support ticket management
- **Wiki** — knowledge base and documentation
- **Marketplace** — multi-vendor commerce
- **PGP Architecture Intelligence** — software architecture analysis and auditing

Each application is an installable unit that consumes Core services (auth, organizations, permissions, connectors, AI Center, Storage, Communications, Audit, Events) rather than reimplementing them.

## Core Principles

1. **Core first, applications second.** The Core is built and stabilized before any business application.
2. **No business logic inside the Core.** All business behavior lives in installed applications, plugins, and connectors.
3. **Every external provider is accessed through a connector or adapter.** No direct provider dependencies in the Core.
4. **Every optional feature is installable as a module or plugin.** The Core ships only essential infrastructure.
5. **Every protected action has explicit backend authorization.** Frontend visibility is not security.
6. **No service-level privileges unless strictly required.** `base44.asServiceRole` is reserved for documented platform operations only.
7. **No "fetch all then filter."** Queries include org/role filters at the query level.
8. **All entities receive appropriate Row Level Security rules when created.**
9. **Avoid direct provider dependency where an abstraction can be used.**
10. **Keep modules isolated and reusable.**
11. **Do not modify generated authentication infrastructure unnecessarily.**
12. **Do not create fake functionality.** No buttons that claim to work when no backend exists.

## Platform Implementation Rule

Every new feature is evaluated before implementation in this strict order:

1. **Configuration** — Can this be solved by configuration?
2. **Plugin** — If not, can it be solved by a plugin?
3. **Connector** — If not, can it be solved by a connector?
4. **Installable Application** — If not, can it be solved by an installable application?
5. **Core modification** — Only if none of the above applies should the Core be modified.

> The Core must remain as stable and as small as possible throughout the lifetime of the platform.

## Long-Term Goal

PGP Core should become a professional, enterprise-grade platform foundation that enables software teams, companies, and consultants to build and operate multiple SaaS applications on shared infrastructure — with consistent security, auditability, and extensibility.