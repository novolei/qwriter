# 截图导出扩展名回归

- 统一真实素材格式与建议名称；PNG 截图默认 `.png`，不会仅通过改后缀假装转换为 JPEG。
- 原生另存为返回后再次规范最终文件名；保留父目录，支持无后缀、中文、末尾点、大小写扩展名和 `.jpeg` 别名。
- 校正后的路径若已存在，不直接覆盖，重新进入原生对话框确认；`create_new` 防止检查与写入之间的同名竞争。
- I/O 与原生保存流程放在 `services/capture/export.rs`；异步 command 仅适配并通过 `spawn_blocking` 调用。
- 本机 Windows 原生验证：框选 Qwriter README 标题，完成截图 → 保存到本地；输入 `export-no-extension-20260907`，得到 `export-no-extension-20260907.png`（25,062 字节），显示“图片已导出”。样本留在本地，不上传截图到仓库。
- 纯函数与文件写入回归覆盖格式匹配和已有文件保护；`npm run check`、`npm run desktop:build` 通过。macOS 原生对话框仍需真机验证。
