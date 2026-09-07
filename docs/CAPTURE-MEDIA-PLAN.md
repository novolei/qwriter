# 素材与灵感捕捉开发记录

2026-09-07，依据本轮用户请求实施。完成状态以实际验证为准。

## 统一流程

素材入口 → 本地图片 / 视频、链接卡片或剪贴板 → 预览 → 插入文稿 / 保存灵感卡片。

灵感匣位于左栏，采用安静的卡片网格与轻量堆叠入口；新建时展开独立编辑卡片。标题可选，正文先行；附件、来源、固定与归档明确可见。保存后可以再次编辑或插入当前文稿。

桌面全局快捷键：Ctrl/⌘ + Alt + N 空白速记，Ctrl/⌘ + Shift + Space 捕捉已复制的文字 / 图片，Ctrl/⌘ + Alt + S 截图。只响应主动触发，不持续监听剪贴板。应用最小化时仍可用；快捷键注册失败要给出反馈。

截图：捕获屏幕 → 框选和标注 → 结果面板，选择复制、保存文件、灵感卡片、插入文稿或置顶参考图。文字识别与多屏拼接通过独立可取消流程处理。

## 复用方案

- Tauri 官方 clipboard-manager / global-shortcut / opener，沿用 dialog / asset protocol；本地路径由 Rust 校验。
- XCap：Windows / macOS 屏幕捕获。
- react-screenshots：成熟的框选、放大镜、箭头、矩形、椭圆、画笔、文本、马赛克、撤销 / 重做交互；包装业务出口与主题，不重新实现绘图引擎。
- Tesseract.js：本地 OCR，语言与运行文件随应用打包。
- Rust scraper / html5ever + reqwest：本机解析公开网页元数据，不依赖第三方预览代理。
- SQLite：桌面卡片与素材索引；idb / IndexedDB：浏览器预览的卡片和 Blob 持久化。
- Tiptap：图片和媒体块，明确 Markdown 往返协议；浏览器原生 video 播放器。

## 数据和窗口契约

素材复制至应用资产目录，使用内容标识去重；文稿只记录稳定资产引用。卡片按条目与修订号保存，多窗口不互相覆盖。截图与剪贴板图像不发往模型服务。

main、capture、pin 窗口分别授权，捕捉窗口不获得 AI 密钥 / Git 权限。外部网页仅解析安全的 HTTP(S) 公开地址，限制重定向、大小和时间。预览不执行第三方 HTML / JavaScript。

## 本轮验收状态

- [x] 浏览器本地图片和视频导入、预览、重新加载与文稿往返。
- [x] 视频 / 网页卡片及手动封面、解析失败后继续插入；原生自动抓图受本机 Fake-IP DNS 限制，未宣称通过。
- [x] 速记创建、编辑、归档、恢复、搜索、固定和附件；多窗口修订冲突有事务测试，原生窗口同步待实际验收。
- [x] 浏览器剪贴板文字 / 图片速记；原生全局捕捉已实现并构建，最小化流程尚待桌面交互验收。
- [x] 截图框选、标注、复制、卡片和文稿出口；原生文件保存与置顶交互待验收，浏览器下载未取得落盘证据。
- [x] 离线 OCR、手动长图拼接及微信功能差距记录。
- [x] 中英双语、浅深主题、900×640、常规桌面与 1920×1080。
- [x] 内容安全、权限、并发保存、Markdown 往返测试及 Windows 构建。

逐项支持范围与验证证据见 [CAPTURE-MEDIA.md](CAPTURE-MEDIA.md)。上述勾选表示本轮验收记录已完成，不表示所有原生平台交互均已通过。

微信截图完整功能对齐须按实际支持与验证逐项记录，不能仅依据组件存在就宣称全功能等同。macOS 仍需真机屏幕录制权限与输入法验证。

## 研究来源

- https://v2.tauri.app/plugin/clipboard/
- https://v2.tauri.app/plugin/global-shortcut/
- https://github.com/nashaofu/xcap
- https://github.com/nashaofu/screenshots/tree/master/packages/react-screenshots
- https://github.com/naptha/tesseract.js
