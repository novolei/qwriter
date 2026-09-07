import { describe, expect, it } from "vitest";
import { exportBackup, parseBackup, BACKUP_LIMIT } from "./format";
import { planImport } from "./merge";
import type { ModelWorkspace } from "../types";

export const sample: ModelWorkspace = {
  version: 1,
  providers: [
    {
      id: "p",
      name: "My provider",
      kind: "OpenAI",
      baseUrl: "https://example.com/v1",
      protocol: "openai",
      credentialOrigin: "https://example.com",
      catalog: ["old"],
      discoveredAt: 1,
    },
  ],
  models: [
    {
      id: "m",
      providerId: "p",
      model: "model-a",
      name: "Writing",
      enabled: true,
      verification: {
        at: 1,
        baseUrl: "https://example.com/v1",
        protocol: "openai",
        tools: true,
      },
    },
  ],
  selected: "m",
};
describe("model configuration backups", () => {
  it("whitelists nested fields and never transfers credentials or claimed verification", () => {
    const contaminated = {
      ...sample,
      apiKey: "TOP_SECRET",
      providers: [{ ...sample.providers[0], apiKey: "NESTED_SECRET" }],
    };
    const json = exportBackup(contaminated);
    expect(json).not.toMatch(
      /SECRET|credentialOrigin|verification|catalog|discoveredAt/,
    );
    const backup = parseBackup(json);
    expect(backup.workspace.models[0].model).toBe("model-a");
    expect(backup.workspace.selected).toBe("m");
    const injected = JSON.parse(json);
    injected.workspace.providers[0].credentialOrigin = "https://example.com";
    expect(
      parseBackup(JSON.stringify(injected)).workspace.providers[0]
        .credentialOrigin,
    ).toBeUndefined();
  });
  it("rejects unsupported, oversized, dangling and duplicate records before mutation", () => {
    const json = exportBackup(sample);
    expect(() => parseBackup("x".repeat(BACKUP_LIMIT + 1))).toThrow(/2 MB/);
    expect(() => parseBackup("{")).toThrow();
    expect(() =>
      parseBackup(json.replace('"version": 1', '"version": 9')),
    ).toThrow();
    for (const change of [
      { models: [{ ...sample.models[0], providerId: "unknown" }] },
      { providers: [sample.providers[0], sample.providers[0]] },
      { models: [sample.models[0], { ...sample.models[0], id: "other" }] },
    ])
      expect(() => exportBackup({ ...sample, ...change })).toThrow();
    for (const baseUrl of [
      "https://user:secret@example.com",
      "https://example.com?key=secret",
      "file:///tmp/config",
      "https://example.com/#secret",
    ]) {
      expect(() =>
        exportBackup({
          ...sample,
          providers: [{ ...sample.providers[0], baseUrl }],
        }),
      ).toThrow();
    }
  });
  it("preserves current model, gives copied accounts fresh IDs and skips repeated imports", () => {
    const backup = parseBackup(exportBackup(sample));
    expect(planImport(sample, backup, "skip").providersAdded).toBe(0);
    const copy = planImport(sample, backup, "copy");
    expect(copy.workspace.selected).toBe("m");
    expect(copy.workspace.providers[1].id).not.toBe("p");
    expect(copy.workspace.providers[1].credentialOrigin).toBeUndefined();
    expect(copy.workspace.providers[1].name).toBe("My provider (2)");
    expect(copy.workspace.models[1].verification).toBeUndefined();
    const different = {
      ...sample,
      models: [{ ...sample.models[0], model: "another" }],
    };
    const renamed = planImport(different, backup, "skip");
    expect(renamed.providersAdded).toBe(1);
    expect(planImport(renamed.workspace, backup, "skip").providersAdded).toBe(
      0,
    );
  });
  it("chooses the imported primary only when no existing enabled model is selected", () => {
    const result = planImport(
      { version: 1, providers: [], models: [], selected: "" },
      parseBackup(exportBackup(sample)),
      "skip",
    );
    expect(result.workspace.selected).toBe(result.workspace.models[0].id);
  });
});
