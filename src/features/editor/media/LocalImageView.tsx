import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { AssetView } from "../../../shared/media/AssetView";
import { assetId } from "../../../shared/media/assets";
import { lazy, Suspense, useState } from "react";
import { t } from "../../../shared/i18n";
import { useTranslation } from "react-i18next";
import { imageReplacement } from "./image-replacement";
const ImagePreview = lazy(() =>
  import("./ImagePreview").then((m) => ({ default: m.ImagePreview })),
);

export function LocalImageView({
  node,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  // Tiptap node views render independently of the application language state.
  useTranslation();
  const id = assetId(node.attrs.src);
  const [preview, setPreview] = useState<{
    source: string;
    apply: (id: string) => void;
  } | null>(null);
  const open = () =>
    setPreview({
      source: node.attrs.src,
      apply: imageReplacement(editor, getPos, node.attrs.src),
    });
  return (
    <NodeViewWrapper
      as="figure"
      className={`document-image ${selected ? "selected" : ""}`}
      contentEditable={false}
      tabIndex={0}
      title={t("双击预览与编辑图片")}
      onDoubleClick={(event: React.MouseEvent) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        event.preventDefault();
        open();
      }}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault();
          open();
        }
      }}
    >
      {id ? (
        <AssetView id={id} name={node.attrs.alt ?? ""} />
      ) : (
        <img
          src={node.attrs.src}
          alt={node.attrs.alt ?? ""}
          title={node.attrs.title ?? undefined}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
      {node.attrs.alt && (
        <figcaption contentEditable={false}>{node.attrs.alt}</figcaption>
      )}
      {preview && (
        <Suspense fallback={null}>
          <ImagePreview
            source={preview.source}
            name={node.attrs.alt ?? ""}
            onApply={preview.apply}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      )}
    </NodeViewWrapper>
  );
}
