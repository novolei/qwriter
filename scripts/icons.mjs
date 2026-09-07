import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Feather } from "lucide-react";
import { nodeTool } from "./runtime.mjs";

const tokens = JSON.parse(
  await readFile("src/shared/brand/tokens.json", "utf8"),
);
const size = 512;
const glyph = size * tokens.glyphRatio;
// Reuse the actual Lucide source component; never trace or approximate its paths.
const feather = renderToStaticMarkup(
  createElement(Feather, {
    x: (size - glyph) / 2,
    y: (size - glyph) / 2,
    width: glyph,
    height: glyph,
    color: tokens.foreground,
    strokeWidth: 2,
  }),
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size * tokens.radiusRatio}" fill="${tokens.background}"/>${feather}</svg>\n`;
await writeFile("app-icon.svg", svg);
await writeFile("public/favicon.svg", svg);
await nodeTool(
  "@tauri-apps/cli/tauri.js",
  "icon",
  "app-icon.svg",
  "--output",
  "src-tauri/icons",
);
await copyFile("src-tauri/icons/32x32.png", "public/favicon-32.png");
await copyFile(
  "node_modules/lucide-react/LICENSE",
  "public/licenses/Lucide.txt",
);
console.log(
  "Qwriter Feather: sidebar, browser, Windows and macOS use the same source icon.",
);
