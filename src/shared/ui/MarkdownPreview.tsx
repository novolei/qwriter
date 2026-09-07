import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Image } from "lucide-react";
import { t } from "../i18n";

/** Generated text never runs HTML or fetches model-supplied media in the preview. */
export function MarkdownPreview({
  markdown,
  references = {},
}: {
  markdown: string;
  references?: Record<string, () => void>;
}) {
  return (
    <div className="markdown-preview">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          img: ({ alt }) => (
            <span className="preview-image">
              <Image size={14} />
              {alt || t("图片")}
            </span>
          ),
          a: ({ children, href }) =>
            href && Object.hasOwn(references, href) ? (
              <button
                type="button"
                className="preview-reference"
                onClick={references[href]}
              >
                {children}
              </button>
            ) : (
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
