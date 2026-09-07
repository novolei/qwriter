import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { validate } from "./validate.mjs";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

export async function collectAssets(directory, version) {
  const files = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(join(path, entry.name));
      else if (entry.isFile() && /\.(exe|dmg)$/.test(entry.name)) {
        files.push({
          name: entry.name,
          data: await readFile(join(path, entry.name)),
        });
      }
    }
  }
  await walk(directory);
  const expected = [
    `Qwriter_${version}_x64-setup.exe`,
    `Qwriter_${version}_universal.dmg`,
  ];
  if (
    files.length !== 2 ||
    expected.some((name) => files.filter((f) => f.name === name).length !== 1)
  ) {
    throw new Error(
      "Exactly one Windows installer and one macOS universal DMG are required.",
    );
  }
  if (files.some((file) => file.data.length === 0))
    throw new Error("Empty installer.");
  files.sort((a, b) => a.name.localeCompare(b.name));
  const checksums = files
    .map((file) => `${sha256(file.data)}  ${file.name}\n`)
    .join("");
  files.push({ name: "SHA256SUMS.txt", data: Buffer.from(checksums) });
  return files;
}

export function verifyAsset(remote, local) {
  if (
    remote.state !== "uploaded" ||
    remote.size !== local.data.length ||
    remote.digest !== `sha256:${sha256(local.data)}`
  ) {
    throw new Error(
      `Release asset differs or is incomplete: ${local.name}. Existing files will not be overwritten.`,
    );
  }
}

export async function publish({
  repository,
  token,
  source,
  buildUrl,
  release,
  files,
  fetcher = fetch,
}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? ""))
    throw new Error("Invalid GITHUB_REPOSITORY.");
  if (!token) throw new Error("GH_TOKEN is required.");
  if (!/^[a-f0-9]{40}$/.test(source ?? ""))
    throw new Error("An exact source commit SHA is required.");
  const base = `https://api.github.com/repos/${repository}`;
  async function request(url, method = "GET", body, binary = false) {
    const response = await fetcher(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": binary
          ? "application/octet-stream"
          : "application/json",
      },
      body:
        body === undefined ? undefined : binary ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    if (response.status === 404 && method === "GET") return null;
    if (!response.ok)
      throw new Error(`GitHub ${method} failed (HTTP ${response.status}).`);
    return response.json();
  }
  const commit = await request(
    `${base}/commits/${encodeURIComponent(release.tag)}`,
  );
  if (commit?.sha !== source)
    throw new Error(
      "Remote release tag does not match the installer source commit.",
    );
  let remote = await request(
    `${base}/releases/tags/${encodeURIComponent(release.tag)}`,
  );
  const body = `${release.notes.trim()}\n\n---\nSource: ${source}\nBuild: ${buildUrl ?? "local verified artifacts"}\n`;
  if (!remote) {
    remote = await request(`${base}/releases`, "POST", {
      tag_name: release.tag,
      target_commitish: source,
      name: `Qwriter ${release.tag.slice(1)}`,
      body,
      draft: true,
      prerelease: release.prerelease,
      make_latest: "false",
    });
  }
  if (remote.prerelease !== release.prerelease)
    throw new Error("Existing release channel differs.");
  const existing = remote.assets ?? [];
  if (
    existing.some((asset) => !files.some((file) => file.name === asset.name))
  ) {
    throw new Error("Release contains unexpected assets; review it manually.");
  }
  for (const file of files) {
    const asset = existing.find((entry) => entry.name === file.name);
    if (asset) {
      verifyAsset(asset, file);
      continue;
    }
    if (!remote.draft)
      throw new Error(
        "Published releases are never modified. Use a new version.",
      );
    const upload = new URL(remote.upload_url.split("{")[0]);
    if (upload.origin !== "https://uploads.github.com")
      throw new Error("Unexpected upload host.");
    upload.searchParams.set("name", file.name);
    verifyAsset(await request(upload.href, "POST", file.data, true), file);
    console.log(`Uploaded and verified ${file.name}.`);
  }
  if (remote.draft) {
    remote = await request(`${base}/releases/${remote.id}`, "PATCH", {
      body,
      draft: false,
      prerelease: release.prerelease,
      make_latest: release.prerelease ? "false" : "legacy",
    });
  }
  return remote.html_url;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const release = await validate(process.env.RELEASE_TAG);
    const files = await collectAssets(
      process.argv[2] ?? "release-assets",
      release.version,
    );
    console.log(
      await publish({
        repository: process.env.GITHUB_REPOSITORY,
        token: process.env.GH_TOKEN,
        source: process.env.RELEASE_SOURCE_SHA,
        buildUrl: process.env.RELEASE_BUILD_URL,
        release,
        files,
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
