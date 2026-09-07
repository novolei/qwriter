import type { Document, ModelConfig } from "./ipc/bindings";
export type { Snapshot } from "./ipc/bindings";
export type Doc = Document;
export type Config = ModelConfig & { provider: string };
export type Profile = Config & {
  id: string;
  name: string;
  capabilities?: import("./ipc/bindings").ModelCapabilities;
};
export type WriteMode = "replace" | "append" | "feedback";
