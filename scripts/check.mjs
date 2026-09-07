import { run, nodeTool } from "./runtime.mjs";

await run(process.execPath, ["scripts/check-architecture.mjs"]);
await run(process.execPath, ["--test", "scripts/tests/i18n-audit.test.mjs"]);
await run(process.execPath, ["--test", "scripts/tests/release.test.mjs"]);
await run(process.execPath, ["scripts/check-i18n.mjs"]);
await nodeTool(
  "prettier/bin/prettier.cjs",
  "--check",
  "src",
  "scripts",
  "*.config.ts",
);
await nodeTool("typescript/bin/tsc", "--noEmit");
await nodeTool("vitest/vitest.mjs", "run");
await run("cargo", [
  "fmt",
  "--manifest-path",
  "src-tauri/Cargo.toml",
  "--check",
]);
await run("cargo", [
  "clippy",
  "--manifest-path",
  "src-tauri/Cargo.toml",
  "--all-targets",
  "--",
  "-D",
  "warnings",
]);
await run("cargo", ["test", "--manifest-path", "src-tauri/Cargo.toml"]);
await run(process.execPath, ["scripts/bindings.mjs", "--check"]);
