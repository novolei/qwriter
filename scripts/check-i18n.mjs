import fs from "node:fs";
import path from "node:path";
import { root } from "./runtime.mjs";
import { auditCatalogs, auditSource } from "./lib/i18n-audit.mjs";

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const { failures, catalogs } = auditCatalogs(
  read("src/shared/i18n/locales/zh-CN.json"),
  read("src/shared/i18n/locales/en.json"),
);
function walk(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) walk(file);
    else if (
      /\.tsx?$/.test(file) &&
      !file.includes(".test.") &&
      file !== "src/shared/ipc/bindings.ts"
    )
      failures.push(...auditSource(file, read(file), catalogs));
  }
}
walk("src");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "i18n checks passed (catalogs, interpolation, static keys and Chinese JSX).",
  );
