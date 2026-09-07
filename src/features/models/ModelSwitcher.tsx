import { Command } from "cmdk";
import { Check, ChevronDown, Search, Settings, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "../../shared/i18n/index";
import { Modal } from "../../shared/ui/Modal";
import type { useModels } from "./useModels";

export function ModelSwitcher({
  store,
  disabled,
  onSettings,
}: {
  store: ReturnType<typeof useModels>;
  disabled: boolean;
  onSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const options = store.models.filter(
    (m) =>
      m.enabled &&
      `${m.name} ${m.model} ${store.providers.find((p) => p.id === m.providerId)?.name}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const first = options[0]?.id ?? "";
  const initial =
    !query && options.some((m) => m.id === store.config.id)
      ? store.config.id
      : first;
  useEffect(() => {
    setSelected(initial);
  }, [query, initial]);
  const provider = store.providers.find(
    (p) =>
      p.id === store.models.find((m) => m.id === store.config.id)?.providerId,
  );
  return (
    <>
      <button
        className="model-selector pool-switch-trigger"
        disabled={disabled}
        aria-label={t("切换写作模型")}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t(
          disabled ? "当前任务使用已选模型，结束后可切换" : "从模型池快速切换",
        )}
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        <Sparkles size={13} />
        <strong>{store.config.name || t("选择模型")}</strong>
        <span>{provider?.name ?? t("配置供应商")}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <Modal
          title={t("选择写作伙伴")}
          eyebrow={t("YOUR MODEL LIBRARY")}
          className="model-switch-dialog"
          onClose={() => setOpen(false)}
        >
          <Command
            shouldFilter={false}
            label={t("搜索并切换模型")}
            value={selected}
            onValueChange={setSelected}
          >
            <div className="catalog-search">
              <Search size={15} />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={t("搜索名称、模型或供应商…")}
              />
            </div>
            <Command.List>
              {store.providers.map((p) => {
                const entries = options.filter((m) => m.providerId === p.id);
                return entries.length ? (
                  <Command.Group key={p.id} heading={p.name}>
                    {entries.map((m) => (
                      <Command.Item
                        key={m.id}
                        value={m.id}
                        onSelect={() => {
                          store.select(m.id);
                          setOpen(false);
                        }}
                      >
                        <div>
                          <strong>{m.name || m.model}</strong>
                          <small>{m.model}</small>
                        </div>
                        {m.id === store.config.id && <Check size={15} />}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null;
              })}
              {!options.length && (
                <Command.Empty>
                  {t("没有匹配的模型，请先在模型池中添加或启用。")}
                </Command.Empty>
              )}
            </Command.List>
          </Command>
          <button
            className="model-manage-link"
            onClick={() => {
              setOpen(false);
              window.setTimeout(onSettings, 0);
            }}
          >
            <Settings size={14} />
            {t("管理供应商与模型池")}
          </button>
        </Modal>
      )}
    </>
  );
}
