import Link from "@tiptap/extension-link";
import { mergeAttributes } from "@tiptap/core";

// Contenteditable anchors are not keyboard focusable by default in WebView2.
// Add a DOM-only tab stop for internal destinations, retaining Link's parsing,
// URL validation, commands and Markdown serializer.
export const DocumentLink = Link.extend({
  renderHTML(props) {
    const { HTMLAttributes } = props;
    const internal =
      typeof HTMLAttributes.href === "string" &&
      HTMLAttributes.href.startsWith("#");
    // Delegate rendering too: the upstream renderer checks isAllowedUri and
    // strips unsafe destinations from imported Markdown/JSON.
    return (
      this.parent?.({
        ...props,
        HTMLAttributes: mergeAttributes(
          HTMLAttributes,
          internal ? { tabindex: 0 } : {},
        ),
      }) ?? ["a", {}, 0]
    );
  },
});
