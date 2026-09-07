import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function parseTag(tag) {
  const match =
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(preview|beta|rc)\.[1-9]\d*)?$/.exec(
      tag ?? "",
    );
  if (!match)
    throw new Error("Use vX.Y.Z or vX.Y.Z-preview.N / beta.N / rc.N.");
  return {
    tag,
    version: match.slice(1, 4).join("."),
    prerelease: Boolean(match[4]),
  };
}

export function verifyVersions(version, versions) {
  for (const [name, actual] of Object.entries(versions)) {
    if (actual !== version)
      throw new Error(`${name}: expected ${version}, found ${actual}.`);
  }
}

export async function validate(tag) {
  const release = parseTag(tag);
  const json = async (path) => JSON.parse(await readFile(path, "utf8"));
  const pkg = await json("package.json");
  const lock = await json("package-lock.json");
  const tauri = await json("src-tauri/tauri.conf.json");
  const cargo = await readFile("src-tauri/Cargo.toml", "utf8");
  const cargoLock = await readFile("src-tauri/Cargo.lock", "utf8");
  verifyVersions(release.version, {
    "package.json": pkg.version,
    "package-lock.json": lock.version,
    "package-lock.json root": lock.packages[""].version,
    "tauri.conf.json": tauri.version,
    "Cargo.toml": /\[package\][\s\S]*?\nversion = "([^"]+)"/.exec(cargo)?.[1],
    "Cargo.lock": /\[\[package\]\]\nname = "qwriter"\nversion = "([^"]+)"/.exec(
      cargoLock.replaceAll("\r\n", "\n"),
    )?.[1],
  });
  const notes = await readFile(`docs/releases/${release.version}.md`, "utf8");
  if (!notes.trim()) throw new Error("Release notes must not be empty.");
  return { ...release, notes };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const release = await validate(process.env.RELEASE_TAG);
    console.log(
      `Validated ${release.tag} (${release.prerelease ? "prerelease" : "stable"}).`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
