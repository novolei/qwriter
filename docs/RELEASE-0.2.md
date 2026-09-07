# Qwriter 0.2 开发记录 · 2026-09-06

## 产品与视觉

沿用暖白纸面与墨绿基调，提升控件和文字对比度，统一侧栏、工具栏、输入框、弹窗与滚动条。增加阅读宽度、字号、行距和可持久化主题，弹窗支持焦点约束、Esc 和焦点恢复，动效尊重减少动态效果偏好。

设置浮窗改为固定标题 / 关闭按钮与内部滚动区；去掉贴边轨道和箭头，4 px 滑块内缩且默认透明，悬停或键盘聚焦滚动区时显示。模型连接和外观与字体共用 600 × 840 CSS px 的最大设置布局，按当前视口可用空间缩小，切换不重放尺寸动画；标签在内部滚动时保持可见。保留滚轮、触控板、键盘及拖动滑块操作。

根据用户对字体的反馈，不再仅依赖宿主系统的中文字体回退。内置 `Noto Sans SC Variable`、`Noto Serif SC Variable`；英文无衬线提供 Inter、Manrope、Source Sans 3，衬线提供 Lora、Source Serif 4。界面与文稿各有独立的中文和英文字体设置，默认界面采用 Inter + Noto Sans SC，文稿采用 Source Serif 4 + Noto Serif SC。字体按 Unicode 范围分片，实际使用的字符按需加载；生产应用不访问字体 CDN。包含可用的原生英文斜体，OFL 许可证随构建保留。

国际化采用 i18next / react-i18next，提供简体中文与 English，语言选择即时生效并本机持久保存。导航、模型/外观设置、AI 操作、ComfyUI、历史审阅、保存提示和常见服务错误均进入资源文件；日期使用当前 locale，计数使用复数规则，HTML lang/dir 与页面标题同步。语言切换保留文稿、标题、用户模型配置名；服务端返回的未知系统错误保留原始信息。

## 结构变化

- `src/library.ts`：缓存迁移、启动加载、串行自动保存、冲突错误、关闭保存。
- `src-tauri/src/library.rs`：SQLite 事务、修订号、历史版本与防旧写入覆盖。
- `src-tauri/src/streaming.rs`：字节安全 SSE 解码、模型流、CancellationToken、Tauri Channel。
- `src/models.ts` / `ModelSettings.tsx`：多配置、会话密钥、连接检测。
- `src/Review.tsx` / `History.tsx` / `Modal.tsx`：diff 审阅、历史恢复和可访问弹窗。
- `src/typography.ts`：字体目录、旧设置迁移、偏好合法性校验。
- `src/i18n.ts` / `src/locales/*.json`：语言、资源目录、日期 locale、常见原生错误翻译。

## 自动化验证

- Rust 12 项通过：SQLite 重启读取、历史保留与数量上限、旧版本写入拒绝、重复 ID 拒绝、OpenAI / Anthropic / ComfyUI 请求、Unicode 跨块 SSE、真实 HTTP SSE、不完整响应、取消关闭 socket、错误密钥保护。
- 前端 16 项通过：先加载磁盘再允许保存、输入期间串行保存、冲突保留缓存、缓存满时仍写磁盘、恢复副本不覆盖原稿、表格/任务/中文/代码 Markdown 转换、Key 不持久化、AI 审阅后修改、摘要另存、中途取消阻止覆盖、字体设置迁移与异常值处理；中英文资源键一致、复数与服务错误、语言/英文字体持久化和切换保留文稿、翻译后的供应商选项保持配置值。
- TypeScript / Vite 构建通过。Rust Clippy 所有 targets 以 `-D warnings` 通过。
- 浏览器实测：外观设置、中英文字体独立切换和真实加载、语言切换、夜读主题、字号滑杆、英文长文案排版。
- 设置浮窗响应式实测：900×640、1280×720、1440×900、1920×1080、640×480、390×640 CSS 视口；中英文设置、两个标签尺寸和坐标一致、内容无横向溢出、小窗口滚动至底部操作按钮且关闭按钮固定。窄视口属于浏览器布局验证，桌面原生窗口下限仍为 900×640；系统级 DPI 与 macOS 原生缩放尚未真机回归。
- Windows 独立调试版构建并启动成功，窗口响应正常；真实 IPC 启动加载并保存了 4 篇现有文稿，SQLite 修订号为 1，`PRAGMA quick_check` 返回 `ok`。本机主库路径为 `C:\Users\aresr\AppData\Roaming\studio.qwriter.desktop\library.sqlite3`。

模型测试使用本机模拟服务，不等于已验证所有供应商。桌面 UI 对话框和 macOS 真机测试仍需补充。

## 后续阶段

文件夹工作区与外部变更监听、SQLite FTS 搜索、系统凭据库、选区级 Agent 工具调用、模型上下文预算、ComfyUI 模板参数与媒体预览回插、识图、自动更新与签名分发。

## 官方字体资料

- https://fontsource.org/fonts/noto-sans-sc
- https://fontsource.org/fonts/noto-serif-sc
- https://notofonts.github.io/noto-docs/website/homepage/
- https://github.com/notofonts/noto-cjk
