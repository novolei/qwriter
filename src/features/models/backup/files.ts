import { isTauri } from "@tauri-apps/api/core";
import { t } from "../../../shared/i18n";

export async function saveBackupFile(
  json: string,
): Promise<"saved" | "downloaded" | "cancelled"> {
  const name = `Qwriter-models-${new Date().toISOString().slice(0, 10)}.json`;
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      title: t("导出模型配置"),
      defaultPath: name,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return "cancelled";
    // Use the path granted by the dialog; do not broaden the filesystem scope.
    try {
      await writeTextFile(path, json);
    } catch {
      throw new Error("无法保存模型备份，请检查目标文件夹的写入权限");
    }
    return "saved";
  }
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
