# Qwriter 0.2

测试安装包：在 [GitHub Actions · Test installers](https://github.com/novolei/qwriter/actions/workflows/test-installers.yml) 下载成功运行的 Windows / macOS 产物。详细构建步骤、WebView2 依赖与 macOS 签名限制见 [测试版分发](docs/TEST-DISTRIBUTION.md)。

一间安静、可配置字体的 AI 写作书房。Tauri 2 + Rust + React + TypeScript + Tiptap。

## 开发与构建

```text
npm install
npm run desktop
```

启动脚本跨 Windows / macOS，自动为子进程补充用户 Cargo PATH，不修改系统全局配置。macOS 仍需 Rust 与 Xcode Command Line Tools。

- `npm run dev`：浏览器编辑预览；AI、磁盘库、历史与 Git 需要桌面环境。
- `npm run desktop:build`：构建包含前端资源的独立调试版。
- `npm run build`：TypeScript 与前端生产构建。
- `npm test`：前端与交互测试。
- `npm run check`：架构边界、格式、TypeScript、前后端测试、Clippy 和 IPC 类型漂移检查。
- `npm run bindings:generate`：从 Rust 命令注册表生成前端 commands/DTO。
- `npm run icons:generate`：从现有羽毛标识生成 Windows/macOS 图标及 favicon。
- `cargo test --manifest-path src-tauri/Cargo.toml`：Rust 协议与存储测试。
- Windows 程序：`src-tauri/target/debug/qwriter.exe`。

## 本轮新增

- **供应商与模型池**：供应商连接与模型独立管理，一份密钥支持多个模型；自动发现、多选添加、手动 ID、名称 / 启用管理，以及按供应商分组的搜索与键盘切换。模型池、目录缓存和当前选择本地持久化，旧配置自动迁移。
- **密钥与连接验证**：会话密钥或系统安全保存（keyring / Windows Credential Manager / macOS Keychain），按供应商与来源绑定。鉴权检测与真实 Agent 验证分开；已通过 DeepSeek 官方 API 三轮工具写作与 Windows 凭据读写删除实测。

- **快速抵达**：Ctrl/⌘ P 打开文稿与操作面板，搜索标题或正文片段，方向键 / 回车打开文稿、查找替换、字体、模型、Git 等操作。基于 cmdk，沿用 Radix 弹窗和现有主题。
- **查找与源码编辑**：Ctrl/⌘ F；正文高亮匹配，支持大小写、逐项 / 全部替换与整步撤销。源码使用 CodeMirror 6，提供行号、高亮、正则 / 全词查找和独立撤销重做，已接入顶部工具栏。
- **工具型写作 Agent**：AI 写作中切换“写作 Agent”，附加参考文稿、填写目标，执行限定范围的检索 / 阅读 / 草稿提案，显示实际步骤并支持停止。结果可预览、另存、审阅后替换，也可明确附上上一份草稿继续打磨。
- **启动与小窗口**：命令面板、源码编辑器、Agent 视图按需加载；小窗口精简引导区，输入和停止入口保持可见，新滚动区使用隐约细滑块。

- **工作区布局与品牌**：取消独立顶部栏，官方羽毛标识和 Georgia 粗斜体 Qwriter 字标放入左栏；常用设置收进工作区菜单。窄窗口自动收起文稿库，保留带文字的入口，并提供可关闭、记住选择的首次提示。
- **交互组件**：统一 Radix 下拉框、弹窗与菜单，配合细边框、灰绿焦点、轻量动效与键盘操作；标题/关闭区域固定，设置切页维持相同尺寸。
- **工程基准**：app/features/shared 分层、Rust commands/services 分层、Specta 类型生成、thiserror 错误边界、显式自定义命令权限，以及 Windows/macOS CI 质量检查。

- **中英文字体**：内置 Noto Sans SC、Noto Serif SC，以及英文 Inter、Manrope、Source Sans 3、Lora、Source Serif 4，离线可用。设置 → 外观与字体分别配置界面中文、界面英文、文稿中文、文稿英文；支持无衬线 / 衬线 / 中文系统字体，实时预览并自动记忆。默认界面为 Inter + Noto Sans SC，文稿为 Source Serif 4 + Noto Serif SC。
- **国际化**：简体中文 / English 即时切换并记忆，覆盖导航、设置、AI 操作、历史、审阅、保存状态及常见服务错误；日期与复数按语言格式化。切换语言不会改写文稿或自定义名称。基于 i18next 的独立资源文件，便于添加更多语言。
- **排版**：字号、行距、稿纸宽度、晨光 / 夜读主题；统一留白、按钮、侧栏、弹窗与滚动条。
- **设置浮窗**：模型 / 外观两个标签共用相同尺寸，按视口自动收缩；标题和关闭按钮固定，内部滚动使用内缩且默认隐藏的细滑块。
- **文稿库**：桌面 SQLite 事务保存，650 ms 防抖，关闭前等待保存；保留本机恢复缓存，旧版缓存自动迁移。
- **历史**：每篇最近 50 个修改前快照，预览和恢复。恢复操作自身也可通过历史回退。
- **冲突保护**：保存按修订号串行提交，拒绝旧窗口覆盖较新的磁盘内容；保留待恢复草稿。
- **模型配置**：供应商 / 模型池两层管理，密钥按需保存到系统凭据库；运行中的任务持有原配置快照。
- **AI 流式生成**：OpenAI 兼容 / Anthropic SSE，经 Tauri Channel 逐段显示；停止按钮取消 Rust 请求并关闭连接。
- **审阅**：润色替换、追加续写、讨论建议分别处理；修改前逐行 diff，摘要可另存，未完成结果不能覆盖原稿。
- **编辑工具栏**：正文 / H1–H6、快捷字号、衬线切换、粗斜体、删除线、行内代码、链接、三种列表、撤销 / 重做；插入面板提供引用、代码块、表格、分隔线、网络图片与清除格式。进入表格时显示行列操作，代码块支持语言标记。
- **写作视图**：选区浮条、空段落插入入口、段落聚焦、打字机模式、快捷行距；工具栏按编辑区域宽度重新排布。显示偏好不改写 Markdown，动效支持系统减少动态效果设置。
- **选区 AI**：选中文段即可润色，只发送选段；结果先审阅，再替换原选区，保留前后内容并支持撤销。期间文稿变化会阻止旧结果覆盖。
- **Markdown**：支持网络图片、表格、任务列表、代码块；脚注、部分数学、HTML 和 front matter 自动进入源码保护。图片保留地址与替代文本，不上传或复制图片文件。
- **本地 Git**：文稿顶部 Git 入口，选择或初始化仓库，查看分支、文件差异与最近提交，导出当前文稿副本，勾选文件并填写说明后提交。使用内置 `git2` / `libgit2`，不依赖外部 Git CLI。

原有的搜索、大纲、多文稿、导入导出、专注模式和 ComfyUI API 工作流提交/查询继续保留。

## 数据与限制

桌面文稿主库目前是应用数据目录的 `library.sqlite3`，存储原始 Markdown 字符串；不是用户文件夹中的实时 `.md` 工作区。可从外观设置查看实际路径。SQLite 使用 WAL 和 FULL 同步，备份应在应用退出后进行，或使用 SQLite 备份方式，不要在运行中只复制主文件而忽略 WAL。

浏览器版仍保存于 localStorage，与桌面各自独立。保存报错时会显示状态并保留导出入口。单篇文稿上限 10 MB，当前每次保存提交整套文稿库，数千篇或超长文稿的性能优化尚未完成。

所有模型都需要用户配置正确的模型 ID 与服务；本轮通过本地模拟服务器验证协议，并用用户授权的临时密钥完成 DeepSeek 官方 Agent 实测。取消会停止本应用的连接，但服务商是否停止计费或后台计算取决于其实现。快速协作为单次流式生成；写作 Agent 使用多步原生工具调用，要求模型支持工具，限于本次附加文稿与草稿建议，最多 6 轮。尚未实现 MCP、向量 RAG、联网检索或视觉输入；任务状态当前保留在本次会话内。

密钥可选仅会话使用，或显式保存在 Windows/macOS 系统凭据库，重启后自动读取。供应商检测针对 `/models`；无该端点时可手动添加模型，再执行实际 Agent 验证。浏览器预览与桌面配置各自独立，浏览器不执行原生连接检测。

Git 当前管理用户明确选择的本地文件夹，文稿库仍在 SQLite 中；导出为 Markdown 副本后才进入 Git 文件管理，尚未双向同步、监听外部编辑或自动提交。不包含 push / pull、远程凭据、分支切换、合并和冲突解决。提交会暂存所勾选文件的当前内容；若暂存后提交失败，暂存内容可能保留。详见编辑与 Git 设计记录。

复杂 Markdown 尚未保证所有语法无损往返。源码保护采取保守检测，并跳过围栏代码块中的字面量；源码模式下格式化按钮禁用，显示排版仍可调节。源文件导入为副本。ComfyUI 需自行准备服务、模型、节点与素材，目前仍是工作流 JSON 提交和历史 JSON 查询，未实现媒体预览回插。

Windows 已构建；macOS 的签名、公证、真机测试和正式安装包仍待完成。

## 文档

- [工程约束](AGENTS.md)
- [总体目标与验收路线](docs/DEVELOPMENT-ROADMAP.md)
- [写作 Agent 与快速工作流](docs/WRITING-AGENT.md)
- [段落导航与悬浮预览](docs/PARAGRAPH-NAVIGATION.md)
- [供应商、模型池与凭据架构](docs/MODEL-SYSTEM.md)
- [架构与开发基准](docs/ENGINEERING.md)
- [本轮写作流程与模型管理验收](docs/audit/2026-09-07-writing-flow/REVIEW.md)
- [工作区与品牌 UI 审阅](docs/audit/2026-09-07/REVIEW.md)
- [整体设计](docs/DESIGN.md)
- [0.2 开发与验证记录](docs/RELEASE-0.2.md)
- [编辑工具与 Git 集成设计](docs/EDITOR-GIT.md)
- [初始环境检查](docs/ENVIRONMENT.md)
- 字体许可证随应用附带在 `public/licenses`，构建后保留于资源中。
