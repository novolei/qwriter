import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { root } from "./runtime.mjs";

const failures = [];
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) walk(file);
    else if (/\.(tsx?|css|rs)$/.test(file)) files.push(file);
  }
}
walk("src");
walk("src-tauri/src");
for (const file of files) {
  if (file === "src/shared/ipc/bindings.ts") continue;
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const lines = source.trimEnd().split(/\r?\n/).length;
  if (lines > 500)
    failures.push(
      `${file}: ${lines} lines exceeds the 500-line limit. Extract a cohesive module.`,
    );
  if (/\.tsx?$/.test(file)) {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements) {
      if (
        !ts.isImportDeclaration(node) ||
        !ts.isStringLiteral(node.moduleSpecifier)
      )
        continue;
      const specifier = node.moduleSpecifier.text;
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(file), specifier),
      );
      if (
        file.startsWith("src/shared/") &&
        /^src\/(features|app)\//.test(target)
      )
        failures.push(`${file}: shared must not import ${target}`);
      if (file.startsWith("src/features/") && target.startsWith("src/app/"))
        failures.push(`${file}: features must not import app composition`);
      if (!file.includes(".test.") && specifier === "@tauri-apps/api/core") {
        const imports = node.importClause?.namedBindings;
        if (
          imports &&
          (!ts.isNamedImports(imports) ||
            imports.elements.some(
              (element) =>
                (element.propertyName ?? element.name).text === "invoke",
            ))
        )
          failures.push(
            `${file}: use generated commands instead of raw invoke`,
          );
      }
    }
  }
  if (
    file.startsWith("src-tauri/src/commands/") &&
    /#\[tauri::command\][\s\S]*?pub\s+fn\s/.test(source)
  )
    failures.push(`${file}: commands must be async`);
  if (
    file.startsWith("src-tauri/src/services/") &&
    source.includes("#[tauri::command]")
  )
    failures.push(`${file}: commands belong in commands/`);
}
const main = fs.readFileSync(path.join(root, "src-tauri/src/main.rs"), "utf8");
if (
  main.trim().split(/\r?\n/).length > 8 ||
  !main.includes("qwriter_lib::run()")
)
  failures.push("main.rs must remain a minimal desktop entry point");
const windows = { default: "main", capture: "capture", pin: "pin" };
const capabilities = Object.entries(windows).map(([name, window]) => {
  const capability = JSON.parse(
    fs.readFileSync(
      path.join(root, `src-tauri/capabilities/${name}.json`),
      "utf8",
    ),
  );
  if (
    capability.remote ||
    capability.local === false ||
    JSON.stringify(capability.windows) !== JSON.stringify([window]) ||
    capability.permissions.some((permission) =>
      /shell:|\*\*/.test(JSON.stringify(permission)),
    )
  )
    failures.push(
      `${name}: capability must be local, limited to its named window and explicit permissions`,
    );
  if (
    name !== "default" &&
    capability.permissions.some((permission) =>
      /^allow-(ai-|agent-|credential-|library-|git-|model-|comfy-|list-models)/.test(
        String(permission),
      ),
    )
  )
    failures.push(
      `${name}: capture windows cannot access writing, AI or credentials`,
    );
  return capability;
});
const registry = fs.readFileSync(
  path.join(root, "src-tauri/src/registry.rs"),
  "utf8",
);
const requiredPermissions = [
  ...registry.matchAll(
    /(?:provider|library|git|streaming|agent|credentials|media|cards|capture)::(\w+)/g,
  ),
].map((match) => `allow-${match[1].replaceAll("_", "-")}`);
for (const permission of requiredPermissions) {
  if (
    !capabilities.some((capability) =>
      capability.permissions.includes(permission),
    )
  )
    failures.push(`Explicit command permission missing: ${permission}`);
}
const config = JSON.parse(
  fs.readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8"),
);
if (
  JSON.stringify(config.app.security.capabilities) !==
  JSON.stringify(Object.keys(windows))
)
  failures.push(
    "Only the reviewed main, capture and pin capabilities may be enabled",
  );
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Architecture checks passed (${files.length} source files; generated bindings excluded from size limit).`,
  );
