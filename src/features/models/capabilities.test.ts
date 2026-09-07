import { expect, it } from "vitest";
import { modelCapabilities, normalizeCapabilities } from "./capabilities";
import { serializeWorkspace, normalizeWorkspace } from "./persistence";
import { exportBackup, parseBackup } from "./backup/format";

it("preserves explicit capabilities in persistence and backup without inventing vision", () => {
  const caps = normalizeCapabilities({
    vision: "supported",
    tools: "unsupported",
    reasoning: "deepseek",
    contextWindow: 65536,
    apiKey: "must-not-persist",
  });
  const workspace = {
    version: 1 as const,
    providers: [
      {
        id: "p",
        name: "Service",
        kind: "Custom",
        baseUrl: "http://localhost:8000/v1",
        protocol: "openai",
      },
    ],
    models: [
      {
        id: "m",
        providerId: "p",
        model: "model",
        name: "Model",
        enabled: true,
        capabilities: caps,
      },
    ],
    selected: "m",
  };
  const saved = serializeWorkspace(workspace);
  expect(saved).not.toContain("must-not-persist");
  expect(normalizeWorkspace(JSON.parse(saved))?.models[0].capabilities).toEqual(
    caps,
  );
  expect(
    parseBackup(exportBackup(workspace)).workspace.models[0].capabilities,
  ).toEqual(caps);
  expect(
    normalizeCapabilities({ contextWindow: -2, vision: "yes" }),
  ).toMatchObject({ vision: "unknown", contextWindow: 32768 });
});
it("verification establishes only tool use and is scoped to its connection", () => {
  const model = {
    id: "m",
    providerId: "p",
    model: "x",
    name: "x",
    enabled: true,
    verification: {
      at: 1,
      baseUrl: "http://localhost:1",
      protocol: "openai",
      tools: true,
    },
  };
  expect(
    modelCapabilities(model, {
      id: "p",
      name: "p",
      kind: "custom",
      baseUrl: "http://localhost:1",
      protocol: "openai",
    }),
  ).toMatchObject({ tools: "supported", vision: "unknown" });
  expect(modelCapabilities(model)).toMatchObject({
    tools: "unknown",
    vision: "unknown",
  });
  expect(
    modelCapabilities(
      {
        ...model,
        capabilities: normalizeCapabilities({ tools: "unsupported" }),
      },
      {
        id: "p",
        name: "p",
        kind: "custom",
        baseUrl: "http://localhost:1",
        protocol: "openai",
      },
    ).tools,
  ).toBe("unsupported");
});
