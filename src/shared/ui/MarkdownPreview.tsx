import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Image } from "lucide-react";

/** Generated text never runs HTML or fetches model-supplied media in the preview. */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className="markdown-preview">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          img: ({ alt }) => (
            <span className="preview-image">
              <Image size={14} />
              {alt || "Image"}
            </span>
          ),
          a: ({ children, href }) => (
            <span className="preview-link" title={href}>
              {children}
            </span>
          ),
          input: ({ checked }) => (
            <input type="checkbox" checked={checked} readOnly disabled />
          ),
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
