import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = dirname(dirname(fileURLToPath(import.meta.url)));
const env = { ...process.env };
const pathKey =
  Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
env[pathKey] =
  join(homedir(), ".cargo", "bin") + delimiter + (env[pathKey] ?? "");
export function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}
export function nodeTool(file, ...args) {
  return run(process.execPath, [join(root, "node_modules", file), ...args]);
}
