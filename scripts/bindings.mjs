import { mkdtemp, readFile, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import prettier from "prettier";
import { root, run } from "./runtime.mjs";

const directory = await mkdtemp(join(tmpdir(), "qwriter-bindings-"));
const temporary = join(directory, "bindings.ts");
const destination = join(root, "src/shared/ipc/bindings.ts");
try {
  await run("cargo", [
    "run",
    "--quiet",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--example",
    "export_bindings",
    "--",
    temporary,
  ]);
  const formatted = await prettier.format(await readFile(temporary, "utf8"), {
    ...(await prettier.resolveConfig(destination)),
    parser: "typescript",
  });
  if (process.argv.includes("--check")) {
    if (
      (await readFile(destination, "utf8")).replaceAll("\r\n", "\n") !==
      formatted.replaceAll("\r\n", "\n")
    )
      throw new Error("IPC bindings are stale. Run npm run bindings:generate.");
    console.log("IPC bindings match the Rust command registry.");
  } else {
    await writeFile(destination, formatted);
    console.log("Generated src/shared/ipc/bindings.ts");
  }
} finally {
  await unlink(temporary).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  await rmdir(directory);
}
