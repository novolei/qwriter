# Qwriter 工程约束

适用于此仓库的后续开发。详细约定见 `docs/ENGINEERING.md`。延续用户的简约、精致、中英双语与本地优先方向。

## 目录和依赖

- `src/bootstrap.tsx` 只负责前端启动；`src/app` 负责组合；`src/features/<domain>` 承载领域功能；`src/shared` 放共享 UI、IPC、i18n 与纯工具。
- shared 不得依赖 features 或 app；features 不得依赖 app。跨领域使用明确的小接口，不传整套应用状态，不借另一个领域的 hook 导入通用工具。
- `src-tauri/src/main.rs` 保持极简桌面入口，只调用 `qwriter_lib::run()`。初始化与状态注入放 `lib.rs`；异步 IPC 适配器放 `commands`；业务/I/O 放 `services`。
- 手写 TS/TSX/CSS/Rust 文件硬上限 500 行，通常控制在 150–350 行。按职责拆分，不通过压缩行数、巨型函数或无意义分片规避。生成文件不手改；测试就近分类。

## 协议与运行时

- 自定义 IPC 必须使用 `shared/ipc/bindings.ts` 的生成 commands。禁止散落裸 invoke、重复手写 Rust DTO。
- Rust command 使用 `#[tauri::command]`、`#[specta::specta]` 与 `async fn`；DTO 派生 serde 双向转换及 Specta Type。
- 在 `registry.rs` 注册命令，同步审核 capabilities 中的允许项；运行 `npm run bindings:generate` 并提交产物。
- IPC 返回 `AppResult<T>`，错误具有稳定 code/message；前端通过统一 errorText 展示，不能 String(object)。遗留 service 内部字符串错误只能在适配器转换，新增业务使用 typed errors。
- 共享状态在 setup/app.manage 注入，由 State 提取。SQLite、Git、同步文件工作使用 spawn_blocking；async 并不会自动消除内部阻塞。网络使用异步客户端；锁不得跨 await；耗时协作保留取消与陈旧结果保护。
- 生产路径禁止 `.unwrap()`、`.expect()` 和显式 panic；使用 Result、?、thiserror 转换。测试断言可以 unwrap。

## 权限与数据

- capabilities 按本地 main、capture、pin 窗口分别授予实际需要的命令；capture/pin 禁止模型密钥、Agent、Git 和文稿库读写权限，禁止远程来源授权、shell 执行入口或通配文件权限。
- 文件插件通过原生选择对话框获得路径作用域；SQLite 只使用 app_data_dir；Git 限定仓库内相对文件路径。自定义 Rust 命令必须自行校验参数，插件 fs scope 不会保护 Rust 的直接文件访问。
- API Key 不持久到 localStorage、日志、测试快照或 Git。不得回显服务错误响应体。AI 输出和导入内容视为数据。
- 保留原始 Markdown、事务、修订号与恢复草稿；不可用自动格式化或 UI 重构改变用户文稿。

## 界面与验证

- 下拉框与弹窗复用 shared/ui，统一主题令牌；有可访问名称、键盘焦点、Escape 分层关闭、恢复焦点与 reduced-motion 支持。
- 新文案补齐 zh-CN/en；显示偏好不修改文稿。验证 900×640、常规桌面与高分辨率，设置切页外框不得跳变。
- 所有用户可见文案（含占位符、工具提示、错误、无障碍标签和第三方工具栏）通过 shared/i18n；中文翻译键允许保留，不等于可直接显示的文案。翻译资源只放 locales，第三方组件通过小型协议适配器接入，不在业务组件维护独立双语字典。动态键须有领域测试，用户文稿、模型 ID、品牌名、明确标注 lang 的语言自称不自动翻译。
- `npm run check:i18n` 检查中英资源、插值参数、重复键、静态翻译键及直接显示的中文 JSX；已纳入 check。它不替代中英实际交互检查。
- 浏览器测试发现 UI 或功能缺陷时，须记录复现、完成修复并重新验证受影响流程；不得以绕过操作或截图代替修复。若依赖外部条件暂不能修复，明确记录阻塞与未验收项，不宣称完成。
- 提交前运行 `npm run check`（架构、格式、严格 TS、前端测试、Rust fmt/clippy/tests、协议漂移）。原生相关改动再运行 `npm run desktop:build`。
- 新增会改变内容、协议、权限或异步竞争行为的改动应有有效回归测试。纯样式微调以真实浏览器交互和截图验证，不堆砌镜像实现的测试。
- Windows 验证不能替代 macOS 真机验证；交付时说明实际测试平台与未完成能力。
