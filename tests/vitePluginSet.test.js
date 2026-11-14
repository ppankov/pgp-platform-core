import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadConfigFromFile } from "vite";

const REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONFIG_PATH = join(REPOSITORY_ROOT, "vite.config.js");
const BASE44_PLUGIN_SET_PATH = join(
  REPOSITORY_ROOT,
  "build",
  "vite",
  "base44PluginSet.js"
);
const DESCRIPTOR_PATH = join(
  REPOSITORY_ROOT,
  "src",
  "build",
  "buildTargetDescriptor.js"
);

async function writePackage(root, name, source) {
  const packageDirectory = join(root, "node_modules", ...name.split("/"));
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, "package.json"),
    JSON.stringify({ name, type: "module", exports: "./index.js" })
  );
  await writeFile(join(packageDirectory, "index.js"), source);
}

async function createConfigFixture({ includeBase44Package }) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "pgp-vite-config-"));
  const importMarkerPath = join(fixtureRoot, "base44-import-marker.txt");
  const factoryMarkerPath = join(fixtureRoot, "base44-factory-marker.jsonl");

  await mkdir(join(fixtureRoot, "build", "vite"), { recursive: true });
  await mkdir(join(fixtureRoot, "src", "build"), { recursive: true });
  await cp(CONFIG_PATH, join(fixtureRoot, "vite.config.js"));
  await cp(
    BASE44_PLUGIN_SET_PATH,
    join(fixtureRoot, "build", "vite", "base44PluginSet.js")
  );
  await cp(
    DESCRIPTOR_PATH,
    join(fixtureRoot, "src", "build", "buildTargetDescriptor.js")
  );
  await writeFile(
    join(fixtureRoot, "package.json"),
    JSON.stringify({ type: "module" })
  );

  await writePackage(
    fixtureRoot,
    "vite",
    "export const defineConfig = (config) => config;"
  );
  await writePackage(
    fixtureRoot,
    "@vitejs/plugin-react",
    'export default function react() { return { name: "vite:react" }; }'
  );

  if (includeBase44Package) {
    await writePackage(
      fixtureRoot,
      "@base44/vite-plugin",
      [
        'import { appendFileSync } from "node:fs";',
        'appendFileSync(process.env.PGP_TEST_BASE44_IMPORT_MARKER, "import\\n");',
        "export default function base44(options) {",
        "  appendFileSync(",
        "    process.env.PGP_TEST_BASE44_FACTORY_MARKER,",
        '    `${JSON.stringify(options)}\\n`',
        "  );",
        "  return [",
        '    { name: "base44" },',
        '    { name: "html-injections" },',
        "  ];",
        "}",
      ].join("\n")
    );
  }

  return { fixtureRoot, factoryMarkerPath, importMarkerPath };
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function loadFixtureConfig(fixture, target, legacyImports) {
  const previous = {
    base44LegacyImports: process.env.BASE44_LEGACY_SDK_IMPORTS,
    buildTarget: process.env.PGP_BUILD_TARGET,
    factoryMarker: process.env.PGP_TEST_BASE44_FACTORY_MARKER,
    importMarker: process.env.PGP_TEST_BASE44_IMPORT_MARKER,
  };
  if (target === undefined) delete process.env.PGP_BUILD_TARGET;
  else process.env.PGP_BUILD_TARGET = target;
  if (legacyImports === undefined) delete process.env.BASE44_LEGACY_SDK_IMPORTS;
  else process.env.BASE44_LEGACY_SDK_IMPORTS = legacyImports;
  process.env.PGP_TEST_BASE44_IMPORT_MARKER = fixture.importMarkerPath;
  process.env.PGP_TEST_BASE44_FACTORY_MARKER = fixture.factoryMarkerPath;

  try {
    return await loadConfigFromFile(
      { command: "build", mode: "production", isSsrBuild: false },
      join(fixture.fixtureRoot, "vite.config.js"),
      fixture.fixtureRoot,
      "silent",
      undefined,
      "native"
    );
  } finally {
    for (const [key, value] of Object.entries({
      BASE44_LEGACY_SDK_IMPORTS: previous.base44LegacyImports,
      PGP_BUILD_TARGET: previous.buildTarget,
      PGP_TEST_BASE44_FACTORY_MARKER: previous.factoryMarker,
      PGP_TEST_BASE44_IMPORT_MARKER: previous.importMarker,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withFixture(options, operation) {
  const fixture = await createConfigFixture(options);
  try {
    return await operation(fixture);
  } finally {
    await rm(fixture.fixtureRoot, { recursive: true, force: true });
  }
}

test("keeps the Base44 package import behind one fixed dynamic boundary", async () => {
  const configSource = await readFile(CONFIG_PATH, "utf8");
  const pluginSetSource = await readFile(BASE44_PLUGIN_SET_PATH, "utf8");

  assert.doesNotMatch(
    configSource,
    /(?:from\s+|import\s*)[('\"\s]*@base44\/vite-plugin/
  );
  assert.match(
    configSource,
    /await import\(\s*['"]\.\/build\/vite\/base44PluginSet\.js['"]\s*\)/
  );
  assert.match(
    pluginSetSource,
    /import\s+base44\s+from\s+['"]@base44\/vite-plugin['"]/
  );

  const sourceFiles = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if ([".git", "dist", "node_modules", "src", "tests"].includes(entry.name)) {
        if (directory === REPOSITORY_ROOT && entry.name === "src") {
          await collect(join(directory, entry.name));
        }
        continue;
      }
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (/\.(?:(?:c|m)?js|jsx|ts|tsx)$/.test(entry.name)) sourceFiles.push(path);
    }
  }
  await collect(REPOSITORY_ROOT);

  const executableImporters = [];
  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    if (
      /(?:from\s+|import\s*\()\s*['"]@base44\/vite-plugin['"]/.test(source)
    ) {
      executableImporters.push(relative(REPOSITORY_ROOT, path).replaceAll("\\", "/"));
    }
  }
  assert.deepEqual(executableImporters, ["build/vite/base44PluginSet.js"]);
});

test("native loading rejects targets before resolving the absent Base44 package", async () => {
  for (const [target, expectedCode] of [
    [undefined, "PGP_BUILD_TARGET_MISSING"],
    ["unknown-target", "PGP_BUILD_TARGET_UNKNOWN"],
    ["private-offline-future", "PGP_BUILD_TARGET_NOT_IMPLEMENTED"],
  ]) {
    await withFixture({ includeBase44Package: false }, async (fixture) => {
      await assert.rejects(
        () => loadFixtureConfig(fixture, target),
        (error) => error.code === expectedCode
      );
      assert.equal(await readOptional(fixture.importMarkerPath), null);
      assert.equal(await readOptional(fixture.factoryMarkerPath), null);
    });
  }
});

test("native loading imports and invokes Base44 exactly once with parity", async () => {
  await withFixture({ includeBase44Package: true }, async (fixture) => {
    const loaded = await loadFixtureConfig(fixture, "base44-cloud");
    assert.ok(loaded, "Native config loading must return a config result");
    assert.deepEqual(
      loaded.config.plugins.map((plugin) => plugin.name),
      ["base44", "html-injections", "vite:react"]
    );
    assert.equal(await readOptional(fixture.importMarkerPath), "import\n");

    const factoryLines = (await readFile(fixture.factoryMarkerPath, "utf8"))
      .trim()
      .split("\n");
    assert.equal(factoryLines.length, 1);
    assert.deepEqual(JSON.parse(factoryLines[0]), {
      legacySDKImports: false,
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true,
    });
  });
});

test("native loading passes enabled legacy SDK imports to Base44", async () => {
  await withFixture({ includeBase44Package: true }, async (fixture) => {
    const loaded = await loadFixtureConfig(fixture, "base44-cloud", "true");
    assert.ok(loaded, "Native config loading must return a config result");
    const factoryLines = (await readFile(fixture.factoryMarkerPath, "utf8"))
      .trim()
      .split("\n");
    assert.equal(factoryLines.length, 1);
    assert.equal(JSON.parse(factoryLines[0]).legacySDKImports, true);
  });
});
