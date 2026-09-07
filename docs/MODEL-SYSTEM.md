# 模型管理与调用系统

更新：2026-09-07。

模型池现可展开“模型能力与上下文”，分别标记图片、工具调用、思考协议和上下文容量；未知能力不会因连接成功自动变为支持。标记通过公开配置白名单持久化，随模型备份迁移。手动确认的工具能力优先于历史验证记录。图片附件、thinking 与 effort 的实际协议和限制见 [AGENT-HARNESS.md](AGENT-HARNESS.md)。

## 使用路径

1. 设置 → 模型连接 → 供应商，添加连接、选择服务预设并命名。高级区域可调整地址和协议。
2. 填写 API Key。默认只在会话内存，点击「记住密钥」后使用 Windows Credential Manager / macOS Keychain。保存失败不会丢失会话密钥，已保存密钥可改为仅本次会话。
3. 「连接并获取模型」检查鉴权和目录，显示模型数量及延迟。勾选多个模型加入模型池；不提供 `/models` 的服务支持手动填写 ID 与别名。
4. 「我的模型池」管理名称、启用、移除和当前选择。「验证 Agent」以内置素材实际测试读取参考、回传工具结果与草稿提案，最长 90 秒，不发送用户文稿，可能产生少量 API 费用。
5. 写作面板底部随时打开模型切换器，按供应商分组搜索，用方向键 / 回车切换。新增供应商与模型保留既有当前选择；空模型池添加首个模型时才自动选择。

快捷切换器在任务执行期间禁用。设置中的选择只影响下一次任务；当前任务持有配置快照，不在工具调用中途更换模型或密钥。移除 / 隐藏当前模型后选取第一个启用模型；全部禁用时保持未配置状态。不会自动将失败请求重发到另一家服务。

## 分层契约

| 模块 | 职责 |
| --- | --- |
| `types.ts` | Provider 连接与 PoolModel 条目，远程模型 ID 与本地条目 ID 分开 |
| `presets.ts` | 传输预设；模型可用性以真实目录与验证为准 |
| `persistence.ts` | 版本化持久化、字段白名单、旧配置迁移、去重与悬空引用清理 |
| `useModels.ts` | 状态编排、当前模型解析、共享密钥、发现与验证摘要 |
| `useProviderCredentials.ts` | 显式保存 / 忘记、启动读取、版本检查，防止迟到的读取覆盖新输入 |
| `useConnection.ts` | 校验、防重复、过期结果过滤，发现和生成验证分离 |
| `ProviderEditor` / `CredentialFields` / `ModelCatalog` | 连接、认证、发现与多选入池 |
| `ModelPool` / `ModelSwitcher` | 全局模型管理与两种写作模式共用的快捷选择 |
| Rust `provider/connection.rs` | 限时、无重定向、2 MB JSON 上限、目录规范化、分类错误 |
| Rust `agent/verification.rs` | 复用真实 Agent 循环，动态测试码证明读取和草稿工具调用 |
| Rust `credentials.rs` | keyring 4.2 平台存储；commands 层通过 spawn_blocking 与共享锁访问 |

所有 IPC 由同一个 Rust 注册表生成 Specta TypeScript 类型，capabilities 显式列出实际使用的命令。手写模块保持 500 行以内。

```text
ModelWorkspace v1
  providers[]: id / name / kind / baseUrl / protocol
               catalog[] / discoveredAt / credentialOrigin
  models[]: id / providerId / model / name / enabled / verification
  selected: PoolModel.id

resolve(selected) → ModelConfig 快照 → Rust 协议适配 → 模型服务
providerId + origin → 系统凭据库中的独立密钥
```

## 持久化与凭据

公开配置以单个版本化 JSON 保存在 `qwriter.model-workspace.v1`，包括供应商、模型池、目录缓存、名称、启用状态与当前选择。旧 `qwriter.profiles` / `qwriter.profile-id` 自动迁移，保留旧记录供恢复；同域名的旧账号不会自动合并。同一远程 ID 可属于不同供应商，同一供应商下不重复添加。

序列化逐字段挑选，API Key 不进入公开配置、文稿或日志。系统保存状态只在成功写入后记录；删除供应商先移除关联系统密钥，失败时保留连接供恢复。系统保存支持 Windows/macOS，其余平台返回明确错误并可使用会话模式。

密钥绑定连接 ID 与来源（scheme / host / port）。更换服务或来源清空会话密钥，原系统密钥仍只绑定旧来源，可显式更新或移除。API 请求禁止自动重定向，错误不回显服务响应体。编辑密钥或传输配置会使原验证摘要失效。

浏览器预览和桌面 WebView 的存储各自独立。浏览器可以管理公开配置，不建立本地 IPC 代理，不直接携带密钥访问服务；连接检测与安全保存需要桌面环境。

“曾通过 Agent 验证”是带时间的历史记录，不保证服务当前在线。目录缓存也不代表实时健康状态。目前不含自动跨服务失败转移、OAuth、密钥轮换、视觉输入、任意参数透传和完整上下文预算，后续需按明确协议扩展。

## 配置备份与迁移 · 2026-09-07

入口：模型与连接 → 备份与迁移。格式为 `qwriter.models` / version 1，包含经过字段白名单重建的供应商、模型与默认模型引用。最大 2 MB，最多 100 个供应商、2000 个模型。非法版本、断裂引用、重复 ID、不支持的协议与包含用户信息/查询/片段的地址在应用前拒绝。

不传输 API Key、credentialOrigin、发现缓存或验证结论。每个新增连接与模型生成本机新 ID，避免关联本机已有凭据。已有配置及当前启用模型保留；空池才采用备份中的启用模型。

先选择文件、预览供应商地址及数量，再确认导入。默认跳过内容相同的连接，也可创建独立副本；重名自动编号，重复导入也识别先前自动编号的同一份配置。不会按同域名自动合并账号或自动请求模型。

导入用最新工作区重新规划，一次写入现有配置存储，成功才更新界面；写入失败保留原池与预览供重试。异步读文件包含陈旧结果与卸载保护。协议解析、合并规划、文件适配、UI 各自独立，使用 shared Select 与既有设置外框，无新增 IPC/原生权限。

浏览器下载 JSON；桌面通过原生保存对话框及其动态文件权限写入。导入使用文件选择器，读取后先验证。跨设备传输由用户自行选择方式，未加入云同步。

## 模型服务实测

- DeepSeek 官方目录返回 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp`、`deepseek-v4-pro`。选 Flash 验证；未将实验视觉模型视为已支持图片输入。
- `model_verify` 使用的真实 Agent 流程完成读取动态测试码与提案，约 1.55 秒。
- 真实写作执行 `search_documents → read_document → propose_draft` 三轮，生成 93 字符中文草稿，保留纸船意象与二级标题。使用合成素材，没有发送用户文稿。
- 用户临时密钥仅注入测试进程环境，退出后清除；不进入源码、配置、日志或系统凭据。`deepseek_live_writing_flow` 默认 ignored，常规检查不会计费。
- Windows 凭据创建、重新读取和移除以独立临时测试项通过；测试项已删除。macOS 已接入平台适配，仍需真机验证。
- 自动回归覆盖迁移、密钥共享、选择持久化、失效引用恢复、迟到的系统读取 / 服务响应、完整添加 / 验证流程和搜索后回车切换。

## 参考与取舍

借鉴供应商与模型引用、别名、明确设置当前模型的分离思路；增加认证不会替换既有主要模型。参考配置管理的组织方式，结合本地写作范围实现类型化模块，没有引入其他 Agent 的完整运行时。[OpenClaw 模型供应商](https://docs.openclaw.ai/concepts/model-providers)、[Hermes 配置](https://hermes-agent.nousresearch.com/docs/user-guide/configuration/)。

DeepSeek 的原 assistant 协议字段（包括 `reasoning_content`）保留给后续工具 API 请求，隐藏推理不在界面展示。[DeepSeek 工具调用](https://api-docs.deepseek.com/guides/thinking_mode/)。凭据加密及平台集成复用社区组件：[keyring](https://github.com/open-source-cooperative/keyring-rs)。
