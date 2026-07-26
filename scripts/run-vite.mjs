const BASE44_BUILD_TARGET = "base44-cloud";
const COMMAND_ARGUMENTS = Object.freeze({
  dev: [],
  build: ["build"],
  preview: ["preview"],
});

const [command, ...forwardedArgs] = process.argv.slice(2);
if (!Object.prototype.hasOwnProperty.call(COMMAND_ARGUMENTS, command)) {
  throw new Error("Unsupported Vite command.");
}

// Trusted build orchestration input. This value is consumed only by
// vite.config.js and is not exposed through Vite define/runtime configuration.
process.env.PGP_BUILD_TARGET = BASE44_BUILD_TARGET;
process.argv = [
  process.argv[0],
  "vite",
  ...COMMAND_ARGUMENTS[command],
  ...forwardedArgs,
];

await import(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
