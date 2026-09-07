import { ChevronDown, PlugZap, LoaderCircle } from "lucide-react";
import { t } from "../../shared/i18n/index";
import { Select } from "../../shared/ui/Select";
import type { Provider } from "./types";
import { presets, type useModels } from "./useModels";
import { CredentialFields } from "./CredentialFields";
import { ModelCatalog } from "./ModelCatalog";
import { ConnectionStatus } from "./ConnectionStatus";
import { useConnection } from "./useConnection";
import { credentialOrigin } from "./connection";

export function ProviderEditor({
  provider: p,
  store,
}: {
  provider: Provider;
  store: ReturnType<typeof useModels>;
}) {
  const connection = useConnection(
    {
      id: p.id,
      name: p.name,
      provider: p.kind,
      baseUrl: p.baseUrl,
      protocol: p.protocol,
      apiKey: store.credentials.value(p),
      model: "",
    },
    {
      onDiscover: (data) =>
        store.recordDiscovery(
          p,
          data.data.map((m) => m.id),
        ),
    },
  );
  return (
    <>
      <section className="connection-section">
        <div className="connection-section-title">
          <span>01</span>
          <h3>{t("供应商连接")}</h3>
        </div>
        <div className="connection-field-grid">
          <label>
            {t("模型服务")}
            <Select
              value={p.kind}
              onValueChange={(kind) =>
                store.updateProvider({
                  ...p,
                  kind,
                  ...presets[kind],
                  name: p.name === p.kind ? kind : p.name,
                })
              }
            >
              {Object.keys(presets).map((kind) => (
                <option key={kind} value={kind}>
                  {t(kind)}
                </option>
              ))}
            </Select>
          </label>
          <label>
            {t("连接名称")}
            <input
              value={p.name}
              onChange={(e) =>
                store.updateProvider({ ...p, name: e.target.value })
              }
            />
          </label>
        </div>
        <details className="connection-advanced">
          <summary>
            <ChevronDown size={14} />
            {t("服务地址与协议")}
            <span>{credentialOrigin(p.baseUrl)}</span>
          </summary>
          <div>
            <label>
              API Base URL
              <input
                type="url"
                value={p.baseUrl}
                spellCheck={false}
                onChange={(e) =>
                  store.updateProvider({ ...p, baseUrl: e.target.value.trim() })
                }
              />
            </label>
            <label>
              {t("协议")}
              <Select
                value={p.protocol}
                onValueChange={(protocol) =>
                  store.updateProvider({ ...p, protocol })
                }
              >
                <option value="openai">
                  {t("OpenAI Chat Completions 兼容")}
                </option>
                <option value="anthropic">Anthropic Messages</option>
              </Select>
            </label>
            <small>
              {t(
                "更换服务或地址的域名时，会清空会话密钥；已保存密钥保持原来源绑定。",
              )}
            </small>
          </div>
        </details>
      </section>
      <CredentialFields provider={p} store={store} />
      <section className="connection-section connection-models">
        <div className="connection-discover">
          <div className="connection-section-title">
            <span>03</span>
            <h3>{t("发现并添加模型")}</h3>
          </div>
          <button
            className="connection-action"
            disabled={
              !!connection.busy || store.credentials.busy.includes(p.id)
            }
            onClick={() => void connection.run("discover")}
          >
            {connection.busy ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <PlugZap size={15} />
            )}
            {t("连接并获取模型")}
          </button>
        </div>
        <small className="connection-help">
          {t("仅检查连接与鉴权，不发送你的文稿。")}
        </small>
        <ConnectionStatus connection={connection} />
        {!!p.discoveredAt && !connection.models && (
          <small className="connection-help">
            {t("显示上次保存的模型列表，可刷新以检查当前可用性。")}
          </small>
        )}
        <ModelCatalog provider={p} store={store} />
      </section>
    </>
  );
}
