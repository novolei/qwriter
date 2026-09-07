# 知识分块、来源定位与检索增强

更新：2026-09-07。关键词检索已进入 Agent 循环；本阶段不包含向量嵌入、网页抓取或 PDF 解析。

## 用户路径

写作 Agent →「记忆与知识」→ 新增、收藏当前文稿或导入 Markdown / TXT → 搜索关键词 → 阅读命中片段 → 打开来源，定位到对应章节和行 → 编辑知识条目。

开启「允许本次任务检索记忆与知识」后，Agent 可以按目标检索、读取完整片段，再起草。结果中的「检索到的知识来源」能回看来源快照。Agent 预览仅为实际返回的片段注册引用按钮；模型捏造的片段 ID 不会获得打开能力，普通外部链接仍显示为文字。

来源是知识收藏的独立副本，不代表自动跟随原始文稿、外部文件或网页更新。收藏原稿不会改动原始 Markdown。

## 职责与协议

```mermaid
flowchart LR
  A[用户确认的知识条目] --> B[SQLite 保存事务]
  B --> C[章节与段落分块]
  C --> D[FTS5 索引]
  E[Agent 工具 / 知识检索界面] --> F[KnowledgeRetriever / IPC]
  F --> D
  D --> G[有范围、版本与位置的片段]
  G --> H[Agent 参考与来源预览]
  H --> I[用户审阅草稿]
```

| 模块 | 责任 |
| --- | --- |
| `services/knowledge/chunks.rs` | 分块、位置契约、CJK 词项 |
| `services/knowledge/index.rs` | SQLite FTS5 查询、增量索引、迁移、范围过滤 |
| `services/knowledge/retriever.rs` | 异步检索能力接口及本地实现 |
| `services/agent/memory_tools.rs` | 受限检索工具、来源回执、片段数量预算 |
| `features/knowledge/KnowledgeSearch` | 防抖、陈旧请求隔离、检索卡片 |
| `features/knowledge/KnowledgeSource` | 来源定位、历史快照、版本变化提示 |
| `features/agent/KnowledgeEvidence` | 已检索来源、预览内的受控引用按钮 |

新增 IPC 为 `knowledge_search(query, documentId)` 和 `knowledge_source(memoryId, documentId)`。Rust DTO 经 Specta 导出；只有 main 窗口获准调用。路径由 Rust 固定为 app_data_dir，不接受任意文件路径。

`KnowledgeRetriever` 的 search/read 返回异步结果。SQLite 在 spawn_blocking 中执行；Agent 等待期间可以取消，不会继续把迟到的结果送入下一次模型请求。已经进入 SQLite 的短事务可能正常结束，不声称能中断操作系统中的任意 I/O。

## 分块与定位契约

- 以 ATX 章节标题和段落边界组织，保留最多六层标题路径；围栏代码中的 `#` 不当作章节。
- 普通段落尽量累积到 300 字符再在空行处分块；每块最多 1200 个 Unicode 标量。较短章节可以独立成块，超长段落或代码会在硬上限切分。
- 这是轻量结构分块，不是完整 CommonMark AST：Setext 标题、复杂 HTML、嵌套容器等仍按原始文本保存和检索。
- ID 为 `memoryId:revision:v1:ordinal`。同一修订和分块版本中稳定，修订变化后旧 ID 故意失效。修改分块算法时必须升级索引版本与 ID 格式，并同步浏览器适配器及位置测试。
- `startOffset/endOffset` 计 Unicode 标量，前闭后开；不是 UTF-8 字节或 JavaScript UTF-16 单元。浏览器用 `Array.from` 转换后定位。
- `startLine/endLine` 从 1 开始，保留原始 CRLF、空行和表情字符。片段正文必须等于原文相应范围，不做重排或格式化。

来源视图先读取当前条目。只有修订相等、该范围正文也完全相等时才高亮原位置。来源变化后展示检索时的快照，并提供「查看当前版本」；不会拿旧行号定位新正文。来源已归档或离开范围时只展示任务已持有的快照。

## 索引与排序

事实源仍为 `knowledge.sqlite3` 中的 memories。派生表为 knowledge_chunks、knowledge_index 和 knowledge_fts；旧 memory_search IPC 保留兼容。

保存条目、删除旧片段、建立新索引、更新索引修订位于同一 IMMEDIATE 事务中。归档删除该条目的可搜索片段；恢复重新建立。首次检索对旧条目执行事务化回填，以索引版本和条目修订判断，不修改原始记录。

检索流程：

1. 校验查询最多 300 字节，提取最多 24 个不重复词项。
2. 英文使用词项；中文等 CJK 内容补充单字和双字词项，使短查询不必扫描所有正文。查询中的标点与 FTS 运算符不会作为执行表达式。
3. SQLite FTS5 执行 OR 召回和 BM25 排序，标题权重 8、章节权重 4、正文权重 1。
4. **范围过滤先于候选上限**：只检索全局和本次文稿范围。最多取 256 个候选。
5. 按词项覆盖、完整短语匹配和 BM25 重排；每个来源最多 3 块，界面最多 24 块。

每次 Agent 搜索最多返回 6 个片段、各 360 字符摘录。read_memory 使用搜索返回的版本化片段 ID，读取最多 1200 字符的完整片段。工具回执含来源、章节、修订、行号和 citationUrl。无效、过期或越界片段要求重新检索，不能越过 scope 读取全文。

每次任务最多保留 48 个不同来源片段。达到上限时新片段不再交给模型，回执明确 sourceLimitReached；不会发送却不记录来源。已检索不代表已核实，也不保证模型最终引用了该片段。

## 上下文与持久化

任务启动只加载最多 6 条已确认写作偏好，每条最多 500 字符进入上下文。事实与知识不再整库预载，由检索接口按需提供。

任务结果持久化包含 knowledgeSources 快照；旧任务缺少字段时按空数组读取。快照保存完整片段，可能比搜索时发送的 360 字符摘录长；它不等于完整模型请求日志。原始 `reasoning_content` 仍不进入任务历史或界面。

应用内部 `#knowledge-…` 引用仅在 Agent 预览中绑定来源。通用 Markdown 编辑器与外部导出尚未提供这类引用的跨应用解析；正式稿件仍应整理成可独立阅读的来源说明或脚注。

## 浏览器与桌面的差别

桌面使用 Rust / SQLite FTS5。浏览器演示使用 IndexedDB 和独立的内存排序适配器，保留相同分块、位置、scope、修订与归档契约；它没有 SQLite BM25，排序分数不保证与桌面完全相同。浏览器不会直接请求模型或把知识同步到云端。

管理列表仍会加载最多 1000 条条目。大知识库的分页管理、索引重建进度、永久删除、备份导入导出和磁盘预算是后续工作；本次改掉的是 Agent 的整库预载路径。

## 评估与后续

本机固定小语料包含 6 份资料和 12 条中英文查询，Recall@6 和首位来源命中均为 12/12；索引约 72.46 ms，12 次查询及相应来源读取合计约 32.78 ms。只是这份小样本、Windows 调试构建的一次测量，不能外推到大型知识库或语义问答质量。

下一阶段先扩大带真实写作任务的评估集，再接入可选 EmbeddingProvider、混合检索和重排。嵌入索引需要记录模型标识、维度、分块版本、原文修订；更换模型必须重建，离线或服务失败时回到词项检索。没有用户明确配置的嵌入服务时，不自动发送知识到第三方。

研究依据与选择理由见 [AGENT-REFERENCE-REVIEW.md](AGENT-REFERENCE-REVIEW.md)，本轮验收见 [audit](audit/2026-09-07-retrieval/REVIEW.md)。
