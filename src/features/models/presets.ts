import type { ProviderPreset } from "./types";

/** Provider defaults describe transports. The live catalog owns available model IDs. */
export const presets: Record<string, ProviderPreset> = {
  Ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: "qwen3:8b",
    protocol: "openai",
  },
  "LM Studio": {
    baseUrl: "http://localhost:1234/v1",
    model: "",
    protocol: "openai",
  },
  DeepSeek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-v4-flash",
    protocol: "openai",
  },
  OpenAI: {
    baseUrl: "https://api.openai.com/v1",
    model: "",
    protocol: "openai",
  },
  Anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    model: "",
    protocol: "anthropic",
  },
  Gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "",
    protocol: "openai",
  },
  通义千问: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "",
    protocol: "openai",
  },
  自定义兼容服务: { baseUrl: "", model: "", protocol: "openai" },
};
