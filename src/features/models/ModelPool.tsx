import { Check, Search, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { t } from "../../shared/i18n/index";
import type { PoolModel, Provider } from "./types";
import type { useModels } from "./useModels";
import { useConnection } from "./useConnection";
import { ConnectionStatus } from "./ConnectionStatus";

type Store = ReturnType<typeof useModels>;
function PoolRow({
  model,
  provider,
  store,
}: {
  model: PoolModel;
  provider: Provider;
  store: Store;
}) {
  const connection = useConnection(store.resolve(model), {
    onVerify: (data) =>
      store.recordVerification(provider, model.model, data.toolsSupported),
  });
  const current = model.id === store.config.id;
  return (
    <div className={`pool-model ${current ? "is-current" : ""}`}>
      <div className="pool-model-heading">
        <div>
          <strong>{model.name || model.model}</strong>
          <small>
            {provider.name} · {model.model}
          </small>
        </div>
        {current && (
          <span className="pool-current">
            <Check size={12} />
            {t("当前")}
          </span>
        )}
      </div>
      <div className="pool-model-controls">
        <button
          className="connection-action"
          disabled={current || !model.enabled}
          onClick={() => store.select(model.id)}
        >
          {t(current ? "正在使用" : "切换到此模型")}
        </button>
        <button
          disabled={
            !!connection.busy || store.credentials.busy.includes(provider.id)
          }
          onClick={() => void connection.run("verify")}
        >
          <Sparkles size={13} />
          {t("验证 Agent")}
        </button>
        <button
          aria-label={t("移除模型 {{name}}", { name: model.name })}
          onClick={() => store.removeModel(model.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <details className="connection-advanced">
        <summary>
          {t("名称与使用偏好")}
          {model.verification && (
            <span>
              {t(
                model.verification.tools
                  ? "曾通过 Agent 验证"
                  : "工具调用尚未确认",
              )}
            </span>
          )}
        </summary>
        <div>
          <label>
            {t("显示名称")}
            <input
              value={model.name}
              onChange={(e) =>
                store.updateModel({ ...model, name: e.target.value })
              }
            />
          </label>
          <label className="pool-enabled">
            <input
              type="checkbox"
              checked={model.enabled}
              onChange={(e) =>
                store.updateModel({ ...model, enabled: e.target.checked })
              }
            />
            {t("在快捷切换菜单中显示")}
          </label>
          {model.verification && (
            <small>
              {t("上次验证：{{time}}", {
                time: new Date(model.verification.at).toLocaleString(),
              })}
            </small>
          )}
        </div>
      </details>
      <ConnectionStatus connection={connection} />
    </div>
  );
}

export function ModelPool({
  store,
  onAdd,
}: {
  store: Store;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState("");
  const items = store.models.filter((m) =>
    `${m.name} ${m.model} ${store.providers.find((p) => p.id === m.providerId)?.name}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="model-pool">
      <p className="model-pool-hint">
        {t(
          "供应商配置共享，模型独立管理。切换仅影响下一次任务，正在运行的任务保持原模型。",
        )}
      </p>
      <div className="catalog-search">
        <Search size={14} />
        <input
          aria-label={t("搜索模型池")}
          placeholder={t("搜索名称、模型或供应商…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <small className="connection-help">
        {t("验证使用内置素材，不发送你的文稿；可能产生少量 API 费用。")}
      </small>
      <div className="pool-model-list">
        {items.map((m) => {
          const p = store.providers.find((p) => p.id === m.providerId);
          return p ? (
            <PoolRow key={m.id} model={m} provider={p} store={store} />
          ) : null;
        })}
      </div>
      {!items.length && (
        <div className="model-empty">
          <Sparkles size={22} />
          <p>
            {t(
              store.models.length
                ? "没有匹配的模型"
                : "为你的写作，添加第一位伙伴",
            )}
          </p>
          <button onClick={onAdd}>{t("前往供应商添加模型")}</button>
        </div>
      )}
    </div>
  );
}
