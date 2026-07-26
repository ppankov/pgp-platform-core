// Phase 10 — Wave 10.6.5 trusted build-target descriptor skeleton.
//
// This module is pure: it does not read process.env, import.meta.env, browser
// state, storage, URLs, network data, credentials, or provider modules.

const BUILD_TARGET_ERROR_CODES = Object.freeze({
  MISSING_TARGET: "PGP_BUILD_TARGET_MISSING",
  INVALID_TARGET_TYPE: "PGP_BUILD_TARGET_INVALID_TYPE",
  UNKNOWN_TARGET: "PGP_BUILD_TARGET_UNKNOWN",
  TARGET_NOT_IMPLEMENTED: "PGP_BUILD_TARGET_NOT_IMPLEMENTED",
  INVALID_DESCRIPTOR: "PGP_BUILD_TARGET_INVALID_DESCRIPTOR",
  MISSING_REQUIRED_BINDING: "PGP_BUILD_TARGET_BINDING_MISSING",
  INCOMPATIBLE_REQUIRED_BINDING: "PGP_BUILD_TARGET_BINDING_INCOMPATIBLE",
  INCOMPATIBLE_RUNTIME_PROFILE: "PGP_BUILD_TARGET_PROFILE_INCOMPATIBLE",
});

const REQUIRED_BINDING_NAMES = Object.freeze([
  "vitePlugin",
  "providerLoader",
  "auth",
  "appParameters",
  "bootstrap",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return Object.freeze(value);
}

const BASE44_CLOUD_DESCRIPTOR = deepFreeze({
  id: "base44-cloud",
  implementationStatus: "IMPLEMENTED",
  selectable: true,
  permittedRuntimeProfiles: ["base44-cloud", "local-development"],
  permittedProviderFamilies: ["base44"],
  bindings: {
    vitePlugin: "base44-vite-plugin-current",
    providerLoader: "base44-provider-loader-current",
    auth: "base44-auth-context-facade-current",
    appParameters: "base44-app-parameters-current",
    bootstrap: "base44-entry-bootstrap-current",
  },
});

const PRIVATE_OFFLINE_FUTURE_DESCRIPTOR = deepFreeze({
  id: "private-offline-future",
  implementationStatus: "NOT_IMPLEMENTED",
  selectable: false,
  permittedRuntimeProfiles: [],
  permittedProviderFamilies: [],
  bindings: {
    vitePlugin: null,
    providerLoader: null,
    auth: null,
    appParameters: null,
    bootstrap: null,
  },
});

const registry = Object.create(null);
registry["base44-cloud"] = BASE44_CLOUD_DESCRIPTOR;
registry["private-offline-future"] = PRIVATE_OFFLINE_FUTURE_DESCRIPTOR;

const BUILD_TARGET_DESCRIPTORS = Object.freeze(registry);

function safeTargetLabel(value) {
  try {
    const label = String(value);
    return /^[A-Za-z0-9._<>-]{1,64}$/.test(label) ? label : "<invalid>";
  } catch (_) {
    return "<unconvertible>";
  }
}

function buildTargetError(code, target) {
  const error = new Error(
    `Build target resolution failed: ${code} (${safeTargetLabel(target)})`
  );
  error.code = code;
  return error;
}

function hasExactOwnKeys(value, expectedKeys) {
  if (!value || typeof value !== "object") return false;
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length &&
    expectedKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key)
    )
  );
}

function validateBuildTargetDescriptor(descriptor, expectedId = descriptor?.id) {
  const descriptorKeys = [
    "id",
    "implementationStatus",
    "selectable",
    "permittedRuntimeProfiles",
    "permittedProviderFamilies",
    "bindings",
  ];
  if (
    !hasExactOwnKeys(descriptor, descriptorKeys) ||
    descriptor.id !== expectedId ||
    typeof descriptor.id !== "string" ||
    !["IMPLEMENTED", "NOT_IMPLEMENTED"].includes(
      descriptor.implementationStatus
    ) ||
    typeof descriptor.selectable !== "boolean" ||
    !Array.isArray(descriptor.permittedRuntimeProfiles) ||
    !descriptor.permittedRuntimeProfiles.every(
      (profile) => typeof profile === "string" && profile.length > 0
    ) ||
    !Array.isArray(descriptor.permittedProviderFamilies) ||
    !descriptor.permittedProviderFamilies.every(
      (family) => typeof family === "string" && family.length > 0
    ) ||
    !hasExactOwnKeys(descriptor.bindings, REQUIRED_BINDING_NAMES) ||
    !Object.isFrozen(descriptor) ||
    !Object.isFrozen(descriptor.permittedRuntimeProfiles) ||
    !Object.isFrozen(descriptor.permittedProviderFamilies) ||
    !Object.isFrozen(descriptor.bindings)
  ) {
    throw buildTargetError(
      BUILD_TARGET_ERROR_CODES.INVALID_DESCRIPTOR,
      expectedId
    );
  }

  if (
    descriptor.implementationStatus === "IMPLEMENTED" &&
    descriptor.selectable !== true
  ) {
    throw buildTargetError(
      BUILD_TARGET_ERROR_CODES.INVALID_DESCRIPTOR,
      expectedId
    );
  }
  if (
    descriptor.implementationStatus === "NOT_IMPLEMENTED" &&
    descriptor.selectable !== false
  ) {
    throw buildTargetError(
      BUILD_TARGET_ERROR_CODES.INVALID_DESCRIPTOR,
      expectedId
    );
  }

  for (const bindingName of REQUIRED_BINDING_NAMES) {
    const binding = descriptor.bindings[bindingName];
    if (
      descriptor.implementationStatus === "IMPLEMENTED" &&
      (typeof binding !== "string" || binding.length === 0)
    ) {
      throw buildTargetError(
        BUILD_TARGET_ERROR_CODES.MISSING_REQUIRED_BINDING,
        expectedId
      );
    }
    if (
      descriptor.implementationStatus === "NOT_IMPLEMENTED" &&
      binding !== null
    ) {
      throw buildTargetError(
        BUILD_TARGET_ERROR_CODES.INVALID_DESCRIPTOR,
        expectedId
      );
    }
  }

  return descriptor;
}

function resolveBuildTargetDescriptor(rawTarget) {
  if (rawTarget === undefined || rawTarget === null) {
    throw buildTargetError(
      BUILD_TARGET_ERROR_CODES.MISSING_TARGET,
      "<missing>"
    );
  }
  if (typeof rawTarget !== "string") {
    throw buildTargetError(
      BUILD_TARGET_ERROR_CODES.INVALID_TARGET_TYPE,
      "<non-string>"
    );
  }

  const target = rawTarget.trim();
  if (target.length === 0) {
    throw buildTargetError(
      BUILD_TARGET_ERROR_CODES.MISSING_TARGET,
      "<empty>"
    );
  }
  if (
    !Object.prototype.hasOwnProperty.call(BUILD_TARGET_DESCRIPTORS, target)
  ) {
    throw buildTargetError(BUILD_TARGET_ERROR_CODES.UNKNOWN_TARGET, target);
  }

  const descriptor = validateBuildTargetDescriptor(
    BUILD_TARGET_DESCRIPTORS[target],
    target
  );
  if (!descriptor.selectable) {
    throw buildTargetError(
      BUILD_TARGET_ERROR_CODES.TARGET_NOT_IMPLEMENTED,
      target
    );
  }
  return descriptor;
}

function assertBuildTargetBinding(descriptor, bindingName, expectedIdentifier) {
  validateBuildTargetDescriptor(descriptor);
  if (
    !REQUIRED_BINDING_NAMES.includes(bindingName) ||
    typeof descriptor.bindings[bindingName] !== "string"
  ) {
    throw buildTargetError(
      BUILD_TARGET_ERROR_CODES.MISSING_REQUIRED_BINDING,
      descriptor.id
    );
  }
  if (descriptor.bindings[bindingName] !== expectedIdentifier) {
    throw buildTargetError(
      BUILD_TARGET_ERROR_CODES.INCOMPATIBLE_REQUIRED_BINDING,
      descriptor.id
    );
  }
}

function assertRuntimeProfileCompatible(descriptor, profile) {
  validateBuildTargetDescriptor(descriptor);
  if (
    typeof profile !== "string" ||
    !descriptor.permittedRuntimeProfiles.includes(profile)
  ) {
    throw buildTargetError(
      BUILD_TARGET_ERROR_CODES.INCOMPATIBLE_RUNTIME_PROFILE,
      descriptor.id
    );
  }
}

export {
  BUILD_TARGET_DESCRIPTORS,
  BUILD_TARGET_ERROR_CODES,
  assertBuildTargetBinding,
  assertRuntimeProfileCompatible,
  resolveBuildTargetDescriptor,
  validateBuildTargetDescriptor,
};
