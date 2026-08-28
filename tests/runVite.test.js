import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const WRAPPER_PATH = fileURLToPath(
  new URL("../scripts/run-vite.mjs", import.meta.url)
);

async function createFixture() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "pgp-run-vite-"));
  const scriptsDirectory = join(fixtureRoot, "scripts");
  const viteBinDirectory = join(fixtureRoot, "node_modules", "vite", "bin");
  const markerPath = join(fixtureRoot, "vite-started.json");

  await mkdir(scriptsDirectory, { recursive: true });
  await mkdir(viteBinDirectory, { recursive: true });
  await writeFile(
    join(scriptsDirectory, "run-vite.mjs"),
    await readFile(WRAPPER_PATH, "utf8")
  );
  await writeFile(
    join(viteBinDirectory, "vite.js"),
    [
      'import { writeFile } from "node:fs/promises";',
      `await writeFile(${JSON.stringify(markerPath)}, JSON.stringify({`,
      "  buildTarget: process.env.PGP_BUILD_TARGET,",
      "  argv: process.argv.slice(1),",
      "}));",
    ].join("\n")
  );

  return {
    fixtureRoot,
    markerPath,
    wrapperPath: join(scriptsDirectory, "run-vite.mjs"),
  };
}

async function runFixture(args, callerTarget = "unknown-target") {
  const fixture = await createFixture();
  const result = spawnSync(process.execPath, [fixture.wrapperPath, ...args], {
    cwd: fixture.fixtureRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PGP_BUILD_TARGET: callerTarget,
    },
  });

  let marker = null;
  try {
    marker = JSON.parse(await readFile(fixture.markerPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  } finally {
    await rm(fixture.fixtureRoot, { recursive: true, force: true });
  }

  return { result, marker };
}

async function assertRejected(args, expectedCode) {
  const { result, marker } = await runFixture(args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(expectedCode));
  assert.equal(marker, null, "Vite must not start for rejected input");
}

test("rejects unsupported and prototype-like command names before Vite starts", async () => {
  for (const command of ["unsupported", "__proto__", "constructor", "toString"]) {
    await assertRejected([command], "PGP_VITE_COMMAND_UNSUPPORTED");
  }
});

test("rejects every caller-provided build argument before Vite starts", async () => {
  const cases = [
    ["--config", "evil.js"],
    ["-c", "evil.js"],
    ["--config=evil.js"],
    ["--mode", "hostile"],
    ["--mode=hostile"],
    ["hostile-root"],
    ["--"],
    ["--unknown"],
  ];

  for (const args of cases) {
    await assertRejected(
      ["build", ...args],
      "PGP_VITE_ARGUMENTS_NOT_ALLOWED"
    );
  }
});

test("rejects arguments after dev and preview before Vite starts", async () => {
  await assertRejected(["dev", "--host"], "PGP_VITE_ARGUMENTS_NOT_ALLOWED");
  await assertRejected(["preview", "root"], "PGP_VITE_ARGUMENTS_NOT_ALLOWED");
});

test("runs valid commands with fixed argv and fixed Base44 target", async () => {
  const expectedArguments = {
    dev: [],
    build: ["build"],
    preview: ["preview"],
  };

  for (const [command, viteArguments] of Object.entries(expectedArguments)) {
    const { result, marker } = await runFixture([command]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(marker.buildTarget, "base44-cloud");
    assert.deepEqual(marker.argv.slice(1), viteArguments);
  }
});
