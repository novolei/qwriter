# Qwriter 测试版分发

## 发给朋友的文件

- Windows：优先发送 `bundle/nsis/*-setup.exe` 安装包。安装器按当前用户安装，支持中英文；已嵌入 WebView2 引导程序，缺少运行环境时仍需联网下载运行时。
- 裸 `qwriter.exe` 已嵌入前端、字体和离线 OCR 资源，但依赖接收方的 Windows 系统运行环境与 WebView2，不能视作任意电脑均可运行的完全便携包。不需要发送源码、node_modules、PDB、模型密钥或本机文稿库。
- macOS：发送 `bundle/dmg/*.dmg`。通用构建包含 Apple Silicon 与 Intel 两种架构。Windows EXE 不能在 macOS 直接运行。

## GitHub Actions

仓库已包含 `.github/workflows/test-installers.yml`。在 Actions → Test installers → Run workflow 手动启动，或推送 `qwriter-test-*` 标签触发。两个平台通过完整质量检查后构建安装包，保存在该次运行的 Artifacts 中，保留 14 天。不会自动创建公开 Release。

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
