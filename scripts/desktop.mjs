import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const env = { ...process.env };
const pathKey =
  Object.keys(env).find((k) => k.toLowerCase() === "path") ?? "PATH";
env[pathKey] =
  join(homedir(), ".cargo", "bin") + delimiter + (env[pathKey] ?? "");
const child = spawn(
  process.execPath,
  [
    join(root, "node_modules", "@tauri-apps", "cli", "tauri.js"),
    ...process.argv.slice(2),
  ],
  { cwd: root, env, stdio: "inherit", windowsHide: true },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
