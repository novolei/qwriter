# 便携知识引用验收 · 2026-09-07

## 范围

- Agent 输出中的实际知识引用转换为普通 Markdown 标题链接，附上片段、标题、来源、章节、行号与修订快照。
- 预览、审阅、采纳、另存和显式继续打磨使用一致内容。历史保留原始输出和来源注册表，读取时适配旧结果。
- 未匹配来源的引用转为普通文字并提示；用户关闭来源保留时不附加快照。
- Markdown 标题定位支持中文、重复标题、点击与 Enter；ID 为派生装饰，不进入文稿 schema。

## 浏览器复现与修复

1. 初次加载以代码块结尾的 Markdown，点击引用或聚焦编辑器会触发 Tiptap TrailingNode 追加空段落。使用小型扩展适配器，保留原组件逻辑并限定在文稿改变后追加；回归确认跳转前后 Markdown 完全一致。
2. 在 Agent 预览点击引用，关闭来源浮窗后焦点落到 body。原因是预览每次渲染重新定义链接组件，触发按钮卸载。将渲染组件身份固定，通过 Context 提供当前引用映射；复测 Escape 后焦点返回引用按钮。
3. 独立浏览器验证页的 HMR 重建重复 React root，及其测试布局缺少 min-height 导致整页滚动。补充 HMR dispose 与滚动容器高度约束；这些修复仅属于开发验证页，不影响产品布局。
4. Chromium 的 contenteditable 内链接没有默认 Tab 停靠，单元测试直接派发键盘事件不能覆盖这一行为。复用 Tiptap Link 并仅给文内链接添加 DOM tabindex，随后用真实 Tab → Tab → Enter 验证：焦点进入链接、来源标题定位到滚动区内，Markdown 前后完全一致。测试同时锁定该 tabindex，普通正文 Enter 仍然用于编辑。

## 固定验证方式

运行 `npm run dev`，打开 `/docs/audit/2026-09-07-portable-citations/fixture.html`。页面使用实际 AgentPanel、useWritingAgent、KnowledgeSource、编辑器扩展和主题样式，加载明确标注的固定任务输出；文稿保存仅进入 React 内存，不写用户文稿库、不调用模型。测试页不纳入生产构建。

Windows 内嵌 Chromium 验证 900×640、1280×800、1920×1080，中英文、浅深色，来源保留切换、引用快照打开、Escape 焦点恢复、另存后点击/Enter 定位。原样 Markdown 包含来源，跳转前后内容不变。来源不可用时显示快照，不冒用旧位置。

截图为本机生成的 `source-900.png`、`retention-900.png`、`english-dark-1280.png` 等；截图按仓库规则不提交。浏览器固定样本不替代真实服务测试；本轮未新调用收费 API，macOS 未做实机验证。

## 自动化与边界

定向用例覆盖 Markdown 引用语义、代码和实体转义、重复引用/标题、未知 ID、可选来源保留、英文内容、幂等、未闭合代码围栏、Markdown 重开、键盘导航、失效链接、旧任务恢复、原稿竞争保护和焦点恢复。

`npm run check` 通过：54 个前端测试文件 / 133 个用例，Rust 54 通过 / 4 个按约定忽略，以及架构、i18n、格式、严格 TypeScript、fmt、clippy 和 IPC 漂移检查。

`npm run desktop:build` 的前端打包与 Windows 二进制链接完成，但原 `target/debug/qwriter.exe` 正在运行，Cargo 最后覆盖该路径时返回 Windows access denied。保留现有进程，将本次新链接的 `target/debug/deps/qwriter.exe` 复制为 `target/preview/Qwriter-citations-20260907.exe`，并核对 SHA-256 一致。未宣称该构建命令整体成功，未关闭用户应用；新预览可执行文件未做原生交互测试，也不是签名安装包。

外部阅读器可能使用不同的标题锚点规则；来源快照仍为可独立阅读的普通 Markdown。修改文末来源标题后不会自动重写已有链接。快照不随知识更新，也不表示资料已核实。来源副本计入后续任务的现有参考预算，超限仍由原有校验明确拒绝，不静默截断。
