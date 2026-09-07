import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  Clipboard,
  Globe2,
  ImagePlus,
  LoaderCircle,
  Video,
} from "lucide-react";
import { commands, type Asset } from "../../../shared/ipc/bindings";
import { chooseAsset, assetReference } from "../../../shared/media/assets";
import { AssetView } from "../../../shared/media/AssetView";
import { readClipboard } from "../../../shared/media/clipboard";
import { Select } from "../../../shared/ui/Select";
import { Modal } from "../../../shared/ui/Modal";
import { errorText, t } from "../../../shared/i18n";
import { assetMarkdown, mediaMarkdown } from "./content";
import { mediaContent, type MediaContent } from "./MediaNode";

export function MediaDialog({
  initial,
  onInsert,
  onClose,
  target,
}: {
  initial?: Asset;
  onInsert: (markdown: string) => Promise<void>;
  onClose: () => void;
  target: string;
}) {
  const [asset, setAsset] = useState(initial);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<MediaContent | null>(null);
  const [caption, setCaption] = useState(initial?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const work = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const close = () => {
    alive.current = false;
    onClose();
  };
  async function task(action: () => Promise<void>) {
    if (work.current) return;
    work.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      if (alive.current) setError(errorText(error));
    } finally {
      work.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function select(value: Asset) {
    setAsset(value);
    setCaption(value.name);
    setPreview(null);
  }
  async function resolveLink() {
    const parsed = mediaContent({
      kind: /\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "link",
      url: url.trim(),
      title: "",
      description: "",
      poster: "",
    });
    if (!parsed || !/^https?:\/\//i.test(parsed.url))
      throw new Error("请输入有效的链接地址");
    parsed.title = new URL(parsed.url).hostname;
    setAsset(undefined);
    setHint("");
    if (isTauri()) {
      try {
        const data = await commands.linkPreview(parsed.url);
        Object.assign(parsed, {
          url: data.url,
          title: data.title,
          description: data.description,
          kind:
            data.kind === "video-file"
              ? "video"
              : data.kind === "video"
                ? "video-link"
                : "link",
          poster: data.thumbnail ? assetReference(data.thumbnail.id) : "",
        });
      } catch {
        setHint(t("暂时无法读取网页预览，可以编辑标题后插入链接卡片。"));
      }
    } else setHint(t("网页缩略图自动解析在桌面版可用；这里可以创建链接卡片。"));
    if (alive.current) {
      setPreview(parsed);
      setCaption(parsed.title);
    }
  }
  return (
    <Modal
      title={t("素材与链接")}
      eyebrow={t("COLLECT & CREATE")}
      onClose={close}
      className="media-dialog"
    >
      <p className="capture-intro">{t("让文字与画面，一起讲述。")}</p>
      <div className="media-choices">
        {(
          [
            { kind: "image", icon: ImagePlus, label: "本地图片" },
            { kind: "video", icon: Video, label: "本地视频" },
          ] as const
        ).map((item) => (
          <button
            key={item.kind}
            disabled={busy}
            onClick={() =>
              void task(async () => {
                const selected = await chooseAsset(item.kind);
                if (selected && alive.current) select(selected);
              })
            }
          >
            <item.icon size={22} />
            <strong>{t(item.label)}</strong>
            <small>
              {item.kind === "image"
                ? "PNG · JPEG · WebP · GIF"
                : "MP4 · WebM · MOV"}
            </small>
          </button>
        ))}
      </div>
      <div className="media-url">
        <Globe2 size={17} />
        <input
          aria-label={t("网站或视频链接")}
          placeholder={t("粘贴网站或视频链接…")}
          value={url}
          disabled={busy}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void task(resolveLink);
          }}
        />
        <button
          disabled={busy || !url.trim()}
          onClick={() => void task(resolveLink)}
        >
          {t("获取预览")}
        </button>
      </div>
      <button
        className="quiet-button"
        disabled={busy}
        onClick={() =>
          void task(async () => {
            const data = await readClipboard();
            if (data.assetIds.length) {
              const { getAsset } = await import("../../../shared/media/assets");
              select(await getAsset(data.assetIds[0]));
            } else if (data.text.trim()) {
              setUrl(data.text.trim());
              setHint(t("链接已填入，请点击获取预览。"));
            }
          })
        }
      >
        <Clipboard size={15} />
        {t("从剪贴板捕捉")}
      </button>
      {asset && (
        <div className="media-preview">
          <AssetView
            id={asset.id}
            name={caption}
            video={asset.mime.startsWith("video/")}
          />
          <small>
            {(asset.size / 1024 / 1024).toFixed(2)} MB ·{" "}
            {t("素材已存入本地资料库")}
          </small>
        </div>
      )}
      {preview && (
        <div className="media-link-preview">
          {preview.poster.startsWith("qwriter-asset://") && (
            <AssetView id={preview.poster.slice(16)} name="" />
          )}
          <strong>{caption}</strong>
          <p>{preview.description}</p>
          <small>{new URL(preview.url).hostname}</small>
          <button
            className="quiet-button"
            disabled={busy}
            onClick={() =>
              void task(async () => {
                const cover = await chooseAsset("image");
                if (cover && alive.current)
                  setPreview((value) =>
                    value
                      ? { ...value, poster: assetReference(cover.id) }
                      : value,
                  );
              })
            }
          >
            <ImagePlus size={15} />
            {t(preview.poster ? "更换卡片封面" : "添加卡片封面")}
          </button>
          <label>
            {t("卡片类型")}
            <Select
              aria-label={t("卡片类型")}
              value={preview.kind}
              onValueChange={(value) =>
                setPreview({ ...preview, kind: value as MediaContent["kind"] })
              }
            >
              <option value="link">{t("网站链接")}</option>
              <option value="video-link">{t("视频页面")}</option>
              <option value="video">{t("视频直链")}</option>
            </Select>
          </label>
        </div>
      )}
      {(asset || preview) && (
        <label className="capture-field">
          {t("标题或图片说明")}
          <input
            value={caption}
            maxLength={240}
            aria-label={t("标题或图片说明")}
            onChange={(event) => setCaption(event.target.value)}
          />
        </label>
      )}
      {hint && (
        <p className="capture-hint" role="status">
          {hint}
        </p>
      )}
      {error && (
        <p className="capture-error" role="alert">
          {error}
        </p>
      )}
      <footer className="capture-dialog-footer">
        <small>{t("插入到 {{title}}", { title: target })}</small>
        <button
          className="primary"
          disabled={busy || (!asset && !preview)}
          onClick={() =>
            void task(async () => {
              const markdown = asset
                ? assetMarkdown(asset, caption)
                : mediaMarkdown({ ...preview!, title: caption });
              await onInsert(markdown);
              close();
            })
          }
        >
          {busy && <LoaderCircle size={15} className="spin" />}
          {t("插入文稿")}
        </button>
      </footer>
    </Modal>
  );
}
