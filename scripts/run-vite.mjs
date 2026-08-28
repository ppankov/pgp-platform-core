const BASE44_BUILD_TARGET = "base44-cloud";
const COMMAND_ARGUMENTS = Object.freeze({
  dev: [],
  build: ["build"],
  preview: ["preview"],
});

const [command, ...forwardedArgs] = process.argv.slice(2);
if (!Object.prototype.hasOwnProperty.call(COMMAND_ARGUMENTS, command)) {
  const error = new Error(
    "PGP_VITE_COMMAND_UNSUPPORTED: Unsupported Vite command."
  );
  error.code = "PGP_VITE_COMMAND_UNSUPPORTED";
  throw error;
}

if (forwardedArgs.length > 0) {
  const error = new Error(
    "PGP_VITE_ARGUMENTS_NOT_ALLOWED: Caller-provided Vite arguments are not allowed."
  );
  error.code = "PGP_VITE_ARGUMENTS_NOT_ALLOWED";
  throw error;
}

// Trusted build orchestration input. This value is consumed only by
// vite.config.js and is not exposed through Vite define/runtime configuration.
process.env.PGP_BUILD_TARGET = BASE44_BUILD_TARGET;
process.argv = [
  process.argv[0],
  "vite",
  ...COMMAND_ARGUMENTS[command],
];

await import(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
