# Agent 开源设计审阅与 Qwriter 采用计划

审阅日期：2026-09-07。实际读取两个仓库的代码，而非只依赖 README。参考版本固定如下：

- DeepSeek Harness：[`d347e703908d0406b7a7ef80e3a0e594d86b2215`](https://github.com/deepseek-ai/deepseek-harness/tree/d347e703908d0406b7a7ef80e3a0e594d86b2215)，MIT。
- OpenHanako / Hana：[`1d3ef308299e9f630786384e77de45444ea59196`](https://github.com/liliMozi/openhanako/tree/1d3ef308299e9f630786384e77de45444ea59196)，Apache-2.0。

本次采用其分层和协议设计思想，在现有 Rust 服务中自行实现小型适配器；没有复制源码、引入其完整运行时、安装插件或执行其脚本。

## 值得采用的设计

| 来源与实际实现 | 对 Qwriter 的意义 | 本轮状态 |
| --- | --- | --- |
| DeepSeek Harness 的 Agent、loop、LLM、tools、session 分域 | 循环负责调度，能力由小接口提供，便于替换与测试 | 新增异步 KnowledgeRetriever；检索、数据库、模型适配与 UI 分离 |
| Harness 区分用户 turn 和模型请求 + 工具组成的 step | 有明确轮次、工具边界、停止与失败语义 | 延续有界循环，补齐等待检索期间的取消与迟到结果保护 |
| Harness 追加式 session events，并由日志投影模型历史 | 任务恢复应从事实记录推导，不应盲目重跑工具 | 本轮持久化片段证据；完整事件日志、检查点和请求重建仍待实现 |
| Hana 的 provider compatibility 唯一入口、按厂商分文件 | OpenAI-compatible 不代表 thinking 与续轮完全兼容 | 新增 provider_policy，统一出站预算、DeepSeek 续轮校验 |
| Hana 把思考语义、模型能力、序列化层分开 | 用户档位不能在 SDK 中被无声改写；要测最终请求 | 增加 DeepSeek max，保留用户偏好，切换其他适配器时按支持范围映射 |
| Hana memory v2 的元事实、标签、日期与 FTS5，编译记忆分层 | 长期事实与核心偏好分开，允许按需搜索 | 本轮接通 FTS5 与范围隔离；标签、日期过滤和编译摘要列入下一阶段 |
| Hana Vision Bridge 的辅助视觉模型、来源缓存与超时 | 不支持视觉的写作模型可以消费有来源的图像描述 | 待实现，须显示辅助模型和发送目的地，不能静默切供应商 |

代码依据：Harness [架构和循环流程](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/docs/architecture.md)、[loop 实现](https://github.com/deepseek-ai/deepseek-harness/tree/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/core/agent-loop/src)；Hana [provider 边界](https://github.com/liliMozi/openhanako/blob/1d3ef308299e9f630786384e77de45444ea59196/core/provider-compat/README.md)、[记忆检索](https://github.com/liliMozi/openhanako/blob/1d3ef308299e9f630786384e77de45444ea59196/lib/memory/memory-search.ts)、[事实库](https://github.com/liliMozi/openhanako/blob/1d3ef308299e9f630786384e77de45444ea59196/lib/memory/fact-store.ts)、[记忆快照](https://github.com/liliMozi/openhanako/blob/1d3ef308299e9f630786384e77de45444ea59196/lib/memory/compiled-memory-snapshot.ts)、[Vision Bridge](https://github.com/liliMozi/openhanako/blob/1d3ef308299e9f630786384e77de45444ea59196/core/vision-bridge.ts)。

这里有一个重要发现：当前 Hana 的 memory v2 明确替代了先前的 embedding KNN 方案，主要使用标签与 FTS5。因此不能把“先进 Agent”简单等同于“必须先上向量库”。Qwriter 先把范围、来源、版本、查询质量和可测量的词项基线做好，再评估语义检索的收益。

## DeepSeek 特殊处理：实际采用与差异

依据 Hana 的 [deepseek.ts](https://github.com/liliMozi/openhanako/blob/1d3ef308299e9f630786384e77de45444ea59196/core/provider-compat/deepseek.ts)、[reasoning replay](https://github.com/liliMozi/openhanako/blob/1d3ef308299e9f630786384e77de45444ea59196/core/provider-compat/reasoning-content-replay.ts)、[输出预算](https://github.com/liliMozi/openhanako/blob/1d3ef308299e9f630786384e77de45444ea59196/core/provider-compat/deepseek-thinking-budget.ts)，并核对 [官方 thinking 文档](https://api-docs.deepseek.com/guides/thinking_mode/)、[Chat Completions 参数](https://api-docs.deepseek.com/api/create-chat-completion/)、[官方 Oh My Pi 集成说明](https://api-docs.deepseek.com/quick_start/agent_integrations/oh_my_pi/)。

1. **真实推理字段回传。** 工具续轮保留服务实际返回的 reasoning_content。合法空字符串可保留；缺字段或 null 不能被伪造成空字符串。Qwriter 在执行工具前及组装后续请求时校验，给出可操作错误。原文不进入 UI 或持久化结果。
2. **正文与推理分开。** 工具调用消息的正文可能为 null；出站副本把正文规范为字符串，不改动原始消息，也不把普通正文冒充 reasoning_content。
3. **思考开关与 effort 分开。** 使用 thinking.type=enabled/disabled；轻量→low，均衡/深入→high，最高→max。界面明确解释映射。服务默认模式不覆盖 thinking 参数；官方 V4 / reasoner 的默认续轮约束仍要检查。
4. **输出预算独立。** DeepSeek 开启思考时，本轮为输出预留 min(32768, contextWindow/2)，其余模型预留 8192。系统、工具定义、安全余量与输入也纳入预算。已有更小的预算不被适配层放大；达到输入上限先压缩旧工具结果，再决定是否停止。
5. **移除不兼容控制。** DeepSeek 思考请求不传 tool_choice，也不依赖该模式忽略的 temperature / top_p / penalty 参数。关闭思考时仅在出站副本移除历史推理字段。
6. **明确匹配边界。** 仅匹配用户声明的 DeepSeek 适配器或精确的 api.deepseek.com 主机；不会因一个中转域名“包含 deepseek”而误套协议。其他供应商有独立出站参数。

不能直接照抄旧注释：Hana 文件头仍有早期“低档统一 high”“预算至少 32768”的描述，但当前函数已保留 low，且不再盲目抬升已有预算；官方资料不同抓取版本的 xhigh 映射也有差异。Qwriter 提供显式 max，避免依赖旧别名或注释推断。

当前实现面向 DeepSeek 的 OpenAI Chat Completions 接口。Hana 还包含 DeepSeek Anthropic profile、Responses API 的独立处理；Qwriter 尚未补齐这些专门适配，不能声称它们与官方 Chat Completions 已同等验证。

Hana 的可选角色沉浸提示与内部情绪独白不纳入本次写作工具：Qwriter 的角色应由真实能力、资料来源、写作偏好和用户目标定义。对用户展示计划、工具进展、证据与结论，保持内部推理私有。

## 建议的后续架构顺序

1. **SessionJournal → 投影与恢复。** 追加记录用户目标、模型配置指纹、工具请求、工具结果、来源版本、草稿提案和结束原因。序号、事务提交、幂等键与恢复状态分开；崩溃后不自动重放写入工具。精确请求历史含私有资料，需要单独设计留存与清理策略。
2. **MemoryCompiler → 有审阅的长期整理。** 用户规则、事实、近期任务摘要、长期项目知识分层。候选携带证据 ID、范围和修订；冲突合并、归档与遗忘由可检查的策略控制。不能把自动摘要当成新的事实来源。
3. **检索评估 → 标签/日期 → 可选混合检索。** 先扩大中英真实语料，再比较 BM25、标签及本地 embeddings。EmbeddingProvider 保持独立；索引记录模型、维度和分块版本。无需引入独立向量服务器作为默认依赖。
4. **ToolRegistry → 声明式执行策略。** 工具声明 schema、scope、只读或写入、超时、取消和幂等类别；循环通过统一前置校验与后置回执调用。重试只发生在明确可重试的模型请求边界，绝不把已执行工具随请求一起重跑。
5. **辅助模型 → 显式路由。** 用户可配置视觉、轻量摘要或重排模型。每个任务显示使用的服务、输入类别与失败回退。模型切换从新请求边界开始，不跨厂商移植 opaque thinking/signature。

DeepSeek Harness 的 Cordis 插件树、Hana 的 Pi SDK 都属于各自 Node/Electron 体系。直接塞入整个运行时会增加 sidecar、生命周期、权限和多语言状态同步成本。本轮采用其能力边界，以现有 Tauri/Rust、SQLite、Specta、Radix 和 react-markdown 承担实际能力；后续是否引入 SDK 应由可替代的具体能力和验收收益决定。

本次技术与 UI 验收见 [REVIEW.md](audit/2026-09-07-retrieval/REVIEW.md)。真实 DeepSeek 网络与 macOS 真机仍需后续验证，不以本地协议模拟代替。
