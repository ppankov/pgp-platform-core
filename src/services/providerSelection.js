// src/services/providerSelection.js
// Wave 10.5C.2 — provider-selection boundary (internal implementation module).
//
// Synchronous, stateless, import-free. Maps an already-resolved environment
// profile to a provider family and validates a candidate provider bundle.
// No bootstrap state, no provider module loading, no client construction.
// Sole importer: providerBootstrap.js.
//
// Purity: 0 imports. No SDK, no provider adapter, no app parameters, no
// environment reads, no dynamic imports, no bootstrap state.

// Immutable allow-listed profile -> provider-family mapping. Exactly 2 keys.
const PROFILE_TO_FAMILY = Object.freeze({
  "base44-cloud": "base44",
  "local-development": "base44",
});

// Internal error codes (not exported).
const ERROR_CODES = Object.freeze({
  NOT_REGISTERED: "PGP_PROVIDER_NOT_REGISTERED",
  INVALID_FACADE: "PGP_PROVIDER_INVALID_FACADE",
});

// Wave 10.5B.4 correction B: safe, non-throwing conversion of the profile
// label for error messages. Returns a fixed non-secret fallback label when
// String(value) throws (e.g. Object.create(null), throwing toString /
// Symbol.toPrimitive). Internal only; never exported; no logging, no dump.
function safeProfileLabel(value) {
  try {
    return String(value);
  } catch (_) {
    return "<unconvertible>";
  }
}

function selectionError(code, profileName) {
  const safeName = safeProfileLabel(profileName);
  const message =
    code === ERROR_CODES.NOT_REGISTERED
      ? `No registered provider for environment profile: ${safeName}`
      : `Provider returned an invalid facade for environment profile: ${safeName}`;
  const err = new Error(message);
  err.code = code;
  return err;
}

// Public API — resolveProviderFamily(profileName).
// Synchronous. Accepts an already-resolved profile name. Maps exactly
// base44-cloud -> base44, local-development -> base44. Rejects every other
// value (including inherited Object.prototype keys) with
// PGP_PROVIDER_NOT_REGISTERED. Loads no module, constructs no client.
export function resolveProviderFamily(profileName) {
  if (typeof profileName !== "string") {
    throw selectionError(ERROR_CODES.NOT_REGISTERED, profileName);
  }
  // Wave 10.5B.4 correction A: require an OWN property so inherited
  // Object.prototype keys (__proto__, constructor, toString, hasOwnProperty,
  // prototype) cannot be accepted as a profile mapping.
  if (!Object.prototype.hasOwnProperty.call(PROFILE_TO_FAMILY, profileName)) {
    throw selectionError(ERROR_CODES.NOT_REGISTERED, profileName);
  }
  return PROFILE_TO_FAMILY[profileName];
}

// Public API — validateProviderBundle(bundle, profileName).
// Synchronous. Requires exactly { providerClient, fetchPublicSettings };
// providerClient must be object-like with auth/functions/entities;
// fetchPublicSettings must be a function. Returns a frozen two-key bundle
// preserving the exact providerClient and fetchPublicSettings references.
// Throws PGP_PROVIDER_INVALID_FACADE for malformed bundles. Exposes no
// provider dump or secret.
export function validateProviderBundle(bundle, profileName) {
  if (!bundle || typeof bundle !== "object") {
    throw selectionError(ERROR_CODES.INVALID_FACADE, profileName);
  }
  const keys = Object.keys(bundle);
  if (
    keys.length !== 2 ||
    !keys.includes("providerClient") ||
    !keys.includes("fetchPublicSettings")
  ) {
    throw selectionError(ERROR_CODES.INVALID_FACADE, profileName);
  }
  const pc = bundle.providerClient;
  if (!pc || typeof pc !== "object") {
    throw selectionError(ERROR_CODES.INVALID_FACADE, profileName);
  }
  if (!pc.auth || !pc.functions || !pc.entities) {
    throw selectionError(ERROR_CODES.INVALID_FACADE, profileName);
  }
  if (typeof bundle.fetchPublicSettings !== "function") {
    throw selectionError(ERROR_CODES.INVALID_FACADE, profileName);
  }
  return Object.freeze({
    providerClient: bundle.providerClient,
    fetchPublicSettings: bundle.fetchPublicSettings,
  });
}