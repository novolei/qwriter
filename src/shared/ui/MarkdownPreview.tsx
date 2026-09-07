import Markdown, { type Components } from "react-markdown";
import { createContext, useContext } from "react";
import remarkGfm from "remark-gfm";
import { Image } from "lucide-react";
import { t } from "../i18n";

const ReferenceContext = createContext<Record<string, () => void>>({});
// Stable component identities keep citation buttons mounted while a source modal
// opens, so shared Modal can reliably restore focus to the initiating link.
const components: Components = {
  img: ({ alt }) => (
    <span className="preview-image">
      <Image size={14} />
      {alt || t("图片")}
    </span>
  ),
  a: function ReferenceLink({ children, href }) {
    const references = useContext(ReferenceContext);
    return href && Object.hasOwn(references, href) ? (
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
    );
  },
  input: ({ checked }) => (
    <input type="checkbox" checked={checked} readOnly disabled />
  ),
};

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
      <ReferenceContext.Provider value={references}>
        <Markdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
          {markdown}
        </Markdown>
      </ReferenceContext.Provider>
    </div>
  );
}
