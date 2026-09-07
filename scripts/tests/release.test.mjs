import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseTag, verifyVersions } from "../release/validate.mjs";
import { collectAssets, publish } from "../release/publish.mjs";

test("release tags distinguish channels and reject ambiguous versions", () => {
  assert.equal(parseTag("v0.2.0").prerelease, false);
  assert.equal(parseTag("v0.2.0-preview.1").prerelease, true);
  for (const tag of [
    "v01.2.0",
    "latest",
    "v0.2",
    "v0.2.0-preview.0",
    "v0.2.0+build",
  ]) {
    assert.throws(() => parseTag(tag));
  }
  assert.throws(() => verifyVersions("0.2.0", { rust: "0.1.0" }));
});

test("asset collection refuses partial platform builds and includes checksums", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwriter-release-"));
  try {
    await writeFile(join(dir, "Qwriter_0.2.0_x64-setup.exe"), "windows");
    await assert.rejects(collectAssets(dir, "0.2.0"), /Exactly one/);
    await writeFile(join(dir, "Qwriter_0.2.0_universal.dmg"), "mac");
    const files = await collectAssets(dir, "0.2.0");
    assert.equal(files.length, 3);
    assert.match(
      files[2].data.toString(),
      /[a-f0-9]{64}  Qwriter_0.2.0_universal.dmg/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function fixture({ existing, failUpload = false, wrongCommit = false } = {}) {
  const files = [{ name: "setup.exe", data: Buffer.from("installer") }];
  const remoteAsset = {
    name: files[0].name,
    state: "uploaded",
    size: files[0].data.length,
    digest: `sha256:${createHash("sha256").update(files[0].data).digest("hex")}`,
  };
  const remote = {
    id: 1,
    draft: true,
    prerelease: true,
    assets: [],
    upload_url:
      "https://uploads.github.com/repos/test/qwriter/releases/1/assets{?name}",
    html_url: "https://github.com/test/qwriter/releases/tag/v0.2.0-preview.1",
    ...existing,
  };
  const calls = [];
  const options = {
    repository: "test/qwriter",
    token: "test-placeholder",
    source: "a".repeat(40),
    release: { ...parseTag("v0.2.0-preview.1"), notes: "Test release" },
    files,
    fetcher: async (url, request) => {
      calls.push({ url, ...request });
      if (url.includes("/commits/"))
        return Response.json({ sha: (wrongCommit ? "b" : "a").repeat(40) });
      if (url.includes("/releases/tags/"))
        return existing
          ? Response.json(remote)
          : new Response(null, { status: 404 });
      if (url.startsWith("https://uploads.github.com")) {
        return failUpload
          ? new Response(null, { status: 503 })
          : Response.json(remoteAsset);
      }
      return Response.json(remote);
    },
  };
  return { options, calls, remoteAsset };
}

test("release remains a draft when an upload fails", async () => {
  const { options, calls } = fixture({ failUpload: true });
  await assert.rejects(publish(options), /HTTP 503/);
  assert.equal(
    calls.some((call) => call.method === "PATCH"),
    false,
  );
  assert.equal(
    JSON.parse(calls.find((call) => call.method === "POST").body).draft,
    true,
  );
});

test("release publishes only after verified upload", async () => {
  const { options, calls } = fixture();
  await publish(options);
  assert.equal(calls.at(-1).method, "PATCH");
  assert.equal(JSON.parse(calls.at(-1).body).draft, false);
  assert.equal(JSON.parse(calls.at(-1).body).make_latest, "false");
});

test("source mismatch prevents release creation", async () => {
  const { options, calls } = fixture({ wrongCommit: true });
  await assert.rejects(publish(options), /source commit/);
  assert.equal(calls.length, 1);
});

test("published releases are immutable and identical retries are read-only", async () => {
  const first = fixture({ existing: { draft: false } });
  await assert.rejects(publish(first.options), /never modified/);
  assert.equal(
    first.calls.every((call) => call.method === "GET"),
    true,
  );
  const same = fixture({
    existing: { draft: false, assets: [first.remoteAsset] },
  });
  await publish(same.options);
  assert.equal(
    same.calls.every((call) => call.method === "GET"),
    true,
  );
  const changed = fixture({
    existing: { assets: [{ ...first.remoteAsset, digest: "sha256:wrong" }] },
  });
  await assert.rejects(publish(changed.options), /will not be overwritten/);
});
