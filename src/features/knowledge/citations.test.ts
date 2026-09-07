import { afterEach, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { changeLanguage } from "../../shared/i18n";
import { knowledgeChunk as source } from "../../test/fixtures/knowledge";
import { prepareCitations } from "./citations";

afterEach(() => changeLanguage("zh-CN"));

it("rewrites only real Markdown citations, deduplicates used sources and preserves unrelated bytes", () => {
  const citation = `[**观察**](#knowledge-${source.id})`;
  const prefix = `# **原稿**\r\n\r\n  保留  空格\r\n\r\n\`[literal](#knowledge-${source.id})\`\r\n\r\n`;
  const code = `\n\n\`\`\`md\n${citation}\n\`\`\``;
  const original = `${prefix}${citation} 与 [再次参考][REF]\n\n[ref]: #knowledge-${source.id}${code}`;
  const unused = { ...source, id: "unused", content: "Do not include this" };
  const prepared = prepareCitations(original, [source, unused]);
  expect(prepared.sourceCount).toBe(1);
  expect(prepared.markdown.startsWith(prefix)).toBe(true);
  expect(prepared.markdown).toContain(code);
  expect(prepared.markdown).not.toContain(unused.content);
  expect(prepared.markdown).toContain(source.content);
  expect(prepared.markdown).toContain("版本 3");
  expect(Object.values(prepared.references)).toEqual([source]);
  const tree = unified().use(remarkParse).parse(prepared.markdown);
  const links: string[] = [];
  visit(tree, "link", (node) => {
    links.push(node.url);
  });
  expect(links).toEqual(Array(2).fill(Object.keys(prepared.references)[0]));
  expect(prepareCitations(prepared.markdown, [source]).markdown).toBe(
    prepared.markdown,
  );
});

it("reserves duplicate heading IDs and keeps unsafe source material literal", () => {
  const unsafe = {
    ...source,
    title: "**Garden** <img> &copy;",
    content:
      "````\n![image](https://example.com/tracker)\n<script>alert(1)</script>\n````",
  };
  const prepared = prepareCitations(`[read](#knowledge-${source.id})`, [
    unsafe,
  ]);
  const tree = unified().use(remarkParse).parse(prepared.markdown);
  const types: string[] = [];
  const contents: string[] = [];
  visit(tree, (node) => {
    types.push(node.type);
    if (node.type === "code") contents.push(node.value);
  });
  expect(types).not.toContain("html");
  expect(types).not.toContain("image");
  expect(contents).toEqual([unsafe.content]);
  const repeated = prepareCitations(
    `### 来源 1 · 花园观察 Garden\n\n### 来源 1 · 花园观察 Garden\n\n[read](#knowledge-${source.id})`,
    [source],
  );
  expect(decodeURI(Object.keys(repeated.references)[0])).toBe(
    "#来源-1--花园观察-garden-2",
  );
});

it("removes unresolved and opted-out internal links without inventing evidence", async () => {
  await changeLanguage("en");
  const markdown = `[real](#knowledge-${source.id}) [**unknown**](#knowledge-fake) [bad](#knowledge-%XX)`;
  const removed = prepareCitations(markdown, [source], false);
  expect(removed.markdown).toBe("real **unknown** bad");
  expect(removed.unresolved).toBe(2);
  expect(removed.sourceCount).toBe(1);
  expect(removed.references).toEqual({});
  const kept = prepareCitations(markdown, [source]);
  expect(kept.markdown).toContain("## Sources");
  expect(kept.markdown).toContain("Lines 3–5 · Revision 3");
  expect(kept.markdown).not.toContain("#knowledge-");
  expect(kept.markdown).toContain("**unknown** bad");
});

it("leaves documents without knowledge links byte-for-byte intact", () => {
  const markdown =
    "# Test\r\n\r\n[text](#test)\r\n\r\n[web](https://example.com)\r\n";
  expect(prepareCitations(markdown, [source]).markdown).toBe(markdown);
});

it("keeps the appendix outside an unfinished code fence in a generated draft", () => {
  const markdown = `[read](#knowledge-${source.id})\n\n~~~md\nunfinished code`;
  const prepared = prepareCitations(markdown, [source]);
  const tree = unified().use(remarkParse).parse(prepared.markdown);
  const headings: string[] = [];
  visit(tree, "heading", (node) => {
    headings.push(
      node.children
        .map((child) => ("value" in child ? child.value : ""))
        .join(""),
    );
  });
  expect(headings).toContain("引用来源");
  expect(prepared.markdown).toContain("~~~md\nunfinished code\n~~~\n\n---");
});
