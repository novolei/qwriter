import { useEffect, useState } from "react";
import { FileEdit } from "lucide-react";
import { t } from "../../shared/i18n";
import { cardTitle, type Card } from "./cards";
import { recoverAllDrafts } from "./drafts";
export function DraftShelf({ onEdit }: { onEdit: (card: Card) => void }) {
  const [drafts, setDrafts] = useState(recoverAllDrafts);
  useEffect(() => {
    const update = () => setDrafts(recoverAllDrafts());
    update();
    window.addEventListener("qwriter-drafts-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("qwriter-drafts-changed", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  if (!drafts.length) return null;
  return (
    <div className="draft-shelf">
      <small>{t("接着写，想法还在这里")}</small>
      <div>
        {drafts.map((card) => (
          <button key={card.id} onClick={() => onEdit(card)}>
            <FileEdit size={15} />
            <span>{t(cardTitle(card))}</span>
            <small>{t("草稿")}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
