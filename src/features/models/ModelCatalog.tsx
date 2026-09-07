import { Check, Plus, Search } from "lucide-react";
import { useState } from "react";
import { t } from "../../shared/i18n/index";
import type { Provider } from "./types";
import type { useModels } from "./useModels";

export function ModelCatalog({
  provider,
  store,
}: {
  provider: Provider;
  store: ReturnType<typeof useModels>;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const added = new Set(
    store.models
      .filter((m) => m.providerId === provider.id)
      .map((m) => m.model),
  );
  const pending = selected.filter(
    (id) => !added.has(id) && provider.catalog?.includes(id),
  );
  const matches = (provider.catalog ?? []).filter((id) =>
    id.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const shown = matches.slice(0, 60);
  function add(ids: string[], alias?: string) {
    store.addModels(provider.id, ids, alias);
    setSelected([]);
    setNotice(t("已加入模型池，可在写作面板中切换"));
  }
  return (
    <div className="model-catalog">
      {(provider.catalog?.length ?? 0) > 0 && (
        <>
          <div className="catalog-search">
            <Search size={14} />
            <input
              aria-label={t("筛选发现的模型")}
              placeholder={t("筛选模型…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div
            className="catalog-list"
            role="group"
            aria-label={t("可添加的模型")}
          >
            {shown.map((id) => (
              <label key={id} className={added.has(id) ? "is-added" : ""}>
                <input
                  type="checkbox"
                  checked={added.has(id) || selected.includes(id)}
                  disabled={added.has(id)}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, id]
                        : old.filter((m) => m !== id),
                    )
                  }
                />
                <span title={id}>{id}</span>
                {added.has(id) && (
                  <small>
                    <Check size={11} />
                    {t("已添加")}
                  </small>
                )}
              </label>
            ))}
            {!shown.length && <p>{t("没有匹配的模型")}</p>}
          </div>
          {matches.length > 60 && (
            <small className="connection-help">
              {t("显示前 60 个结果，请输入名称缩小范围。")}
            </small>
          )}
          <div className="catalog-actions">
            <small>
              {t("发现 {{count}} 个模型，选择需要的加入模型池", {
                count: provider.catalog?.length,
              })}
            </small>
            <button
              className="primary"
              disabled={!pending.length}
              onClick={() => add(pending)}
            >
              <Plus size={13} />
              {t("添加所选（{{count}}）", { count: pending.length })}
            </button>
          </div>
        </>
      )}
      <details
        className="connection-advanced"
        open={!provider.catalog?.length || undefined}
      >
        <summary>
          <Plus size={14} />
          {t("手动添加模型")}
        </summary>
        <div>
          <small>{t("没有模型列表的服务，也可以通过模型 ID 添加。")}</small>
          <div className="connection-field-grid">
            <label>
              {t("模型 ID")}
              <input
                value={manual}
                spellCheck={false}
                placeholder="model-id"
                onChange={(e) => setManual(e.target.value)}
              />
            </label>
            <label>
              {t("显示名称（可选）")}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("例如：日常写作")}
              />
            </label>
          </div>
          <button
            className="connection-action"
            disabled={!manual.trim() || added.has(manual.trim())}
            onClick={() => {
              add([manual], name);
              setManual("");
              setName("");
            }}
          >
            <Plus size={14} />
            {t(added.has(manual.trim()) ? "模型已在池中" : "加入模型池")}
          </button>
        </div>
      </details>
      {notice && (
        <p className="model-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
