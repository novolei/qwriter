# Qwriter 开发基准 · 2026-09-07

目标是让写作体验和工程结构可以持续演进。仓库入口规则为 `AGENTS.md`，质量门禁为 `npm run check`；它们与实际目录同步维护。

## 1. 模块地图

```text
src/
  bootstrap.tsx             前端启动、全局样式与离线字体
  app/
    App.tsx                 组合视图，声明依赖
    useWorkspace.ts         文稿、模型、编辑器的应用级编排
    usePanelLayout.ts       窗口断点与侧栏展开状态
    components/AppMenu.tsx  品牌与工作区菜单
    panels/                 文稿库、编辑区、AI、设置等应用面板
  features/
    editor/                 编辑命令、工具栏、选区、链接弹窗
      media/                媒体协议、预览、Tiptap 节点、便携导出
    capture/                灵感卡片、恢复草稿、截图、OCR 与浮窗
    ai/                     AI 协作控制器与差异审阅
    agent/                  任务工作台、能力选项、上下文与历史恢复
    knowledge/              本地记忆、知识收藏与审阅表单
    library/                保存、恢复、历史
    models/                 厂商配置与连接检测
    settings/               排版配置与规范化
    git/                    本地 Git 工作区
    studio/                 ComfyUI 协议适配
  shared/
    ui/                     Radix 选择框与弹窗
    media/                  跨桌面 / 浏览器的资产与剪贴板接口
    ipc/                    生成的 commands/DTO、错误识别
    i18n/locales/           zh-CN、en
    storage.ts              容错读取浏览器偏好
  styles/                   按界面职责拆分；index.css 声明层叠顺序
  test/                     测试环境适配与交互工具
src-tauri/
  src/
    main.rs                 仅桌面入口
    lib.rs                  桌面/移动共享初始化，manage 状态
    registry.rs             唯一命令清单
    protocol.rs             运行时分发与离线类型导出
    error.rs                AppError/AppResult
    commands/               async IPC 适配器
    services/               provider/library/git/streaming 业务实现与测试
  capabilities/             显式本地窗口能力
  permissions/              从命令清单生成的权限定义
  examples/export_bindings.rs
scripts/                    启动、生成协议、架构与质量检查
.github/workflows/quality.yml  Windows/macOS CI 矩阵
```

依赖方向为 app → features → shared。应用 panels 可以引用应用编排的 TypeScript 类型；可复用 feature 不可反向引用 app。AI 保存依赖只接收 `flush(): Promise<void>`，不耦合整个文稿库 hook。测试和生成文件不能作为生产功能模块导入。

手写文件最多 500 行，建议 150–350 行。这个限制用于触发职责审查，不能替代架构判断；不允许为了通过检查把一个巨型函数压成几行。原 App、工具栏、样式和 Rust 桌面入口已按上述职责拆分。

## 2. IPC 是明确的契约

新增一个命令的流程：

1. 在相应 service 定义业务和 DTO；所有可失败操作返回 Result。
2. commands 中增加 async 适配器，声明 serde/Specta 类型与 AppResult。
3. 在 `registry.rs` 增加命令。清单同时驱动 runtime handler、Specta exporter 和 AppManifest 权限生成。
4. 在 capability 中明确允许需要暴露给 main 的命令；禁止授权其他窗口或 remote origin。
5. 执行 `npm run bindings:generate`，前端导入生成 commands。不得手改 bindings。
6. 补上行为测试；`npm run check` 验证接口是否漂移。

采用固定版本 `tauri-specta = 2.0.0-rc.25`、`specta = 2.0.0-rc.25` 和 `specta-typescript = 0.0.12`。这是预发布版本组合，升级须成套验证，不使用浮动预发布范围。类型在开发/CI 的独立程序生成，应用启动不导出文件、不构建反射注册表；运行时使用 Tauri 原生 handler。

自动导出不是运行时 JSON 校验的替代。Rust 仍验证文稿数量、单篇大小、时间戳、修订号、URL、Git 相对路径和陈旧 HEAD。前端处理外部工作流与模型响应时仍做结构检查。

ComfyUI 的任意工作流使用明确标记的 JSON 字符串边界；Rust 先限长 10 MB、解析为 JSON，再调用 service；前端统一 service 适配器解析返回结果。普通命令使用结构化 DTO，模型列表只暴露实际需要的 id，避免让不受约束的供应商 JSON 侵入所有界面。

现有毫秒时间、快照号、修订号以 JS number 传输；Specta 显式启用 i64→number 导出。保存入口限制在 JS 安全整数范围。未来引入任意 64 位业务 ID 时必须改为字符串或专用序列化，不能套用这个映射。Git 时间用于显示秒数。

## 3. 状态、阻塞与错误

`lib.rs/setup` 注入 LibraryLock、GitLock 和 Requests。command 从 State 提取并复制 Arc；阻塞闭包内部取得锁，数据库/仓库对象不跨异步线程共享。SQLite 和 libgit2 使用 spawn_blocking；网络和流式读取在异步运行时执行。不可仅在同步工作前加 async 关键字。

错误统一为 thiserror 枚举和序列化 `{code,message}`：validation、storage、conflict、network、git、internal。Rust 适配器处理领域转换；前端 `errorText` 识别结构化错误并国际化。旧 service 的内部 String 错误暂由 command 转换；新增路径优先直接使用 AppError，后续迁移不得改变现有用户提示和冲突保护。

生产路径由 Clippy 禁止 unwrap、expect、panic。网络错误不得包含 Authorization、API Key、用户文稿或供应商完整响应体。请求被取消、文稿已切换或版本已改变时，旧结果不得覆盖当前内容。

## 4. 安全边界

`tauri.conf.json` 只启用 default capability。default 只匹配本地 main 窗口，显式允许必要的事件监听、窗口关闭、原生打开/保存、文本文件读写及应用命令。AppManifest 同时对自定义命令启用权限约束；单纯给插件写 capability 并不能约束默认开放的自定义命令。

原生对话框为用户选中的导入/导出路径授予 fs 动态作用域，不提供全磁盘通配。SQLite 在 Rust 内固定解析 app_data_dir；Git 根据用户选择的仓库处理经过校验的相对路径。**fs 插件 scope 不会约束 Rust 中的 std::fs 或 libgit2**，新自定义文件接口必须自行验证路径与操作范围。

没有 shell 插件、裸命令执行、远程网页 IPC、Git hooks 或远程 push/pull。API Key 默认仅会话内存，可显式保存在 Windows/macOS 系统凭据库；公开模型配置不含密钥。凭据操作通过后台线程与共享锁串行执行，绑定供应商 ID 和来源，详见 MODEL-SYSTEM.md。此文档定义当前边界，不代表完成渗透测试。

## 5. UI 与设计系统

品牌入口位于左栏；应用级设置归属工作区，文稿工具归属文稿顶部。左栏关闭/专注模式可从编辑区的紧凑菜单访问设置。900 px 及以下默认收起左栏，再打开时覆盖显示，避免挤压编辑区。

所有选择控件使用 shared Select，弹窗使用 shared Modal。基于 Radix 保留键盘选择、焦点管理、层叠 Escape 行为；主题通过 portal 容器继承。视觉基于现有纸白、灰绿、细边框、圆角和低对比阴影，不为单个业务新增另一套组件皮肤。动效约 150 ms，遵从 prefers-reduced-motion。

设置固定目标宽 600 px、高 840 px，受当前视口约束；两个标签共享外框尺寸，仅正文滚动，标题/关闭入口固定。至少检查 900×640、常规桌面和较宽桌面；中英文与深色模式均要检查。手写文本进入 i18n，模型 ID、用户标题和文稿内容不翻译。

自动收起时显示带文字的「文稿库」入口。首次提示可关闭，展开或关闭提示后记录 `qwriter.library-hint-seen`，不再重复。窄屏文稿库使用 Radix Dialog 抽屉，支持 Escape、焦点约束及返回入口。

官方标识采用用户选定的原工作区 Lucide Feather 图标。`shared/brand/BrandIcon.tsx` 统一侧栏与启动界面，tokens.json 维护比例和原有灰绿配色，scripts/icons.mjs 从同一个 Lucide 组件生成 SVG、PNG、ICO、ICNS 与 favicon。执行 `npm run icons:generate` 后提交图标产物；Lucide 许可随 public/licenses/Lucide.txt 打包。字标使用原 Q 字样的 Georgia 粗斜体衬线风格，与用户可配置的界面字体独立。顶部仅保留一组品牌信息；BrandTagline 负责六句双语短句的 8 秒轮换，尊重焦点、悬停、页面可见性和减少动态效果，并在品牌菜单提供持久化开关。

## 6. 质量门禁与交付

### 国际化与浏览器缺陷闭环

界面文案统一进入 `shared/i18n/locales/zh-CN.json` 与 `en.json`。现有中文翻译键可以继续通过 `t(key)` 使用，不要求为了改键重写业务；禁止把未翻译的字面量直接用于正文、按钮、标题、占位符或可访问名称。消息参数使用插值，显示偏好不改用户文稿、模型名称、供应商名称或素材说明。

CodeMirror 的 phrase 名称与截图库的 `Lang` 字段视为第三方协议，分别通过 `features/editor/source-locale.ts` 和 `shared/media/annotation/locale.ts` 适配；业务组件不维护额外中英字典。示例文稿只在创建时读取当前语言，之后按用户内容保存。语言自称（例如「简体中文」）可保留本语显示，但需明确 `lang` 属性。

`npm run check:i18n` 使用 TypeScript AST 检查直接显示的中文 JSX、静态 `t()` 键，以及语言资源重复键、缺失值、插值不一致和英文资源内混入中文。它已纳入 `npm run check`，检查器自身有独立回归测试。该检查不能推导任意动态数据流、第三方内部文案或 Rust 拼接消息；动态键和第三方协议仍需领域测试及真实中英交互验证。

浏览器验证发现的问题须按「复现 → 修复 → 受影响流程复测」记录。涉及内容、竞态、权限或协议时补回归测试；纯样式问题通过真实交互和截图复查。不可用绕过操作或截图覆盖缺陷，也不可把未验收项写成已完成；外部环境阻塞须明确说明具体边界。

```text
npm run format
cargo fmt --manifest-path src-tauri/Cargo.toml
npm run bindings:generate
npm run check
npm run desktop:build
```

check 执行文件规模和依赖方向检查、Prettier、严格 TS/未使用代码检查、Vitest、cargo fmt --check、cargo clippy --all-targets -- -D warnings、cargo test 和 bindings 漂移检查。CI 在 Windows/macOS 执行同一套检查及调试版构建。CI 文件已配置，只有推送到相应仓库后才实际运行。

Windows 的公共控件 v6 manifest 通过同一链接步骤嵌入应用、测试与导出程序；关闭 Tauri 重复的 binary-only manifest 资源，以避免重复资源链接失败。移动入口保留不等于移动平台已适配；macOS 仍需要真机、签名、公证与安装验证。

Windows 桌面入口在调试版与正式版均使用 GUI subsystem，不以 `debug_assertions` 决定是否创建控制台。直接打开 `qwriter.exe` 不应附带终端窗口；开发者主动运行 npm/Cargo 的已有终端属于开发环境。构建验收可读取最终 PE 的 Subsystem 字段，GUI 应为 2，Console 为 3。

回归关注原始 Markdown、保存冲突、取消、临时 Git 仓库提交边界、语言/字体持久化、下拉框嵌套弹窗焦点；不能使用用户真实文稿、远程凭据或实际仓库进行破坏性测试。

## 参考依据

- [Tauri 项目结构](https://v2.tauri.app/start/project-structure/)
- [Tauri Rust commands 与异步调用](https://v2.tauri.app/develop/calling-rust/)
- [Tauri capabilities 与 AppManifest](https://v2.tauri.app/security/capabilities/)
- [Tauri Specta 项目](https://github.com/specta-rs/tauri-specta)
- [Radix Select](https://www.radix-ui.com/primitives/docs/components/select)
- [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)
