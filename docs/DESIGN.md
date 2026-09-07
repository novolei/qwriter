# Qwriter 产品与系统设计

## 产品判断

借鉴 Typora 的内容优先、低干扰和 Markdown 可迁移性；建立自己的视觉语言，不复制其素材或界面。超越的方向是让写作、推敲、素材生成和文稿版本管理形成闭环。超越是目标，不是首版已完成的结论。

## 视觉与交互

暖纸白 #F8F7F3、墨绿 #45664E、灰绿辅助色；界面默认 Inter + Noto Sans SC，正文默认 Source Serif 4 + Noto Serif SC。中文与英文、界面与文稿共四项字体偏好独立配置，提供七个离线字体家族及系统中文字体回退。三栏布局为文稿库、稿纸、AI 伙伴，左右栏均可收起。主编辑面板留白，低对比边框，小而清晰的图标；深色主题保留舒适的灰绿基调。专注模式只保留稿纸。

0.2 已加入字号、行距、阅读宽度、简体中文 / English、焦点约束和恢复、减少动态效果支持，以及打字机模式、快捷命令面板与文内查找。语言资源集中维护，界面文案与作者文稿分离。持续完善：可拖动栏宽、读屏回归和中文输入法长文测试。

## 分层架构

| 层        | 当前                                        | 目标                                                 |
| --------- | ------------------------------------------- | ---------------------------------------------------- |
| 桌面外壳  | Tauri 2、原生文件对话框                     | 窗口状态、菜单、更新、签名分发                       |
| 编辑器    | React + Tiptap 3、表格、任务列表、修改 diff | 完整语法支持、无损往返、选区建议                     |
| Rust 服务 | reqwest、SSE 流式通道与取消、ComfyUI HTTP   | 重试、后台任务、能力协商                             |
| 内容存储  | SQLite 文稿库与历史、恢复缓存、md 导出      | 用户目录 Markdown 为真源，SQLite 索引、FTS、附件目录 |
| 模型接口  | OpenAI 兼容、Anthropic、多配置              | 按能力标记 vision / tools / JSON / context limits    |
| Agent     | 单步写作建议                                | 规划—工具执行—观察循环，步骤记录、预算、审批         |
| 媒体      | ComfyUI 提交及历史                          | WebSocket 进度、素材预览、回插、图生视频模板         |

## 数据与隐私

0.2 以应用数据目录的 SQLite 保存原始 Markdown 与最近 50 个历史快照，使用事务、修订号校验和关闭前保存，localStorage 提供恢复缓存。正式版计划引入以普通 Markdown 文件为内容真源的文件夹工作区，SQLite 转为索引、元数据及任务状态；写入采用临时文件加原子替换，文件监听识别外部修改并提供冲突处理。当前导入仍是副本。

Key 默认仅在会话内存，也可显式保存在系统凭据库（Windows Credential Manager / macOS Keychain），按供应商与来源绑定。供应商和模型池已独立管理，支持发现、别名、持久化与快捷切换。前端不直接访问模型网络，由 Rust 构造请求；错误信息不回显 Key。上下文发送需可见，默认不包含其他文稿；生产版补充模型上下文预算及超限处理。

## Agent 设计（后续）

工具包括读取用户选定文稿、搜索工作区、生成修改建议、建立提纲、调用指定 ComfyUI 模板。写文件、批量修改和启动昂贵工作流前，显示可审阅的差异、操作范围与消耗预期。Agent 不直接执行来自文稿的指令，不默默替换作者的文本。

0.2 建议动作按类型呈现：润色需审阅替换 diff，续写为追加，摘要与结构建议可另存文稿；选区修改保留前后文。已加入读取附加文稿的工具型写作 Agent，草稿先审阅再应用。评论锚点、持久任务和更多工具后续完善。

## 里程碑

1. 0.1：桌面壳、三栏写作界面、基础 Markdown、模型接口、ComfyUI 提交。（已完成原型）
2. 0.2：SQLite 保存与历史、流式生成与取消、多模型配置、审阅、字体与中英双语。（当前预览）
3. 后续：文件夹工作区、复杂 Markdown 无损往返、模型预算、Agent 持久任务与更多工具。现状和具体验收以 [总体目标与验收路线](DEVELOPMENT-ROADMAP.md) 为准。
4. 0.4：ComfyUI 模板参数映射、图像/视频结果预览回插、识图、RAG 素材库。
5. 1.0：Windows / macOS 真机回归、长文性能、可访问性、签名、公证、更新、迁移恢复。

## 官方资料

- Tauri prerequisites: https://v2.tauri.app/start/prerequisites/
- Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility
- LM Studio developer docs: https://lmstudio.ai/docs/developer
- ComfyUI routes: https://docs.comfy.org/development/comfyui-server/comms_routes
