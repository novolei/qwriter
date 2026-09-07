import { cp, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
const target = path.resolve("public/ocr");
async function copyChanged(source, destination) {
  const existing = await readFile(destination).catch(() => null);
  if (existing && existing.equals(await readFile(source))) return;
  await cp(source, destination);
}
await mkdir(path.join(target, "core"), { recursive: true });
await mkdir(path.join(target, "lang"), { recursive: true });
await copyChanged(
  "node_modules/tesseract.js/dist/worker.min.js",
  path.join(target, "worker.min.js"),
);
for (const file of await readdir("node_modules/tesseract.js-core")) {
  if (file.endsWith(".wasm") || file.endsWith(".wasm.js") || file === "LICENSE")
    await copyChanged(
      path.join("node_modules/tesseract.js-core", file),
      path.join(target, "core", file),
    );
}
for (const language of ["eng", "chi_sim"]) {
  const source = `node_modules/@tesseract.js-data/${language}`;
  await copyChanged(
    `${source}/4.0.0/${language}.traineddata.gz`,
    path.join(target, "lang", `${language}.traineddata.gz`),
  );
}
await copyChanged(
  "node_modules/tesseract.js/LICENSE.md",
  path.join(target, "LICENSE-TESSERACT"),
);
console.log("Offline Chinese/English OCR runtime prepared.");
