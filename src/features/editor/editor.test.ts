import { Editor } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { expect, it } from "vitest";
it("preserves Chinese, tables, task lists and code through Markdown conversion", () => {
  const source =
    '# 中文文稿\n\n| 名称 | 状态 |\n| --- | --- |\n| Qwriter | 开发中 |\n\n- [x] 保存\n- [ ] 继续写作\n\n```rust\nlet text = "文字";\n```';
  const editor = new Editor({
    extensions: [StarterKit, TableKit, TaskList, TaskItem, Markdown],
    content: source,
    contentType: "markdown",
  });
  const result = editor.getMarkdown();
  expect(result).toContain("中文文稿");
  expect(result).toContain("| Qwriter | 开发中 |");
  expect(result).toContain("- [x] 保存");
  expect(result).toContain("- [ ] 继续写作");
  expect(result).toContain("```rust");
  expect(result).toContain('let text = "文字";');
  editor.destroy();
});
