// src/services/providerBootstrap.js
// Wave 10.5C.2 — deferred application bootstrap and provider-loading
// isolation (internal implementation module).
//
// Sole owner of the bootstrap lifecycle: state, bound profile/family, bound
// bundle, and in-flight binding promise. Dynamically imports the selected
// provider adapter ONLY after explicit bootstrap selection, validates the
// returned bundle, and binds it exactly once. backendAdapter.js reads the
// bound bundle synchronously via getBoundProvider().
//
// Imports only resolveProviderFamily and validateProviderBundle from
// providerSelection.js. No static import of base44Adapter, base44Client,
// backendAdapter, App, AuthContext, @base44/sdk, appParams, or
// environment-profile.
//
// State model: uninitialized -> binding -> bound | failed.
// No fallback. No silent Base44 selection. No secret/dump exposure.

import {
  resolveProviderFamily,
  validateProviderBundle,
} from '@/services/providerSelection';

// Immutable fixed provider-family -> async loader map. Exactly one family.
// The loader uses ONE fixed dynamic import path; the path is not constructed
// from profileName, family text, URL, hostname, env, or user input. The
// loader selects only the two required module exports; it does not return
// the full module namespace. Client construction remains only in the
// provider adapter module.
const PROVIDER_LOADERS = Object.freeze({
  base44: async () => {
    const module = await import('@/services/base44Adapter');
    return {
      providerClient: module.providerClient,
      fetchPublicSettings: module.fetchPublicSettings,
    };
  },
});

const ERROR_CODES = Object.freeze({
  NOT_REGISTERED: "PGP_PROVIDER_NOT_REGISTERED",
  INVALID_FACADE: "PGP_PROVIDER_INVALID_FACADE",
  BOOTSTRAP_REQUIRED: "PGP_PROVIDER_BOOTSTRAP_REQUIRED",
  LOAD_FAILED: "PGP_PROVIDER_LOAD_FAILED",
  ALREADY_INITIALIZED: "PGP_PROVIDER_ALREADY_INITIALIZED",
  REENTRANT: "PGP_PROVIDER_BOOTSTRAP_REENTRANT",
});

function bootstrapError(code) {
  const err = new Error(`Provider bootstrap failed: ${code}`);
  err.code = code;
  return err;
}

// Sole mutable bootstrap state (module-private; not exported directly).
let state = "uninitialized";
let boundProfile = null;
let boundFamily = null;
let boundBundle = null;
let bindingPromise = null;

// bootstrapProvider(profileName):
// 1. resolve family synchronously (NOT_REGISTERED on invalid/unknown profile)
// 2. verify family owns a loader (NOT_REGISTERED if missing)
// 3. enter binding
// 4. run selected loader (once)
// 5. validate returned bundle (INVALID_FACADE on malformed)
// 6. bind bundle exactly once
// 7. enter bound
// Idempotent for the same profile after bound. Different profile after bound
// -> ALREADY_INITIALIZED. Different profile during binding -> REENTRANT.
// Same profile during binding -> reuse in-flight promise. Failed state ->
// LOAD_FAILED on later attempts. Dynamic-import rejection -> LOAD_FAILED
// (raw error not exposed). Selection/validation errors propagate unwrapped.
export async function bootstrapProvider(profileName) {
  const family = resolveProviderFamily(profileName);

  if (state === "bound") {
    if (boundProfile === profileName) {
      return; // idempotent; loader not called again
    }
    throw bootstrapError(ERROR_CODES.ALREADY_INITIALIZED);
  }
  if (state === "failed") {
    throw bootstrapError(ERROR_CODES.LOAD_FAILED);
  }
  if (state === "binding") {
    if (boundProfile === profileName) {
      return bindingPromise; // reuse in-flight; loader executes once
    }
    throw bootstrapError(ERROR_CODES.REENTRANT);
  }

  // uninitialized -> binding.
  state = "binding";
  boundProfile = profileName;
  boundFamily = family;

  const promise = (async () => {
    try {
      const loader = PROVIDER_LOADERS[boundFamily];
      if (!loader) {
        throw bootstrapError(ERROR_CODES.NOT_REGISTERED);
      }
      const rawBundle = await loader();
      boundBundle = validateProviderBundle(rawBundle, profileName);
      state = "bound";
      bindingPromise = null;
    } catch (e) {
      state = "failed";
      boundBundle = null;
      bindingPromise = null;
      if (e && (e.code === ERROR_CODES.NOT_REGISTERED || e.code === ERROR_CODES.INVALID_FACADE)) {
        throw e;
      }
      throw bootstrapError(ERROR_CODES.LOAD_FAILED);
    }
  })();

  bindingPromise = promise;
  return promise;
}

// getBoundProvider(): synchronous. Returns the exact frozen bound bundle
// { providerClient, fetchPublicSettings } when state is bound; same identity
// on every call. Throws PGP_PROVIDER_BOOTSTRAP_REQUIRED when not bound
// (including uninitialized and failed states). Never returns null/undefined/
// Promise/placeholder/Proxy/lazy wrappers; no fallback Base44 provider.
export function getBoundProvider() {
  if (state !== "bound" || !boundBundle) {
    throw bootstrapError(ERROR_CODES.BOOTSTRAP_REQUIRED);
  }
  return boundBundle;
}