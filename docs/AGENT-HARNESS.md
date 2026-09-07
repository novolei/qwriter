# Qwriter Agent Harness 与本地知识库

更新：2026-09-07。本文区分已经实现的运行边界与后续扩展设计；不以“与某个 Agent 功能完全相同”作为验收结论。

## 产品路径

模型池 → 确认模型能力 → 写作 Agent → 选择文稿 / 图片 / 记忆访问 → 给出目标 → 计划与工具进度 → 审阅草稿 → 采纳或另存 → 审阅新记忆。

平时只展示图片、记忆与知识、任务设置三个紧凑入口。思考强度、步骤预算等高级选项按需展开。模型选择始终由用户控制，不在任务中静默改用另一个服务。修改文稿和保存 Agent 建议的记忆分别确认。

## 本轮落地的职责划分

| 层 | 模块 | 责任 |
| --- | --- | --- |
| 模型能力 | features/models/capabilities、CapabilityEditor | 文字、图片、工具、思考协议、上下文容量；公开配置与备份白名单 |
| 用户工作台 | features/agent | 附件、偏好、任务生命周期、可见进度、草稿审阅、历史恢复 |
| 原生适配 | commands/agent、commands/knowledge | 生成 IPC、状态注入、阻塞工作转交后台 |
| 运行循环 | services/agent/mod | 取消、轮次、上下文预算、网络和工具调度 |
| 上下文 | services/agent/context | 图片预处理、参考目录、偏好装配、旧结果压缩 |
| 协议 | services/agent/transport、options | OpenAI / Anthropic 消息、工具和 thinking 参数适配 |
| 工具 | services/agent/tools、harness_tools | 限定文稿、计划、记忆检索 / 阅读 / 候选、草稿提案 |
| 本地资料 | services/knowledge | SQLite、FTS5、修订冲突、范围、归档与任务结果历史 |

前端只使用生成 commands 与 DTO。capture、pin 窗口不获得记忆、模型或 Agent 权限；密钥仍由既有凭据系统管理。

## 模型能力与图片理解

“连接成功”“工具验证通过”“支持图片”“支持可调思考”是独立状态。未知能力保持未知，不从模型名称猜测；工具验证仅在服务地址和协议仍匹配时生效。可在模型池展开“模型能力与上下文”确认能力，模型选择菜单显示相同标记。

写作 Agent 接受本地选择、剪贴板粘贴与显式添加的文稿本地图片。最多 4 张；附加后先显示缩略图并允许移除。图片能力未确认时阻止发送。切换文稿会清空附件，并忽略旧文稿迟到的导入结果。

Rust 从应用素材库按经过校验的 ID 读取，验证 MIME、32 MB 文件上限与 4000 万像素上限。模型用副本缩到最长边 1600 px、转换 JPEG；原图和文稿不变。OpenAI 使用 image_url 数据块，Anthropic 使用 base64 image 数据块。远端图片链接不会被自动抓取；细小文字、透明度、GIF 动画与高清细节可能因静态 JPEG 预处理丢失。实际理解质量仍由模型决定。

## 运行控制与“自我认知”

这里的自我认知指准确的角色、运行环境和能力声明，不指意识或无限权限。系统提示包含当前模型、协议、输出语言、工具边界、步骤预算和审阅流程。模型只看到实际启用的工具定义。

可用工具：

- search_documents / read_document：只能访问本次显式附加的文稿快照，正文按 4000 字符分页。
- update_plan：最多 6 个可见工作步骤，可更新计划；不展示模型私有推理。
- propose_draft：提交完整草稿，不能直接改文稿。采纳前仍检查原稿是否改变。
- search_memory / read_memory：仅在用户启用记忆访问时提供，限定工作区与当前文稿范围。
- propose_memory：最多提出 4 条待审阅候选，工具回执明确 saved=false。

系统提示要求复杂任务按“明确目标 → 计划 → 阅读依据 → 起草 → 核对 → 提交审阅”工作；这是给模型的流程约束，不是对模型一定完成事实核验的保证。工具白名单和修订检查提供实际执行边界。没有新增 shell、联网搜索、任意文件读写或外部消息工具。

默认 6 个模型轮次，可选择 4 / 6 / 10 / 16；每轮最多 8 个工具调用。每次网络连接 20 秒超时，请求 180 秒超时；任务可停止。取消不会自动意味着供应商停止计费。Agent 当前逐轮返回文本和工具进度；快速协作保留逐 token 流式输出。

## Thinking 与 effort

模型池中选择对应思考协议后，任务设置允许“服务默认 / 开启 / 关闭”和“轻量 / 均衡 / 深入”。服务默认不发送覆盖参数。

| 适配器 | 开启时的映射 |
| --- | --- |
| OpenAI | reasoning_effort: low / medium / high |
| DeepSeek | thinking.type=enabled；effort 轻量为 low，均衡和深入为 high |
| Anthropic 手动 | thinking budget_tokens: 1024 / 4096 / 6144 |
| Anthropic adaptive | thinking.type=adaptive；output_config.effort: low / medium / high |

协议选择必须匹配供应商协议；具体模型仍可能不支持其中某些参数，需要依照该模型文档确认。工具后续请求保留服务要求回传的 reasoning_content 或 thinking blocks / signatures，它们不会出现在界面和持久化任务历史中。

## 推荐的分层记忆架构

不把所有历史聊天永久拼接到 system prompt。采用“少量稳定规则 + 按需知识 + 可回看的任务 + 有审阅的记忆整理”。

| 层 | 本轮状态 | 用途 |
| --- | --- | --- |
| 角色与工具规则 | 已实现，代码中的版本化系统规则 | 当前模型和权限、写作流程、审阅边界 |
| 用户写作偏好 | 已实现，已确认记录中最多 6 条、每条最多 500 字符 | 简短、稳定且有来源的写作要求 |
| 当前任务工作上下文 | 已实现 | 目标、参考目录、图片、可见计划、工具结果 |
| 长期事实 / 知识素材 | 已实现基本存储、范围、检索、分页阅读 | 事实约定、导入 .md / .txt、当前文稿的独立收藏副本 |
| 情景历史 | 已实现最近 100 次任务结果 | 查看旧成果、接着打磨；不是完整聊天事件日志 |
| 自动记忆整理 | 候选审阅已实现；后台合并与遗忘策略待实现 | 模型提出 → 用户编辑确认 → 保存，而不是静默写入 |

每条 MemoryEntry 有 id、kind、title、content、source、documentId、revision、updatedAt、archived。全局范围和文稿范围显式选择。更新用乐观修订校验，防止两个窗口覆盖彼此；归档退出新任务的检索，可恢复。已经发出的任务使用自己的快照，归档无法撤回供应商已经收到的内容。

原生事实源是 app_data_dir/knowledge.sqlite3，使用事务、WAL、FULL 同步与 FTS5 trigram 索引。浏览器演示使用独立 IndexedDB，二者不会自动迁移。当前每条最多 128 KB，总计最多 1000 条（包含归档）。UI 搜索和运行中的 Agent 在已加载的有限快照中作字面匹配；原生 memory_search 已有 FTS5 查询，但尚未替换为流式检索适配器。尚无向量嵌入或语义检索，不应将其宣传为完整 RAG 引擎。

开启记忆访问意味着相关文本可能发送到当前模型服务。权限默认关闭，可以保存为用户偏好。所有内容、图片和来源都视为资料，不能给 Agent 新增权限；当前用户要求优先于旧偏好。候选来源是模型声明，需用户核对，并不等同于经过验证的事实。

## 上下文治理

先发送文稿目录，再按需阅读正文。上下文容量是用户确认的模型元数据；估算使用字符权重和图片配额，明确是估算而非供应商精确 token 用量。保留约 12000 tokens 给系统、工具定义和输出。

超出预算时压缩较旧的参考工具结果，保留初始目标、最近结果、assistant / tool 配对，以及供应商要求保留的思考状态。模型可按 ID 再读资料。仍放不下时停止并提示缩小附件或调整已确认容量；不静默丢掉用户目标。图片 base64 不按普通文本估算；请求体另设 16 MB 防线，响应维持 2 MB 上限。

恢复旧任务仅恢复结果和草稿，不恢复对当前文稿的覆盖授权；可另存或携带上一份草稿继续生成。历史不含 API Key、原始参考全文或原始私有推理，但结果本身可能包含用户资料，仍属于本地私有数据。

## 下一阶段与验收条件

1. 定义异步 MemoryRetriever 接口，将 FTS5 按范围检索接入运行循环，避免预载整个知识库；补中英文检索评估集，测 recall、来源准确率和耗时。
2. 知识文档分块、稳定 chunk ID、来源版本、去重与失效标记；支持逐段引用并回到原文。
3. 在关键词基线合格后增加可选本地 embedding、混合检索与重排；先明确模型下载、索引重建、磁盘预算和离线行为。
4. 记忆审阅队列、冲突合并、有效期、可导出 / 导入的用户规则与知识备份；新增永久删除需独立交互与索引删除验证。
5. 追加式任务事件日志、崩溃后恢复检查点、上下文摘要版本和精确用量回执。恢复有副作用工具前重新审核权限，不盲目重放。
6. 扩展 ToolRegistry / ModelAdapter 接口后再评估 MCP 或第三方插件；插件必须声明 scope、参数 schema、风险、超时和取消。当前不加载任意外部插件。

## 参考依据与采用边界

- [OpenClaw Agent loop](https://docs.openclaw.ai/concepts/agent-loop)：参考任务循环、上下文装配和生命周期分层。
- [OpenClaw memory](https://docs.openclaw.ai/concepts/memory)：参考长期资料与工作上下文分离、范围和按需读取。
- [Hermes memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/)：参考小容量核心偏好与可搜索历史分离。
- [DeepSeek Harness 架构](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)：参考 session、system prompt、工具和模型适配器边界；不直接嵌入其整套 Node 插件运行时。
- [Claude Code memory](https://code.claude.com/docs/en/memory)：参考模块化、作用域明确、可审阅的规则与记忆。
- [DeepSeek thinking](https://api-docs.deepseek.com/guides/thinking_mode/) 与 [Anthropic extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)：参数与多轮状态保留的协议依据。

这些项目的设计被用作分层与协议参考，不代表 Qwriter 已有其全部功能。具体测试证据见本轮 audit 记录。
