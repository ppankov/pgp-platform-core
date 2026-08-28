// src/lib/environment-profile.js
// Wave 10.5A.2 — environment profile descriptor.
//
// Pure, provider-independent. Profile names are descriptive configuration
// metadata only — NOT authorization, tenant isolation, RLS, license
// enforcement, provider security, or deployment proof.
//
// Purity: 0 imports, 0 import.meta.env reads, 0 process.env reads, 0 localStorage,
// 0 URL access, 0 fetch/network, 0 @base44/sdk references, 0 Deno references,
// 0 secret loading, 0 provider construction.

const KNOWN_PROFILES = Object.freeze([
  "base44-cloud",
  "local-development",
  "private-demo",
  "enterprise-offline-future",
]);

const DEFAULT_ENVIRONMENT_PROFILE = "base44-cloud";

const ENVIRONMENT_PROFILE_ERROR_CODES = Object.freeze({
  UNKNOWN_PROFILE: "PGP_ENV_PROFILE_UNKNOWN",
  PROFILE_NOT_IMPLEMENTED: "PGP_ENV_PROFILE_NOT_IMPLEMENTED",
});

// Internal immutable descriptor map. Each value is frozen; describeProfile
// returns the frozen reference (immutable), never a mutable copy source.
const DESCRIPTORS = Object.freeze({
  "base44-cloud": Object.freeze({
    id: "base44-cloud",
    implementationStatus: "ACTIVE",
    providerFamily: "base44",
    selectable: true,
  }),
  "local-development": Object.freeze({
    id: "local-development",
    implementationStatus: "ACTIVE",
    providerFamily: "base44",
    selectable: true,
  }),
  "private-demo": Object.freeze({
    id: "private-demo",
    implementationStatus: "NOT_IMPLEMENTED",
    providerFamily: "unassigned",
    selectable: false,
  }),
  "enterprise-offline-future": Object.freeze({
    id: "enterprise-offline-future",
    implementationStatus: "NOT_IMPLEMENTED",
    providerFamily: "unassigned",
    selectable: false,
  }),
});

function profileError(code, profileName) {
  const safeName = String(profileName);
  const message =
    code === ENVIRONMENT_PROFILE_ERROR_CODES.UNKNOWN_PROFILE
      ? `Unknown environment profile: ${safeName}`
      : `Environment profile not implemented: ${safeName}`;
  const err = new Error(message);
  err.code = code;
  return err;
}

function resolveActiveProfile(rawProfile) {
  if (rawProfile === undefined || rawProfile === null) {
    return DEFAULT_ENVIRONMENT_PROFILE;
  }
  if (typeof rawProfile !== "string") {
    throw profileError(ENVIRONMENT_PROFILE_ERROR_CODES.UNKNOWN_PROFILE, rawProfile);
  }
  const trimmed = rawProfile.trim();
  if (trimmed === "") {
    return DEFAULT_ENVIRONMENT_PROFILE;
  }
  if (!KNOWN_PROFILES.includes(trimmed)) {
    throw profileError(ENVIRONMENT_PROFILE_ERROR_CODES.UNKNOWN_PROFILE, trimmed);
  }
  const descriptor = DESCRIPTORS[trimmed];
  if (!descriptor.selectable) {
    throw profileError(ENVIRONMENT_PROFILE_ERROR_CODES.PROFILE_NOT_IMPLEMENTED, trimmed);
  }
  return trimmed;
}

function describeProfile(profileName) {
  if (typeof profileName !== "string") {
    throw profileError(ENVIRONMENT_PROFILE_ERROR_CODES.UNKNOWN_PROFILE, profileName);
  }
  const trimmed = profileName.trim();
  if (!KNOWN_PROFILES.includes(trimmed)) {
    throw profileError(ENVIRONMENT_PROFILE_ERROR_CODES.UNKNOWN_PROFILE, trimmed);
  }
  return DESCRIPTORS[trimmed];
}

export {
  KNOWN_PROFILES,
  DEFAULT_ENVIRONMENT_PROFILE,
  ENVIRONMENT_PROFILE_ERROR_CODES,
  resolveActiveProfile,
  describeProfile,
};