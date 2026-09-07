import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  Feather,
  Pin,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
import { t, locale } from "../../shared/i18n";
import { AssetView } from "../../shared/media/AssetView";
import { Modal } from "../../shared/ui/Modal";
import { cardTitle, type Card } from "./cards";
import type { useCards } from "./useCards";
import { DraftShelf } from "./DraftShelf";

export function InspirationEntry({
  cards,
  onOpen,
  onNew,
}: {
  cards: Card[];
  onOpen: () => void;
  onNew: () => void;
}) {
  const active = cards.filter((card) => !card.archived);
  return (
    <div className="inspiration-entry">
      <button className="inspiration-stack" onClick={onOpen}>
        <span className="stack-symbol">
          <Feather size={18} />
        </span>
        <span>
          <strong>{t("灵感匣")}</strong>
          <small>
            {active.length
              ? t("{{count}} 个想法，等待发芽", { count: active.length })
              : t("每一个想法，都值得留下")}
          </small>
        </span>
      </button>
      <button aria-label={t("新建速记")} title={t("新建速记")} onClick={onNew}>
        <Plus size={17} />
      </button>
    </div>
  );
}
export function InspirationInbox({
  store,
  onClose,
  onNew,
  onEdit,
  onInsert,
  onScreenshot,
}: {
  store: ReturnType<typeof useCards>;
  onClose: () => void;
  onNew: () => void;
  onEdit: (card: Card) => void;
  onInsert: (card: Card) => Promise<void>;
  onScreenshot: () => void;
}) {
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const cards = store.cards
    .filter(
      (card) =>
        card.archived === archived &&
        `${card.title}\n${card.body}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
    );
  async function insert(card: Card) {
    setPending(card.id);
    try {
      await onInsert(card);
    } finally {
      setPending(null);
    }
  }
  return (
    <Modal
      title={t("灵感匣")}
      eyebrow={t("A PLACE FOR SMALL WONDERS")}
      wide
      className="inspiration-modal"
      onClose={onClose}
    >
      <div className="inbox-heading">
        <p>{t("零碎的念头，也会长成完整的故事。")}</p>
        <div>
          <button className="quiet-button" onClick={onScreenshot}>
            {t("截图")}
          </button>
          <button className="primary" onClick={onNew}>
            <Plus size={16} />
            {t("新建速记")}
          </button>
        </div>
      </div>
      <DraftShelf onEdit={onEdit} />
      <div className="inbox-filters">
        <label>
          <Search size={16} />
          <input
            aria-label={t("搜索灵感")}
            value={search}
            placeholder={t("找回那个想法…")}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button aria-pressed={archived} onClick={() => setArchived(!archived)}>
          <Archive size={15} />
          {t(archived ? "查看全部灵感" : "已归档")}
        </button>
      </div>
      {store.error && (
        <p className="capture-error" role="alert">
          {store.error}
          <button onClick={() => void store.reload()}>{t("重试")}</button>
        </p>
      )}
      {store.loading ? (
        <p role="status">{t("正在打开…")}</p>
      ) : !cards.length ? (
        <div className="inbox-empty">
          <Feather size={32} />
          <h3>
            {t(
              search
                ? "还没有找到这个想法"
                : archived
                  ? "归档的灵感会留在这里"
                  : "留住第一个灵感",
            )}
          </h3>
          <p>{t("随手写、粘贴图片，或捕捉屏幕的一角。")}</p>
          <button className="quiet-button" onClick={onNew}>
            {t("写下一点什么")}
            <ArrowUpRight size={15} />
          </button>
        </div>
      ) : (
        <div className="inspiration-grid">
          {cards.map((card) => (
            <article
              className={`inspiration-card ${card.pinned ? "is-pinned" : ""}`}
              key={card.id}
            >
              <button
                className="card-open"
                aria-label={t("打开灵感 {{title}}", { title: cardTitle(card) })}
                onClick={() => onEdit(card)}
              >
                <span className="card-date">
                  {new Date(card.updatedAt).toLocaleDateString(locale(), {
                    month: "short",
                    day: "numeric",
                  })}
                  {card.pinned && <Pin size={12} />}
                </span>
                <h3>
                  {card.title || card.body.trim()
                    ? cardTitle(card)
                    : t("一份灵感素材")}
                </h3>
                <p>{card.body}</p>
                {card.assetIds[0] && (
                  <div className="card-cover">
                    <AssetView
                      id={card.assetIds[0]}
                      name=""
                      controls={false}
                      video={/\.(mp4|mov|webm)$/.test(card.assetIds[0])}
                    />
                    {card.assetIds.length > 1 && (
                      <span>+{card.assetIds.length - 1}</span>
                    )}
                  </div>
                )}
                {card.sourceUrl && (
                  <small>{new URL(card.sourceUrl).hostname}</small>
                )}
              </button>
              <footer>
                <button
                  title={t(card.pinned ? "取消固定" : "固定这张灵感卡片")}
                  aria-pressed={card.pinned}
                  onClick={() =>
                    void store.update({ ...card, pinned: !card.pinned })
                  }
                >
                  <Pin size={14} />
                </button>
                <button
                  title={t(card.archived ? "恢复灵感" : "归档灵感")}
                  onClick={() =>
                    void store.update({ ...card, archived: !card.archived })
                  }
                >
                  {card.archived ? (
                    <ArchiveRestore size={14} />
                  ) : (
                    <Archive size={14} />
                  )}
                </button>
                <button
                  disabled={pending !== null}
                  className="card-insert"
                  onClick={() => void insert(card)}
                >
                  {t("插入文稿")}
                  <ArrowUpRight size={14} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
      <p className="inbox-shortcuts">
        {t("速记")} <kbd>Ctrl / ⌘ + Alt + N</kbd>
        <span>
          {t("复制后捕捉")} <kbd>Ctrl / ⌘ + Shift + Space</kbd>
        </span>
      </p>
    </Modal>
  );
}
