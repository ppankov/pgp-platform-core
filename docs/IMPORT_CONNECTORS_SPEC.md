# PGP Architecture Intelligence — Import Connectors Specification

## Overview

The application analyzes software systems by importing their source code, specifications, and documentation. Import sources are accessed through Core connectors — the app never stores credentials.

## Source Types

| Source Type | Description |
|---|---|
| `git` | Generic Git repository |
| `github` | GitHub repository (via Core GitHub connector) |
| `gitlab` | GitLab repository (via Core GitLab connector) |
| `bitbucket` | Bitbucket repository |
| `zip` | Uploaded ZIP archive |
| `openapi` | OpenAPI specification |
| `swagger` | Swagger specification |
| `db_schema` | Database schema |
| `markdown` | Markdown documentation |
| `pdf` | PDF architecture document |
| `image` | Image (diagram, screenshot) |
| `screenshot` | UI screenshot |
| `video` | Video demonstration |
| `ai_connector` | Future AI-powered analysis connector |

## Import Source Entity (`AuditProjectSource`)

| Field | Description |
|---|---|
| `project_id` | Parent project |
| `source_type` | One of the source types above |
| `connector_connection_id` | Reference to Core `ConnectorConnection` (nullable for uploads) |
| `reference` | Repo URL, file URL, or spec URL — **never credentials** |
| `import_metadata` | Non-sensitive metadata (branch, commit, file count) |
| `status` | pending, imported, error |

## No-Secret Principle

- `AuditProjectSource` never stores credentials.
- Live access to repositories uses Core `ConnectorConnection` tokens at runtime, server-side only.
- Uploaded files (ZIP, PDF, images) are stored in Core Storage with non-sensitive URLs.
- No secret is ever imported into frontend code.

## Import Flow (Future)

```
User adds source → AuditProjectSource (status: pending)
    ↓ [backend ingestion]
Source fetched via Core ConnectorConnection (for git/github/etc.)
    OR file uploaded via Core Storage (for zip/pdf/images)
    ↓ [metadata extraction]
import_metadata populated (branch, commit, file count, etc.)
    ↓ [ready]
AuditProjectSource (status: imported)
```

## IP & Confidentiality

- Imported source code is org-scoped — no cross-org access.
- The application is read-only — it never writes to or modifies the imported source.
- No arbitrary code execution against imported source.
- Imported artifacts are stored in the org's Core Storage namespace.

## Future AI Connectors

The `ai_connector` source type reserves space for future AI-powered analysis connectors that can analyze video demonstrations, screenshots, or live systems.

## Phase 1A Status

- Import source entity schema created.
- All 14 source types defined in the enum.
- No ingestion runtime, no connector integration, no file upload.
- All deferred to Phase 3.