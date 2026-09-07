import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { captureDatabase } from "../../shared/media/database";
import { loadCards, newCard, saveCard } from "./cards";
describe("inspiration persistence", () => {
  it("persists, pins and archives without deleting the original text", async () => {
    const first = await saveCard(
      newCard({ text: "一闪而过的灵感\nA fleeting idea" }),
    );
    const pinned = await saveCard({ ...first, pinned: true });
    const archived = await saveCard({ ...pinned, archived: true });
    expect((await loadCards()).find((card) => card.id === first.id)).toEqual(
      archived,
    );
    expect(archived.body).toBe(first.body);
    const restored = await saveCard({ ...archived, archived: false });
    expect(restored.createdAt).toBe(first.createdAt);
  });
  it("rejects concurrent stale revisions and empty or unsafe sources", async () => {
    const original = await saveCard(newCard({ text: "Original" }));
    const results = await Promise.allSettled([
      saveCard({ ...original, body: "Window A" }),
      saveCard({ ...original, body: "Window B" }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    await expect(saveCard(newCard())).rejects.toThrow("写下一点想法");
    await expect(
      saveCard(newCard({ assetIds: [`${"e".repeat(64)}.png`] })),
    ).rejects.toThrow("找不到此素材");
    await expect(
      saveCard({
        ...newCard({ text: "reference" }),
        sourceUrl: "javascript:alert(1)",
      }),
    ).rejects.toThrow();
  });
  it("stores media blobs independently of card lifetimes", async () => {
    const db = await captureDatabase();
    const id = `${"b".repeat(64)}.png`;
    await db.put("assets", {
      asset: {
        id,
        name: "capture.png",
        mime: "image/png",
        size: 3,
        width: 1,
        height: 1,
      },
      blob: new Blob(["png"], { type: "image/png" }),
    });
    const card = await saveCard(newCard({ assetIds: [id] }));
    await saveCard({ ...card, archived: true });
    expect((await db.get("assets", id))?.asset.name).toBe("capture.png");
  });
});
