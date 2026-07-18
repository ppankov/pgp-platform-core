# PGP Core — Role & Permission Model

## System Roles (9)

| Role | Scope | Branch | Intent |
|---|---|---|---|
| `super_admin` | Platform | Admin | Full platform control including system-critical config |
| `admin` | Platform | Admin | Organizations, users, memberships, roles, settings, licenses, platform ops |
| `solution_architect` | Platform | Architecture | Designs/approves architecture, module/connector/plugin design, documentation, standards — no automatic admin or developer rights |
| `developer` | Platform/Org | Developer | Plugins, connectors, API clients, webhooks, logs, debugging, dev config — no private user data |
| `core_developer` | Platform | Developer (elevated) | Core version, migrations, platform/plugin/connector APIs, system-critical config |
| `auditor` | Platform | Oversight | Read-only audit log, system logs, compliance views — no mutation |
| `support` | Org-scoped | Operations | Read-only user/org context for support — no secrets, no destructive actions |
| `user` | Org | End-user | Authorized org context + installed apps only |
| `guest` | None | Limited | No platform admin access; public/explicitly-shared resources only |

## Permission Branches

### Admin Branch
Manages: organizations, users, memberships, roles, settings, licenses, platform operations.

### Developer Branch
Manages: plugins, connectors, API clients, webhooks, logs, debugging tools, development configuration.

### Core Developer (Elevated Developer)
Additionally manages: core version, migrations, platform APIs, plugin API, connector API, system-critical configuration.

### Architecture Branch (Solution Architect)
Designs and approves: architecture, platform design, module design, connector design, plugin design, technical documentation, standards.

> **Critical**: Developer access does NOT automatically allow access to private user messages, personal files, or sensitive business data. That access requires explicit, separate permission grants.

## Capability Matrix

| Capability | super_admin | admin | solution_architect | developer | core_developer | auditor | support | user |
|---|---|---|---|---|---|---|---|---|
| Manage organizations | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage users & memberships | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage roles & permissions | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage licenses & settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Platform operations | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage plugins | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage connectors | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage API clients & webhooks | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View dev logs / debugging | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Core version & migrations | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Platform/plugin/connector API | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| System-critical configuration | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Architecture & documentation | ✅ (r) | ✅ (r) | ✅ (rw) | ✅ (r) | ✅ (r) | ✅ (r) | ❌ | ❌ |
| Module/connector/plugin design approval | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Standards management | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Read audit log | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Read private user data | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Access Rules

- Guests must not access platform administration.
- Users may access only their own authorized organization context.
- Organization admins may manage only their organization.
- Platform admins may manage platform-level resources according to explicit permissions.
- Audit records must be append-only for normal administrators.
- Only authorized roles may view logs containing technical or sensitive information.
- Secrets must never be returned through normal list APIs.

## Implementation Notes

- The built-in `User.role` field (admin/user) is the initial role carrier. The 9-role platform model is mapped onto this field, with `OrganizationMember.role` providing org-scoped role assignment.
- `ROLE_CAPABILITIES` in `src/lib/permissions.js` is a **frontend visibility hint only**. Real authorization is always backend-enforced.
- `PermissionGate` component wraps children and hides them when the current role lacks a capability — this is UX, not security.