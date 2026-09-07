import {
  ArrowDownToLine,
  Check,
  FileJson,
  FolderOpen,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorText, t } from "../../../shared/i18n";
import { Select } from "../../../shared/ui/Select";
import type { useModels } from "../useModels";
import {
  BACKUP_LIMIT,
  exportBackup,
  parseBackup,
  type ModelBackup,
} from "./format";
import { planImport, type DuplicatePolicy } from "./merge";
import { saveBackupFile } from "./files";

export function ModelBackupPanel({
  store,
}: {
  store: ReturnType<typeof useModels>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [candidate, setCandidate] = useState<ModelBackup | null>(null);
  const [policy, setPolicy] = useState<DuplicatePolicy>("skip");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  let plan: ReturnType<typeof planImport> | null = null;
  let planError = "";
  if (candidate) {
    try {
      plan = planImport(store, candidate, policy);
    } catch (reason) {
      planError = errorText(reason);
    }
  }
  async function read(file?: File) {
    if (!file) return;
    const attempt = ++generation.current;
    setBusy(true);
    setCandidate(null);
    setNotice("");
    setError("");
    try {
      if (file.size > BACKUP_LIMIT) throw new Error("模型备份不能超过 2 MB");
      const parsed = parseBackup(await file.text());
      if (attempt !== generation.current) return;
      setCandidate(parsed);
      setFileName(file.name);
    } catch (reason) {
      if (attempt === generation.current) setError(errorText(reason));
    } finally {
      if (attempt === generation.current) setBusy(false);
    }
  }
  async function download() {
    const attempt = ++generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const json = exportBackup(store);
      const result = await saveBackupFile(json);
      if (attempt === generation.current) {
        setNotice(
          t(
            result === "saved"
              ? "模型配置备份已保存"
              : result === "downloaded"
                ? "已开始下载模型配置备份"
                : "已取消导出",
          ),
        );
      }
    } catch (reason) {
      if (attempt === generation.current) setError(errorText(reason));
    } finally {
      if (attempt === generation.current) setBusy(false);
    }
  }
  function apply() {
    if (!candidate || busy) return;
    try {
      const imported = store.importBackup(candidate, policy);
      setCandidate(null);
      setError("");
      setNotice(
        t("已导入 {{providers}} 个供应商、{{models}} 个模型", {
          providers: imported.providersAdded,
          models: imported.modelsAdded,
        }),
      );
    } catch (reason) {
      setError(errorText(reason));
    }
  }
  return (
    <section
      className="model-backup"
      aria-label={t("备份与迁移")}
      aria-busy={busy}
    >
      <div className="backup-intro">
        <span className="backup-symbol">
          <ShieldCheck size={22} strokeWidth={1.5} />
        </span>
        <div>
          <h3>{t("把熟悉的创作伙伴，带到新设备")}</h3>
          <p>{t("只携带连接与模型配置，密钥留在原设备。")}</p>
        </div>
      </div>
      <div className="backup-actions">
        <button
          onClick={() => void download()}
          disabled={busy || !store.providers.length}
        >
          <ArrowDownToLine size={18} />
          <span>
            <strong>{t("导出模型配置")}</strong>
            <small>{t("保存一份不含密钥的 JSON 备份")}</small>
          </span>
        </button>
        <button onClick={() => input.current?.click()} disabled={busy}>
          <FolderOpen size={18} />
          <span>
            <strong>{t("选择备份文件")}</strong>
            <small>{t("先预览，再决定是否导入")}</small>
          </span>
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        aria-label={t("模型备份文件")}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void read(file);
        }}
      />
      <p className="backup-safety">
        {t(
          "导入会创建独立连接，不关联原设备的密钥或验证状态，也不会自动请求模型。",
        )}
      </p>
      {candidate && (
        <div className="backup-preview">
          <div className="backup-file">
            <FileJson size={17} />
            <strong>{fileName}</strong>
            <button disabled={busy} onClick={() => setCandidate(null)}>
              {t("取消导入")}
            </button>
          </div>
          <label>
            {t("遇到相同配置时")}
            <Select
              value={policy}
              onValueChange={(value) => setPolicy(value as DuplicatePolicy)}
              disabled={busy}
            >
              <option value="skip">{t("跳过相同配置")}</option>
              <option value="copy">{t("创建独立副本")}</option>
            </Select>
          </label>
          <p className="backup-safety">
            {t("同名连接自动编号；现有配置和当前模型保持不变。")}
          </p>
          {plan && (
            <>
              <ul className="backup-rows" aria-label={t("待导入的供应商")}>
                {plan.rows.map((row, index) => (
                  <li key={index} className={row.skipped ? "is-skipped" : ""}>
                    <div>
                      <strong>{row.name}</strong>
                      <small>{row.baseUrl || t("尚未配置服务地址")}</small>
                    </div>
                    <span>
                      {row.skipped
                        ? t("已存在，跳过")
                        : t("{{count}} 个模型", { count: row.models })}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="backup-confirm">
                <p>
                  {t("将新增 {{providers}} 个供应商、{{models}} 个模型", {
                    providers: plan.providersAdded,
                    models: plan.modelsAdded,
                  })}
                </p>
                <button
                  className="primary"
                  disabled={busy || !plan.providersAdded}
                  onClick={apply}
                >
                  <Check size={15} />
                  {t("确认导入")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {(error || planError) && (
        <p className="model-notice" role="alert">
          {error || planError}
        </p>
      )}
      <p className="model-notice" role="status">
        {busy ? t("正在处理备份…") : notice}
      </p>
    </section>
  );
}
