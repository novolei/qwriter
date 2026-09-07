import { isTauri } from "@tauri-apps/api/core";
import { Eye, EyeOff, KeyRound, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { t } from "../../shared/i18n/index";
import { credentialOrigin } from "./connection";
import type { Provider } from "./types";
import type { useModels } from "./useModels";

export function CredentialFields({
  provider,
  store,
}: {
  provider: Provider;
  store: ReturnType<typeof useModels>;
}) {
  const [visible, setVisible] = useState(false);
  const c = store.credentials;
  const value = c.value(provider);
  const busy = c.busy.includes(provider.id);
  const saved =
    provider.credentialOrigin === credentialOrigin(provider.baseUrl) &&
    c.source(provider) === "system";
  return (
    <div className="credential-fields">
      <div className="connection-section-title">
        <span>02</span>
        <h3>{t("访问密钥")}</h3>
        <small>{t(saved ? "已由系统安全保存" : "仅本次会话")}</small>
      </div>
      <label htmlFor="provider-api-key">API Key</label>
      <div className="connection-key-input">
        <KeyRound size={15} aria-hidden="true" />
        <input
          id="provider-api-key"
          type={visible ? "text" : "password"}
          value={value}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          disabled={busy}
          placeholder={t(
            ["Ollama", "LM Studio"].includes(provider.kind)
              ? "本地模型通常无需填写"
              : "粘贴服务商提供的 API Key",
          )}
          onChange={(e) => c.setKey(provider, e.target.value)}
        />
        <button
          aria-label={t(visible ? "隐藏 API Key" : "显示 API Key")}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <div className="credential-actions">
        <button
          disabled={busy || !value || saved || !isTauri()}
          onClick={() => void c.operation(provider, "save")}
        >
          <LockKeyhole size={13} />
          {t(saved ? "系统已记住密钥" : "记住密钥")}
        </button>
        {provider.credentialOrigin && (
          <button
            disabled={busy}
            onClick={() => void c.operation(provider, "forget")}
          >
            {t("改为仅本次会话")}
          </button>
        )}
        {provider.credentialOrigin && !value && (
          <button
            disabled={busy}
            onClick={() => void c.operation(provider, "load")}
          >
            {t("重新读取密钥")}
          </button>
        )}
      </div>
      <small className="connection-help">
        {t(
          isTauri()
            ? "记住后存入 Windows 凭据管理器或 macOS 钥匙串；不会写入模型配置文件。"
            : "当前为浏览器预览；系统保存与连接验证请在桌面版使用。",
        )}
      </small>
      {c.errors[provider.id] && (
        <p className="credential-error" role="alert">
          {t(c.errors[provider.id])}
        </p>
      )}
    </div>
  );
}
