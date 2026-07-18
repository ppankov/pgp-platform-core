# PGP Core — API Design Guide

## Overview

PGP Core is designed API-first. Every platform capability is accessible via REST APIs. Future GraphQL support may be added as a facade over the same resources.

## Principles

1. **Resource-oriented**: Resources map 1:1 to entities where practical.
2. **Standard envelope**: All responses use `{ data, meta, error }`.
3. **Auth via bearer token or API key**: Platform session tokens or scoped API keys.
4. **Scoped API keys**: API keys are scoped to a permission subset — never full admin by default.
5. **Filtering at query level**: List endpoints support filtering, pagination, and field projection. No "fetch all then filter."
6. **Server-side redaction**: Sensitive fields are redacted server-side, never client-side.
7. **REST first, GraphQL later**: GraphQL will be a facade over REST resources, not a separate data layer.

## Resource Naming

Resources use plural, kebab-case nouns:
- `GET /api/organizations`
- `GET /api/organizations/:id`
- `POST /api/organizations`
- `PATCH /api/organizations/:id`
- `DELETE /api/organizations/:id`

Nested resources:
- `GET /api/organizations/:id/members`
- `GET /api/applications/:id/installations`

## Response Envelope

### Success
```json
{
  "data": { ... } | [ ... ],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 120,
    "has_more": true
  }
}
```

### Error
```json
{
  "error": {
    "code": "forbidden",
    "message": "You do not have permission to manage organizations",
    "details": { ... }
  }
}
```

## Pagination

- `page` (default 1) and `per_page` (default 50, max 200)
- `meta.has_more` indicates more pages exist
- Cursor-based pagination available for large datasets (future)

## Authentication

### Bearer Token (Platform Session)
```
Authorization: Bearer <platform_session_token>
```
Used by the web frontend. Scopes are derived from the user's role and org membership.

### API Key
```
X-API-Key: <scoped_api_key>
```
Used by external integrations. Scoped to a permission subset defined at key creation. Never full admin by default.

## Scoping

- Org-scoped endpoints require an active organization context (via header `X-Organization-Id` or the user's active membership).
- Platform-level endpoints require platform-level permissions.
- API keys declare their scope at creation; the backend enforces it on every request.

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `bad_request` | 400 | Malformed request |
| `unauthorized` | 401 | No valid auth |
| `forbidden` | 403 | Auth valid but insufficient permissions |
| `not_found` | 404 | Resource not found |
| `conflict` | 409 | Version conflict or duplicate |
| `validation_error` | 422 | Schema validation failed |
| `rate_limited` | 429 | Too many requests |
| `internal_error` | 500 | Server error |

## Redaction

- `SystemSetting.value` with `is_sensitive=true` → redacted for non-elevated roles
- `ConnectorConnection.token_ref` → never returned to non-admin/developer roles
- `ServiceConfiguration.config` → secrets stripped, only non-sensitive parameters returned
- `AuditEvent.metadata` → sensitive fields redacted based on role

## Versioning

- API versioning via URL prefix: `/api/v1/...`
- Breaking changes require a new version. Non-breaking changes are backward-compatible.

## Future: GraphQL

GraphQL will be added as a facade:
- Same resources, same authorization, same redaction
- Enables field selection and nested queries
- Does not replace REST — both coexist

## Phase 1 Status

- API design conventions documented.
- No live REST gateway or API key issuance yet.
- Base44's built-in entity SDK is the interim data access layer.
- API Clients and API Keys navigation placeholders exist.
- All deferred to Phase 2+.