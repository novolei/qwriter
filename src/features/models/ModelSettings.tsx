import { Check, Plus, Server, Trash2 } from "lucide-react";
import { useState } from "react";
import { t } from "../../shared/i18n/index";
import { Modal } from "../../shared/ui/Modal";
import { Select } from "../../shared/ui/Select";
import type { useModels } from "./useModels";
import { ProviderEditor } from "./ProviderEditor";
import { ModelPool } from "./ModelPool";
import { ModelBackupPanel } from "./backup/ModelBackupPanel";

export function ModelSettings({
  models: store,
  onClose,
  onAppearance,
}: {
  models: ReturnType<typeof useModels>;
  onClose: () => void;
  onAppearance: () => void;
}) {
  const [page, setPage] = useState<"providers" | "pool" | "backup">(
    "providers",
  );
  const [active, setActive] = useState(
    () =>
      store.models.find((m) => m.id === store.config.id)?.providerId ??
      store.providers[0]?.id ??
      "",
  );
  const [removing, setRemoving] = useState(false);
  const provider =
    store.providers.find((p) => p.id === active) ?? store.providers[0];
  const count = store.models.filter(
    (m) => m.providerId === provider?.id,
  ).length;
  return (
    <Modal
      settings
      title={t("模型与连接")}
      eyebrow={t("MAKE IT YOURS")}
      onClose={onClose}
      className="model-settings"
    >
      <p>{t("让不同的模型，陪伴不同的创作。")}</p>
      <div className="settings-tabs">
        <button className="chosen" aria-current="page">
          {t("模型连接")}
        </button>
        <button onClick={onAppearance}>{t("外观与字体")}</button>
      </div>
      <div
        className="model-page-tabs"
        role="group"
        aria-label={t("模型管理视图")}
      >
        <button
          aria-pressed={page === "providers"}
          onClick={() => setPage("providers")}
        >
          {t("供应商")}
          <span>{store.providers.length}</span>
        </button>
        <button aria-pressed={page === "pool"} onClick={() => setPage("pool")}>
          {t("我的模型池")}
          <span>{store.models.length}</span>
        </button>
        <button
          aria-pressed={page === "backup"}
          onClick={() => setPage("backup")}
        >
          {t("备份与迁移")}
        </button>
      </div>
      {page === "providers" ? (
        <>
          <div className="profile-picker">
            <Server size={16} />
            <Select
              aria-label={t("选择供应商连接")}
              value={provider?.id ?? "__none__"}
              onValueChange={(id) => {
                setActive(id);
                setRemoving(false);
              }}
            >
              {!provider && (
                <option value="__none__" disabled>
                  {t("尚无供应商")}
                </option>
              )}
              {store.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || t(p.kind)}
                </option>
              ))}
            </Select>
            <button
              title={t("添加供应商")}
              onClick={() => {
                setActive(store.addProvider());
                setRemoving(false);
              }}
            >
              <Plus size={16} />
            </button>
            <button
              title={t("移除供应商")}
              disabled={!provider}
              onClick={() => setRemoving(!removing)}
            >
              <Trash2 size={15} />
            </button>
          </div>
          {removing && provider && (
            <div className="provider-remove" role="alert">
              <p>
                {t(
                  "移除此供应商及其 {{count}} 个模型？已保存的密钥也会移除，文稿不受影响。",
                  { count },
                )}
              </p>
              <div>
                <button onClick={() => setRemoving(false)}>{t("取消")}</button>
                <button
                  disabled={store.credentials.busy.includes(provider.id)}
                  onClick={() =>
                    void store.removeProvider(provider.id).then((done) => {
                      if (done) setRemoving(false);
                    })
                  }
                >
                  {t("确认移除")}
                </button>
              </div>
            </div>
          )}
          {provider ? (
            <ProviderEditor
              key={provider.id}
              provider={provider}
              store={store}
            />
          ) : (
            <div className="model-empty">
              <Server size={22} />
              <p>{t("连接一个服务，让灵感开始生长")}</p>
              <button
                className="primary"
                onClick={() => setActive(store.addProvider())}
              >
                {t("添加供应商")}
              </button>
            </div>
          )}
        </>
      ) : page === "pool" ? (
        <ModelPool store={store} onAdd={() => setPage("providers")} />
      ) : (
        <ModelBackupPanel store={store} />
      )}
      {store.error && <p role="alert">{t(store.error)}</p>}
      <div className="connection-footer">
        <small>
          <Check size={13} />
          {t("模型池与配置自动保存在本机")}
        </small>
        <button className="primary" onClick={onClose}>
          {t("完成")}
        </button>
      </div>
    </Modal>
  );
}
