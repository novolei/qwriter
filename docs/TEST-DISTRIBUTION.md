# Qwriter 测试版分发

## 发给朋友的文件

- Windows：优先发送 `bundle/nsis/*-setup.exe` 安装包。安装器按当前用户安装，支持中英文；已嵌入 WebView2 引导程序，缺少运行环境时仍需联网下载运行时。
- 裸 `qwriter.exe` 已嵌入前端、字体和离线 OCR 资源，但依赖接收方的 Windows 系统运行环境与 WebView2，不能视作任意电脑均可运行的完全便携包。不需要发送源码、node_modules、PDB、模型密钥或本机文稿库。
- macOS：发送 `bundle/dmg/*.dmg`。通用构建包含 Apple Silicon 与 Intel 两种架构。Windows EXE 不能在 macOS 直接运行。

## GitHub Actions

普通用户从 [GitHub Releases](https://github.com/novolei/qwriter/releases) 下载安装器、查看更新说明和历史版本。Release 附件不受 Actions 的 14 天保留期限制。不要下载 GitHub 自动附加的 Source code 压缩包来安装应用。

`.github/workflows/release.yml` 监听 `v*` 标签，先校验版本及更新说明，复用 `test-installers.yml` 构建 Windows/macOS，再上传到隐藏草稿。两个平台安装包与 SHA256SUMS.txt 全部上传且校验成功后才公开 Release。只有发布 job 授予 contents:write；构建 job 保持只读。

手动运行 Actions → Test installers，或推送 `qwriter-test-*` 标签，仍只生成保留 14 天的临时 Artifacts，不创建 Release。

## 版本控制与发布

- 正式版：`vX.Y.Z`。测试通道：`vX.Y.Z-preview.N`、`vX.Y.Z-beta.N` 或 `vX.Y.Z-rc.N`，N 从 1 开始。
- 原生安装器采用 X.Y.Z 基础版本；预发布序号通过 Git 标签、Release 标题及下载路径区分。Preview 不会被标为最新稳定版；需要原生升级排序时应递增基础版本。
- 发版前同步 `package.json`、`package-lock.json`（含根 package）、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和 Cargo.lock 中 qwriter 版本。CI 严格校验一致性。
- 更新 `docs/releases/X.Y.Z.md`，写清变化、下载选择、测试范围及已知限制。提交代码，通过检查后再为该提交创建标签并推送。
- 不移动旧标签，不替换已公开的安装包。修复后使用新版本；失败后可重跑同一 workflow，已有文件只在 SHA-256 一致时复用，存在差异会停止发布。
- Release 下载链接包含完整标签，历史记录与源码提交一一对应。这不包含应用内自动升级功能。

例如下一轮测试版：

```sh
# 先将上述版本文件更新为 0.2.1，并补齐 docs/releases/0.2.1.md
npm run check
git add <本次版本修改的文件>
git commit -m "Prepare Qwriter 0.2.1 preview"
git tag v0.2.1-preview.1
git push origin main
git push origin v0.2.1-preview.1
```

首次 `v0.2.0-preview.1` 从已验证的 Test installers 运行 34080893602 提升为 Release；标签保留其真实构建提交 af17ff79eea2a272c634c5fae5b2488f40cf324b。后续版本使用新的标签驱动流水线。

当前 Mac 配置使用 ad-hoc 临时签名，适合开发验证，尚未经过 Apple 公证。它不等价于可信发行签名，接收方仍可能遇到 Gatekeeper 提示。正式面向朋友分发前，推荐配置 Developer ID 签名与公证，并实际验证下载后的启动、截图权限和全局快捷键。不要通过关闭系统安全功能来掩盖发行问题。

## 本地命令

Windows（需 Rust MSVC、Node.js 与 Tauri 构建前置依赖）：

```powershell
npm ci
npm run check
npm run desktop:package:windows
```

macOS（必须在 Mac 上运行，需 Xcode Command Line Tools）：

```sh
npm ci
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run check
npm run desktop:package:macos
```

Windows 调试测试安装包可使用 `node scripts/desktop.mjs build --debug --bundles nsis`。其输出目录为 `src-tauri/target/debug/bundle/nsis/`；长期分发优先使用上述 release 构建。

## 参考

- [Tauri Windows 安装包与 WebView2](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri macOS DMG](https://v2.tauri.app/distribute/dmg/)
- [Tauri macOS 签名](https://v2.tauri.app/distribute/sign/macos/)
