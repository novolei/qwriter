import { useEffect, useRef, useState } from "react";
import {
  Clipboard,
  ImagePlus,
  Link2,
  LoaderCircle,
  Pin,
  Video,
  X,
  Check,
} from "lucide-react";
import { errorText, t } from "../../shared/i18n";
import { chooseAsset, getAsset, type Asset } from "../../shared/media/assets";
import { AssetView } from "../../shared/media/AssetView";
import { pastePayload, readClipboard } from "../../shared/media/clipboard";
import { saveCard, type Card } from "./cards";
import { useCardDraft } from "./drafts";

export function QuickComposer({
  initial,
  onSaved,
  draftKey,
  onDismiss,
  onScreenshot,
}: {
  initial: Card;
  onSaved: (card: Card) => void;
  draftKey?: string;
  onDismiss: () => void;
  onScreenshot?: () => void;
}) {
  const [card, setCard] = useState(initial);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSource, setShowSource] = useState(!!initial.sourceUrl);
  const draft = useCardDraft(card, draftKey);
  const body = useRef<HTMLTextAreaElement>(null);
  const working = useRef(false);
  useEffect(() => {
    body.current?.focus();
  }, []);
  useEffect(() => {
    let alive = true;
    void Promise.all(card.assetIds.map(getAsset))
      .then((value) => {
        if (alive) setAssets(value);
      })
      .catch((error) => {
        if (alive) setError(errorText(error));
      });
    return () => {
      alive = false;
    };
  }, [card.assetIds]);
  async function task(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(errorText(error));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function attach(kind: "image" | "video") {
    await task(async () => {
      const asset = await chooseAsset(kind);
      if (asset)
        setCard((old) => ({
          ...old,
          assetIds: [...new Set([...old.assetIds, asset.id])].slice(0, 12),
        }));
    });
  }
  async function fromClipboard() {
    await task(async () => {
      const data = await readClipboard();
      append(data);
    });
  }
  function append(data: { text: string; assetIds: string[] }) {
    setCard((old) => ({
      ...old,
      body: [old.body, data.text].filter(Boolean).join("\n\n"),
      assetIds: [...new Set([...old.assetIds, ...data.assetIds])].slice(0, 12),
    }));
  }
  async function save() {
    await task(async () => {
      const result = await saveCard(card);
      draft.clear();
      onSaved(result);
    });
  }
  return (
    <div
      className="quick-composer"
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          void save();
        }
      }}
    >
      <div className="quick-note-meta">
        <span>{t("给转瞬即逝的想法，一个停留的地方")}</span>
        <button
          disabled={busy}
          aria-label={t("固定这张灵感卡片")}
          aria-pressed={card.pinned}
          onClick={() => setCard({ ...card, pinned: !card.pinned })}
        >
          <Pin size={15} />
        </button>
      </div>
      <input
        disabled={busy}
        className="quick-title"
        aria-label={t("速记标题")}
        placeholder={t("标题，留到以后也可以")}
        value={card.title}
        maxLength={240}
        onChange={(event) => setCard({ ...card, title: event.target.value })}
      />
      <textarea
        data-autofocus
        disabled={busy}
        ref={body}
        className="quick-body"
        aria-label={t("速记内容")}
        placeholder={t("一个想法，一句话，或刚刚看见的美好…")}
        value={card.body}
        maxLength={128 * 1024}
        onChange={(event) => setCard({ ...card, body: event.target.value })}
        onPaste={(event) => {
          if (event.clipboardData.files.length) {
            event.preventDefault();
            const data = event.clipboardData;
            void task(async () => append(await pastePayload(data)));
          }
        }}
      />
      {!!assets.length && (
        <div className="quick-attachments">
          {assets.map((asset) => (
            <div className="quick-attachment" key={asset.id}>
              <AssetView
                id={asset.id}
                name={asset.name}
                video={asset.mime.startsWith("video/")}
              />
              <button
                disabled={busy}
                aria-label={t("移除素材 {{name}}", { name: asset.name })}
                onClick={() =>
                  setCard({
                    ...card,
                    assetIds: card.assetIds.filter((id) => id !== asset.id),
                  })
                }
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {showSource && (
        <label className="quick-source">
          <Link2 size={14} />
          <input
            disabled={busy}
            aria-label={t("来源链接")}
            type="url"
            placeholder="https://…"
            value={card.sourceUrl}
            onChange={(event) =>
              setCard({ ...card, sourceUrl: event.target.value })
            }
          />
        </label>
      )}
      <div className="quick-tools">
        <button
          disabled={busy || card.assetIds.length >= 12}
          onClick={() => void attach("image")}
          title={t("添加图片")}
        >
          <ImagePlus size={17} />
        </button>
        <button
          disabled={busy || card.assetIds.length >= 12}
          onClick={() => void attach("video")}
          title={t("添加视频")}
        >
          <Video size={17} />
        </button>
        <button
          disabled={busy}
          onClick={() => void fromClipboard()}
          title={t("从剪贴板捕捉")}
        >
          <Clipboard size={17} />
        </button>
        <button
          disabled={busy}
          aria-pressed={showSource}
          onClick={() => setShowSource(!showSource)}
          title={t("来源链接")}
        >
          <Link2 size={17} />
        </button>
        {onScreenshot && (
          <button disabled={busy} onClick={onScreenshot}>
            {t("截图")}
          </button>
        )}
        <span>
          {card.body.length.toLocaleString()} {t("字符")}
        </span>
      </div>
      {error && (
        <p className="capture-error" role="alert">
          {error}
        </p>
      )}
      <footer className="quick-footer">
        <span>{draft.cached ? t("草稿已暂存") : "Ctrl / ⌘ + Enter"}</span>
        <button disabled={busy} className="quiet-button" onClick={onDismiss}>
          {t("稍后再写")}
        </button>
        <button className="primary" disabled={busy} onClick={() => void save()}>
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Check size={15} />
          )}
          {t("收好灵感")}
        </button>
      </footer>
    </div>
  );
}
