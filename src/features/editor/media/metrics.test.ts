import { expect, it } from "vitest";
import { mediaMarkdown } from "./content";
import { documentCharacters } from "./metrics";
it("counts visible writing without inflating it with media metadata", () => {
  const card = mediaMarkdown({
    kind: "video",
    url: `qwriter-asset://${"a".repeat(64)}.mp4`,
    title: "视频",
    description: "",
    poster: "",
  });
  expect(
    documentCharacters(
      `# 标题\n\n![图片](qwriter-asset://${"b".repeat(64)}.png)\n\n${card}`,
    ),
  ).toBe(6);
  expect(documentCharacters("# Hello\n\n**world**")).toBe(10);
  expect(documentCharacters("```qwriter-media\ninvalid\n```")).toBeGreaterThan(
    0,
  );
});
