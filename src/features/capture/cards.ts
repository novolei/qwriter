import { isTauri } from "@tauri-apps/api/core";
import { commands, type Card } from "../../shared/ipc/bindings";
import { captureDatabase } from "../../shared/media/database";
export type { Card } from "../../shared/ipc/bindings";

export function newCard(seed?: { text?: string; assetIds?: string[] }): Card {
  const text = seed?.text ?? "";
  return {
    id: crypto.randomUUID(),
    title: "",
    body: text,
    assetIds: seed?.assetIds ?? [],
    sourceUrl: /^https?:\/\/\S+$/.test(text.trim()) ? text.trim() : "",
    pinned: false,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    revision: 0,
  };
}
export function cardTitle(card: Card) {
  return (
    card.title ||
    card.body.trim().split(/\r?\n/)[0]?.slice(0, 60) ||
    "一份灵感素材"
  );
}
export function validCard(card: Card) {
  if (!card.title.trim() && !card.body.trim() && !card.assetIds.length)
    throw new Error("写下一点想法，或添加一份素材");
  if (
    card.body.length > 128 * 1024 ||
    card.title.length > 240 ||
    card.assetIds.length > 12
  )
    throw new Error("速记内容无效或超过大小限制");
  if (card.sourceUrl) {
    let url: URL;
    try {
      url = new URL(card.sourceUrl);
    } catch {
      throw new Error("请输入有效的链接地址");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("请输入有效的链接地址");
  }
}
export async function loadCards(): Promise<Card[]> {
  if (isTauri()) return commands.cardsList();
  return (await (await captureDatabase()).getAll("cards")).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}
export async function saveCard(card: Card): Promise<Card> {
  validCard(card);
  if (isTauri()) return commands.cardSave(card);
  const db = await captureDatabase();
  const assets = await Promise.all(
    card.assetIds.map((id) => db.get("assets", id)),
  );
  if (assets.some((asset) => !asset)) throw new Error("找不到此素材");
  const tx = db.transaction("cards", "readwrite");
  const before = await tx.store.get(card.id);
  if ((before?.revision ?? 0) !== card.revision) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error("这张卡片已在另一个窗口更新，请重新打开后编辑");
  }
  const saved = {
    ...card,
    updatedAt: Date.now(),
    createdAt: before?.createdAt ?? Date.now(),
    revision: card.revision + 1,
  };
  await tx.store.put(saved);
  await tx.done;
  window.dispatchEvent(new Event("qwriter-cards-changed"));
  const channel = new BroadcastChannel("qwriter-cards");
  channel.postMessage("changed");
  channel.close();
  return saved;
}

export async function subscribeCards(
  onChange: () => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import("@tauri-apps/api/event");
    return listen("cards-changed", onChange);
  }
  const channel = new BroadcastChannel("qwriter-cards");
  channel.onmessage = onChange;
  window.addEventListener("qwriter-cards-changed", onChange);
  return () => {
    channel.close();
    window.removeEventListener("qwriter-cards-changed", onChange);
  };
}
