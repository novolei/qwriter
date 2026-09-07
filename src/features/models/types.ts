import type { Config } from "../../shared/types";
import type { ModelCapabilities } from "../../shared/ipc/bindings";

export type Provider = {
  id: string;
  name: string;
  kind: string;
  baseUrl: string;
  protocol: string;
  credentialOrigin?: string;
  catalog?: string[];
  discoveredAt?: number;
};
export type PoolModel = {
  capabilities?: ModelCapabilities;
  id: string;
  providerId: string;
  model: string;
  name: string;
  enabled: boolean;
  verification?: {
    at: number;
    baseUrl: string;
    protocol: string;
    tools: boolean;
  };
};
export type ModelWorkspace = {
  version: 1;
  providers: Provider[];
  models: PoolModel[];
  selected: string;
};
export type ProviderPreset = Omit<Config, "provider" | "apiKey">;
