import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILD_TARGET_DESCRIPTORS,
  BUILD_TARGET_ERROR_CODES,
  assertBuildTargetBinding,
  assertRuntimeProfileCompatible,
  resolveBuildTargetDescriptor,
  validateBuildTargetDescriptor,
} from "../src/build/buildTargetDescriptor.js";

function assertCode(expectedCode, operation) {
  assert.throws(operation, (error) => {
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("resolves the only selectable target", () => {
  const descriptor = resolveBuildTargetDescriptor("base44-cloud");
  assert.strictEqual(descriptor, BUILD_TARGET_DESCRIPTORS["base44-cloud"]);
  assert.equal(descriptor.implementationStatus, "IMPLEMENTED");
  assert.equal(descriptor.selectable, true);
});

test("freezes the registry and descriptors recursively", () => {
  const descriptor = BUILD_TARGET_DESCRIPTORS["base44-cloud"];
  assert.equal(Object.isFrozen(BUILD_TARGET_DESCRIPTORS), true);
  assert.equal(Object.isFrozen(descriptor), true);
  assert.equal(Object.isFrozen(descriptor.permittedRuntimeProfiles), true);
  assert.equal(Object.isFrozen(descriptor.permittedProviderFamilies), true);
  assert.equal(Object.isFrozen(descriptor.bindings), true);
});

test("rejects inherited and prototype-like target names", () => {
  for (const target of ["__proto__", "constructor", "toString"]) {
    assertCode(BUILD_TARGET_ERROR_CODES.UNKNOWN_TARGET, () =>
      resolveBuildTargetDescriptor(target)
    );
  }
});

test("rejects missing and empty targets without a fallback", () => {
  for (const target of [undefined, null, "", "   "]) {
    assertCode(BUILD_TARGET_ERROR_CODES.MISSING_TARGET, () =>
      resolveBuildTargetDescriptor(target)
    );
  }
});

test("rejects non-string targets", () => {
  for (const target of [42, false, {}, []]) {
    assertCode(BUILD_TARGET_ERROR_CODES.INVALID_TARGET_TYPE, () =>
      resolveBuildTargetDescriptor(target)
    );
  }
});

test("rejects an unknown target", () => {
  assertCode(BUILD_TARGET_ERROR_CODES.UNKNOWN_TARGET, () =>
    resolveBuildTargetDescriptor("unknown-target")
  );
});

test("rejects the known placeholder as not implemented", () => {
  assertCode(BUILD_TARGET_ERROR_CODES.TARGET_NOT_IMPLEMENTED, () =>
    resolveBuildTargetDescriptor("private-offline-future")
  );
});

test("validates descriptor shape and required bindings", () => {
  assertCode(BUILD_TARGET_ERROR_CODES.INVALID_DESCRIPTOR, () =>
    validateBuildTargetDescriptor(Object.freeze({ id: "broken" }), "broken")
  );

  const missingBinding = Object.freeze({
    id: "broken-binding",
    implementationStatus: "IMPLEMENTED",
    selectable: true,
    permittedRuntimeProfiles: Object.freeze(["base44-cloud"]),
    permittedProviderFamilies: Object.freeze(["base44"]),
    bindings: Object.freeze({
      vitePlugin: null,
      providerLoader: "provider",
      auth: "auth",
      appParameters: "params",
      bootstrap: "bootstrap",
    }),
  });
  assertCode(BUILD_TARGET_ERROR_CODES.MISSING_REQUIRED_BINDING, () =>
    validateBuildTargetDescriptor(missingBinding, "broken-binding")
  );

  const descriptor = resolveBuildTargetDescriptor("base44-cloud");
  assertCode(BUILD_TARGET_ERROR_CODES.INCOMPATIBLE_REQUIRED_BINDING, () =>
    assertBuildTargetBinding(descriptor, "vitePlugin", "wrong-plugin")
  );
});

test("permits exactly the two current runtime profiles", () => {
  const descriptor = resolveBuildTargetDescriptor("base44-cloud");
  assert.deepEqual(descriptor.permittedRuntimeProfiles, [
    "base44-cloud",
    "local-development",
  ]);
  assert.doesNotThrow(() =>
    assertRuntimeProfileCompatible(descriptor, "base44-cloud")
  );
  assert.doesNotThrow(() =>
    assertRuntimeProfileCompatible(descriptor, "local-development")
  );
  assertCode(BUILD_TARGET_ERROR_CODES.INCOMPATIBLE_RUNTIME_PROFILE, () =>
    assertRuntimeProfileCompatible(descriptor, "private-demo")
  );
});
