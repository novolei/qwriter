import { openDB, type DBSchema } from "idb";
import type { Asset, Card } from "../ipc/bindings";

interface CaptureDatabase extends DBSchema {
  assets: { key: string; value: { asset: Asset; blob: Blob } };
  cards: { key: string; value: Card };
}
let database: ReturnType<typeof openDB<CaptureDatabase>> | undefined;
export function captureDatabase() {
  database ??= openDB<CaptureDatabase>("qwriter.captures", 1, {
    upgrade(db) {
      db.createObjectStore("assets", { keyPath: "asset.id" });
      db.createObjectStore("cards", { keyPath: "id" });
    },
  });
  return database;
}
