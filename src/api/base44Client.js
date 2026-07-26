// src/api/base44Client.js
// Backward-compat shim (Wave 10.1).
//
// The canonical Base44 client now lives in src/services/base44Adapter.js.
// This file re-exports it as `base44` for AuthContext (platform-managed,
// imports `base44` from here). It does not import the Base44 SDK directly.
//
// Phase 10 Wave 10.1 — auth redirect regression: a previous logout wrapper
// here (forced full reload to "/") was an incorrect
// race-condition mask and has been REMOVED. `base44.auth` is again the
// unmodified provider `auth` object — `logout` keeps the original provider
// contract (args/return unchanged). The real fix is in App.jsx
// (unauthenticated redirect -> "/" instead of "/login") plus a "/login" ->
// "/" compatibility route. No window.location workaround, no setTimeout, no
// forced reload, no race masking.

export { providerClient as base44 } from '@/services/base44Adapter';