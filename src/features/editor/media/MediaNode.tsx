import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { ExternalLink, Globe2, Play } from "lucide-react";
import { AssetView } from "../../../shared/media/AssetView";
import { assetId, openExternal } from "../../../shared/media/assets";
import { t } from "../../../shared/i18n";
import { useState } from "react";

export type MediaContent = {
  kind: "video" | "video-link" | "link";
  url: string;
  title: string;
  description: string;
  poster: string;
};
export function safeMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  if (assetId(value)) return true;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function mediaContent(value: unknown): MediaContent | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (
    !["video", "video-link", "link"].includes(String(data.kind)) ||
    !safeMediaUrl(data.url)
  )
    return null;
  return {
    kind: data.kind as MediaContent["kind"],
    url: data.url,
    title: String(data.title ?? "").slice(0, 240),
    description: String(data.description ?? "").slice(0, 600),
    poster: safeMediaUrl(data.poster) ? data.poster : "",
  };
}

function MediaView({ node, selected }: NodeViewProps) {
  const media = node.attrs as MediaContent;
  const id = assetId(media.url);
  const posterId = assetId(media.poster);
  const [error, setError] = useState(false);
  const playable = media.kind === "video";
  return (
    <NodeViewWrapper
      className={`document-media ${selected ? "selected" : ""}`}
      contentEditable={false}
    >
      {playable ? (
        <div className="document-video">
          {id ? (
            <AssetView id={id} name={media.title} video />
          ) : (
            <video
              src={media.url}
              controls
              preload="none"
              poster={media.poster || undefined}
            />
          )}
        </div>
      ) : (
        <button
          className="document-link-card"
          onClick={() => {
            void openExternal(media.url).catch(() => setError(true));
          }}
        >
          <span className="link-card-art">
            {posterId ? (
              <AssetView id={posterId} name="" />
            ) : media.poster ? (
              <img src={media.poster} alt="" referrerPolicy="no-referrer" />
            ) : (
              <Globe2 size={27} />
            )}
            {media.kind === "video-link" && (
              <span className="video-badge">
                <Play size={16} />
              </span>
            )}
          </span>
          <span className="link-card-copy">
            <strong>{media.title || media.url}</strong>
            <span>{media.description}</span>
            <small>
              {new URL(media.url).hostname}
              <ExternalLink size={12} />
            </small>
          </span>
        </button>
      )}
      {playable && (
        <div className="media-caption">{media.title || t("视频")}</div>
      )}
      {error && <small role="alert">{t("无法打开外部链接")}</small>}
    </NodeViewWrapper>
  );
}

export const MediaNode = Node.create({
  name: "mediaCard",
  group: "block",
  atom: true,
  draggable: true,
  priority: 1100,
  addAttributes() {
    return {
      kind: { default: "link" },
      url: { isRequired: true },
      title: { default: "" },
      description: { default: "" },
      poster: { default: "" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-qwriter-media]",
        getAttrs: (element) => {
          try {
            return (
              mediaContent(
                JSON.parse(
                  (element as HTMLElement).getAttribute("data-qwriter-media") ||
                    "null",
                ),
              ) || false
            );
          } catch {
            return false;
          }
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-qwriter-media": JSON.stringify(node.attrs),
      }),
      ["a", { href: node.attrs.url }, node.attrs.title || node.attrs.url],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaView);
  },
  markdownTokenName: "code",
  parseMarkdown(token, helpers) {
    if (token.lang !== "qwriter-media") return [];
    try {
      const attrs = mediaContent(JSON.parse(token.text || "null"));
      return attrs ? helpers.createNode("mediaCard", attrs) : [];
    } catch {
      return [];
    }
  },
  renderMarkdown(node) {
    return `\`\`\`qwriter-media\n${JSON.stringify(node.attrs)}\n\`\`\``;
  },
});
