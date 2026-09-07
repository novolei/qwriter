import GithubSlugger from "github-slugger";
import type { Link, LinkReference } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { t } from "../../shared/i18n";
import type { KnowledgeChunk } from "../../shared/ipc/bindings";

export type PreparedCitations = {
  markdown: string;
  sourceCount: number;
  unresolved: number;
  references: Record<string, KnowledgeChunk>;
};

const parser = unified().use(remarkParse).use(remarkGfm);
// Escape metadata as literal Markdown, including entity/autolink delimiters.
const literal = (text: string) =>
  text
    .replace(/[\r\n]+/g, " ")
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, "\\$&");

export function prepareCitations(
  markdown: string,
  sources: KnowledgeChunk[],
  retain = true,
): PreparedCitations {
  const result: PreparedCitations = {
    markdown,
    sourceCount: 0,
    unresolved: 0,
    references: {},
  };
  if (!markdown.includes("#knowledge-")) return result;
  const tree = parser.parse(markdown);
  const slugger = new GithubSlugger();
  const definitions = new Map<string, string>();
  let closingFence = "";
  visit(tree, (node) => {
    if (node.type === "heading") slugger.slug(toString(node));
    if (node.type === "definition" && !definitions.has(node.identifier))
      definitions.set(node.identifier, node.url);
    // A model may finish a draft with an unclosed fence. Close that fence before
    // the appendix, otherwise valid earlier citations would point into code.
    if (
      node.type === "code" &&
      node.position &&
      !markdown.slice(node.position.end.offset).trim()
    ) {
      const raw = markdown.slice(
        node.position.start.offset,
        node.position.end.offset,
      );
      const lines = raw.split(/\r?\n/);
      const fence = lines[0].match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
      if (
        fence &&
        !lines
          .slice(1)
          .some((line) =>
            new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`).test(
              line,
            ),
          )
      )
        closingFence = fence;
    }
  });
  const available = new Map(sources.map((source) => [source.id, source]));
  const used = new Map<
    string,
    { source: KnowledgeChunk; title: string; hash: string }
  >();
  const patches: { start: number; end: number; text: string }[] = [];
  const section = t("引用来源");
  slugger.slug(section);
  visit(tree, (node) => {
    if (node.type !== "link" && node.type !== "linkReference") return;
    const link: Link | LinkReference = node;
    const url =
      link.type === "link" ? link.url : definitions.get(link.identifier);
    if (!url?.startsWith("#knowledge-")) return;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    let id = url.slice("#knowledge-".length);
    try {
      id = decodeURIComponent(id);
    } catch {
      /* treat malformed IDs as unresolved */
    }
    const source = available.get(id);
    if (source && !used.has(id)) {
      const title = t("来源 {{number}} · {{title}}", {
        number: used.size + 1,
        title: source.title.replace(/[\r\n]+/g, " "),
      });
      used.set(id, { source, title, hash: `#${slugger.slug(title)}` });
    }
    if (!source) result.unresolved++;
    const first = link.children[0]?.position?.start.offset;
    const last = link.children.at(-1)?.position?.end.offset;
    const label =
      first !== undefined && last !== undefined
        ? markdown.slice(first, last)
        : literal(toString(link));
    const citation = used.get(id);
    patches.push({
      start,
      end,
      text:
        retain && citation ? `[${label}](${encodeURI(citation.hash)})` : label,
    });
  });
  for (const patch of patches.sort((a, b) => b.start - a.start))
    result.markdown =
      result.markdown.slice(0, patch.start) +
      patch.text +
      result.markdown.slice(patch.end);
  result.sourceCount = used.size;
  if (!retain || !used.size) return result;
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  const appendix = [
    `## ${literal(section)}`,
    literal(t("以下为引用时的知识片段快照，不代表内容已经核实。")),
  ];
  for (const { source, title, hash } of used.values()) {
    result.references[encodeURI(hash)] = source;
    const location = t("第 {{start}}–{{end}} 行 · 版本 {{revision}}", {
      start: source.startLine,
      end: source.endLine,
      revision: source.revision,
    });
    // A variable fence keeps even Markdown/HTML/code in sources inert and exact.
    const longestFence = Math.max(
      2,
      ...Array.from(source.content.matchAll(/`+/g), (match) => match[0].length),
    );
    const fence = "`".repeat(longestFence + 1);
    appendix.push(
      `### ${literal(title)}`,
      [source.source, source.heading, location]
        .filter(Boolean)
        .map(literal)
        .join(" · "),
      `${fence}text${newline}${source.content}${newline}${fence}`,
    );
  }
  result.markdown += `${closingFence ? newline + closingFence : ""}${newline}${newline}---${newline}${newline}${appendix.join(newline + newline)}${newline}`;
  return result;
}
