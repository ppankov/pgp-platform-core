# PGP Core — Module Dependency Model

## Overview

Every future module (application, plugin, connector) declares its dependencies, requirements, and compatibility via a `manifest` object. This enables safe installation, updates, and compatibility checks.

## Manifest Schema

```json
{
  "name": "doc_flow_tools",
  "version": "1.4.0",
  "min_platform_version": "1.0.0",
  "supported_platform_version": ">=1.0.0",
  "dependencies": [
    {
      "key": "knowledge_base",
      "version": ">=1.0.0",
      "required": true
    }
  ],
  "required_permissions": [
    "platform.storage.read",
    "platform.communications.send"
  ],
  "required_connectors": [
    {
      "provider_key": "google",
      "auth_mode": "oauth",
      "purpose": "document_export",
      "required": false
    }
  ],
  "required_services": [
    {
      "service_type": "storage",
      "purpose": "media_storage",
      "required": true
    }
  ]
}
```

## Fields

| Field | Description |
|---|---|
| `name` | Module name |
| `version` | Module version (semver) |
| `min_platform_version` | Minimum Core version required |
| `supported_platform_version` | Version range compatibility |
| `dependencies` | Other modules this module depends on |
| `required_permissions` | Permissions the module needs to function |
| `required_connectors` | Connector connections the module needs |
| `required_services` | Service configurations the module needs |

## Dependency Resolution

Before installation or enable (Phase 2+), the backend validates:

1. **Platform version**: `min_platform_version` <= current Core version
2. **Dependencies**: All required dependencies are installed and at sufficient version
3. **Permissions**: The installing org has the required permissions
4. **Connectors**: Required connector connections exist (or are marked optional)
5. **Services**: Required service configurations are active

If validation fails, the operation is blocked with a clear explanation of what's missing.

## Version Constraints

Uses semver notation:
- `>=1.0.0` — minimum version
- `>=1.0.0 <2.0.0` — version range
- `~1.4.0` — patch-level compatible
- `^1.4.0` — minor-level compatible

## Where Manifests Live

The `manifest` object is stored on:
- `ApplicationDefinition.manifest`
- `PluginDefinition.manifest`
- `ConnectorDefinition.manifest`

## Update Safety

When updating a module, the backend re-validates:
- New dependencies are satisfied
- New required connectors/services exist
- Platform version is still compatible
- No dependent modules would break

## Phase 1 Status

- Manifests are stored as metadata on definitions.
- No runtime validation engine.
- All enforcement deferred to Phase 2+.