import { expect, it } from "vitest";
import { publicProfiles } from "./useModels";
it("never serializes session keys into profile persistence", () => {
  const stored = JSON.stringify(
    publicProfiles([
      {
        id: "test",
        name: "私有模型",
        provider: "custom",
        baseUrl: "https://example.com/v1",
        model: "m",
        protocol: "openai",
        apiKey: "SECRET_TEST_ONLY",
      },
    ]),
  );
  expect(stored).not.toContain("SECRET_TEST_ONLY");
  expect(stored).not.toContain("apiKey");
  expect(stored).toContain("私有模型");
});
