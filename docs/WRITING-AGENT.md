# 写作 Agent 与快速工作流

## 用户路径

1. 在文稿顶部点击放大镜，或按 Ctrl/⌘ P。输入词句查找文稿，或输入“查找”“字体”“Agent”等定位操作。方向键选择，回车执行，Escape 返回。
2. Ctrl/⌘ F 打开文内查找；正文支持字面量高亮、匹配跳转、大小写与可撤销替换。源码模式使用 CodeMirror，并提供正则与全词搜索。
3. 右侧 AI 写作 → 写作 Agent。写明目标，可附加当前文稿与其他参考文稿；选择不会自动发送，点击开始任务才交给所选模型。
4. 可明确附加本地图片、启用记忆访问，并在任务设置调整思考与轮次。查看计划、执行进展和阅读记录；Agent 提交草稿和记忆候选，由用户决定是否保存。
5. 草稿可展开 Markdown 预览，另存为文稿，或打开逐行 diff 后采纳。当前文稿已切换或修改时，阻止旧草稿覆盖；仍可另存。
6. “继续打磨这份草稿”会明确附上上一份草稿，配合新的目标再执行一次有上限的任务。

快速协作保留原有流式润色、续写与建议路径。写作 Agent 提供工具调用循环；模型需要支持该能力。浏览器预览不直接调用模型，桌面端由 Rust 执行网络请求。

## 实现边界

- `features/navigation` 使用 [cmdk](https://github.com/dip/cmdk)，与已有 Radix Modal 共享主题、键盘和焦点行为。
- `features/editor/search` 使用 ProseMirror Decoration 高亮，按文本块映射位置，跨内联 marks 搜索，禁止跨图片 / 块边界替换。使用 closeHistory 把一次全部替换封装成独立撤销步骤。匹配超过 2000 时要求缩小范围。
- `features/editor/MarkdownSource` 使用 [CodeMirror 6](https://codemirror.net/docs/) 的编辑、历史和搜索能力，保留原始 Markdown、CRLF 与扩展语法。源码工具栏撤销状态来自 CodeMirror。
- `features/agent` 独立管理目标、引用、生命周期、结果和审阅；app 只负责组合。预览使用 react-markdown / remark-gfm，忽略原始 HTML，不请求模型提供的图片或打开模型链接。
- `services/agent` 分为 types、transport、tools、runtime；`commands/agent` 只有异步 IPC 适配；registry、capabilities、Specta 同步注册。
- 状态是具有注销清理的 AgentRequests；取消 token 随任务生命周期释放；前端处理注册前停止、卸载后到达的 Started、重复点击及陈旧结果。
- OpenAI 兼容使用 assistant.tool_calls / role=tool；Anthropic 保留 assistant content blocks，紧随 user.tool_result，遵循 [Claude 工具调用生命周期](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)。本地服务依据 [LM Studio 工具调用接口](https://lmstudio.ai/docs/developer/openai-compat/tools) 与 [Ollama 工具调用能力](https://docs.ollama.com/capabilities/tool-calling) 进行兼容设计。

## 运行约束

参考目录先给模型，正文通过限定工具按需读取；搜索也可能提供相应摘录。只在用户附加的文稿快照中运行，不访问完整文稿库。工具返回内容属于数据，系统提示明确不接受其中的指令；真正权限边界由 Rust 工具白名单保证。

默认 6 个模型轮次，可选择 4 / 6 / 10 / 16；每轮最多 8 个工具调用，网络响应最多 2 MB，含编码图片的请求体上限 16 MB，并单独控制上下文 token 估算预算。每轮有连接 / 请求超时，可取消连接；服务端是否停止计算取决于具体服务。响应截断、无效工具参数和服务错误不会被当作完整草稿。API Key 不进日志或公开配置，可显式保存在系统凭据库，Agent 网络请求禁止自动重定向。

模型能力、图片、记忆、任务历史与后续知识库演进的完整说明见 [AGENT-HARNESS.md](AGENT-HARNESS.md)。

命令面板、CodeMirror 和 Agent 视图按需加载。新增代码维持 500 行硬上限及中文 / 英文目录同步。当前测试范围和后续验收见 DEVELOPMENT-ROADMAP.md 与本轮 audit 记录。
