# Easy Translator

> [**English README**](README.md)

一款 Chrome 扩展，支持翻译网页、PDF 和 Office 文档，可接入多种自定义 LLM 后端（OpenAI、Anthropic Claude、Google Gemini、DeepSeek、Qwen、GLM、**Ollama 本地模型**等）。

## 最近更新

### 2026-06-20

- **品牌统一** — 所有语言（中/英/日/韩）的扩展名称统一为 **Easy Translator**，不再使用「万能翻译器」「Universal Translator」等不同名称
- **自定义 Prompt 系统** — 设置页新增 Prompt 管理器：
  - 支持保存多个翻译 Prompt 模板，随时切换
  - 变量 `{src}` / `{tgt}` 自动替换为源语言/目标语言
  - 批量翻译时自动追加段落标记说明，与自定义 Prompt 兼容
  - 支持保存新模板、更新当前模板、删除模板
- **翻译终止机制** — 新增 `AbortController` 支持：
  - 点击「停止」按钮时不仅在前端终止，还通过 `abortTranslation` 消息中断后台所有进行中的 HTTP 请求
  - 所有 LLM 后端（OpenAI / Anthropic / Gemini / Ollama）均支持 signal 传递
  - 中断后返回 `aborted: true`，避免误报错误
- **右键菜单稳定性修复** — 安装时先调用 `chrome.contextMenus.removeAll()` 清除旧菜单，再创建新菜单项，避免 `duplicate id` 错误

### 2026-06-11

- **Ollama 本地模型支持** — 支持本地 Ollama 模型，包括通过 `ollama train` 训练的自定义模型

## 功能特性

### 页面翻译
- **整页翻译** — 翻译网页上所有文本内容，保持 DOM 结构不变
- **划词翻译** — 选中文本后按 `Alt+T`（macOS 为 `Option+T`）即时翻译
- **右键菜单** — 支持「翻译选中文本」和「翻译整页」两个菜单项
- **显示模式** — 浮动提示、侧边栏、或直接替换原文
- **原文/译文切换** — 翻译完成后可在原文和译文之间切换查看
- **停止按钮** — 随时取消正在进行的翻译
- **自动恢复** — 扩展更新或重新加载后，自动提示刷新页面

### 文件翻译
- **PDF 翻译** — 在自定义阅读器中打开 PDF，将页面渲染为图片，每页下方显示翻译面板，保持原版布局
- **Office 文件** — 支持 PPTX、DOCX 文件的基础文本提取翻译
- **手动打开** — PDF/Office 文件不再自动跳转，通过弹出窗口按钮手动打开

### 翻译引擎
- **并行翻译** — 使用并发工作池（默认 4 个 Worker）分块翻译，速度提升约 4 倍
- **批量翻译** — 使用编号段落标记（`[#N]`）配合 LLM 提示词，实现可靠的批量处理
- **按内容分块** — 按自然布局边界将文本拆分为约 1000 字符的块
- **多 LLM 后端** — 支持 OpenAI 兼容 API、Anthropic Claude、Google Gemini、**Ollama 本地模型**

### 本地 LLM (Ollama)
- **无需 API Key** — 直接连接本地 Ollama 实例
- **自动发现模型** — 自动从 Ollama 获取已安装的模型列表
- **CORS 配置** — 需设置 `OLLAMA_ORIGINS=*` 环境变量

### 缓存机制
- **内存缓存**（Content Script）— 同一次页面会话中即时切换原文/译文
- **后台缓存**（Service Worker）— 页面刷新或导航后仍然有效，避免重复翻译相同 URL

### 国际化 / 本地化
- **自动检测浏览器语言** — 界面根据 Chrome 语言设置在英文、中文、日文、韩文之间自动切换
- 所有弹窗和阅读器界面均已本地化

### 用户体验
- **语言自动保存** — 在弹出窗口中切换源语言/目标语言后立即保存到存储，划词翻译直接生效，无需额外点击「保存设置」
- **API Key 自动隐藏** — 选择 Ollama 作为提供商时自动隐藏 API Key 输入框
- **自定义 Prompt 模板** — 设置页支持保存和切换多个翻译提示词模板

## 架构

```
┌─────────────────────────────────────────────────┐
│                  Chrome 扩展                      │
├─────────────────────────────────────────────────┤
│  popup/                                         │
│  ├── popup.html    快速翻译 + 设置界面           │
│  ├── popup.js      设置逻辑、API 调用             │
│  └── popup.css                                   │
├─────────────────────────────────────────────────┤
│  content/                                       │
│  ├── content.js    页面翻译引擎                   │
│  │   - 文本节点收集与过滤                        │
│  │   - 并行分块翻译（工作池）                    │
│  │   - 划词翻译（浮窗/侧边栏）                   │
│  │   - 原文/译文切换                             │
│  │   - 停止/中断机制                             │
│  ├── content.css   浮动按钮、提示框、横幅          │
│  └── pdf-content.js (旧版，已由 viewer 替代)      │
├─────────────────────────────────────────────────┤
│  viewer/                                        │
│  ├── viewer.html   PDF/Office 翻译界面           │
│  ├── viewer.js     pdf.js 渲染 + 翻译集成        │
│  │   - 页面图片渲染（canvas → 背景图）            │
│  │   - 段落聚类分组（按空间距离）                │
│  │   - 每页下方翻译面板                          │
│  ├── viewer.css                                  │
│  ├── pdf.min.js    (内置 pdf.js 3.11.174)        │
│  └── pdf.worker.min.js (内置 Worker)            │
├─────────────────────────────────────────────────┤
│  lib/                                           │
│  └── translator.js  LLM API 抽象层               │
│      - OpenAI 兼容 (GPT, DeepSeek, Qwen)        │
│      - Anthropic Claude                         │
│      - Google Gemini                            │
│      - Ollama (本地模型)                         │
│      - 批量模式 + 编号段落标记                   │
├─────────────────────────────────────────────────┤
│  background.js    Service Worker                 │
│      - 消息路由（翻译、缓存、PDF）                │
│      - 翻译缓存 (Map, LRU 淘汰)                  │
│      - PDF/Office 文件检测与跳转                  │
│      - 右键菜单创建                              │
├─────────────────────────────────────────────────┤
│  i18n.js          JS 本地化                      │
│      - 浏览器语言检测                            │
│      - data-i18n 属性处理器                      │
│      - 中/英/日/韩 多语言支持                    │
├─────────────────────────────────────────────────┤
│  _locales/        Chrome i18n (扩展名称)         │
│  manifest.json                                   │
│  README_CN.md                                    │
└─────────────────────────────────────────────────┘
```

## 安装方法

1. 克隆或下载本仓库
2. 在 Chrome 浏览器中打开 `chrome://extensions`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择项目目录
6. 点击扩展图标 → 设置 → 配置你的 API Key

## 设置步骤

1. 打开扩展弹窗
2. 进入 **设置** 标签页
3. 选择 API 提供商（OpenAI 兼容、Anthropic、Gemini 或 **Ollama**）
4. 输入 API URL 和 API Key（Ollama 不需要）
5. 选择一个模型
6. 设置源语言 / 目标语言
7. 点击 **保存设置**
8. 点击 **测试连接** 验证

## 使用方法

### 翻译网页
- 点击扩展图标 → **翻译整页**
- 或右键点击页面 → **翻译整页**
- 点击 **↩ 显示原文** / **🌐 显示译文** 切换
- 点击 **✕** 关闭（翻译结果将在本次会话中缓存）

### 划词翻译
- 在页面上选中文本 → 点击浮动的 **🌐 翻译** 按钮
- 或选中文本后按 `Alt+T`（macOS 按 `Option+T`）
- 或右键选中文本 → **翻译选中文本**
- 翻译结果显示在浮动提示框中（或侧边栏，取决于设置）

### 翻译 PDF
- 打开任意 PDF URL 或本地 PDF 文件
- PDF 阅读器自动打开并渲染页面
- 点击 **🌐 翻译** 按钮开始翻译
- 翻译内容显示在每页下方的面板中
- 使用 **← →** 方向键或按钮翻页

### 快速文本翻译
- 打开扩展弹窗 → **翻译** 标签页
- 输入或粘贴文本 → 点击 **翻译**
- 更改语言自动保存，无需点击「保存设置」

### 使用 Ollama (本地模型)
1. 安装并启动 [Ollama](https://ollama.ai)
2. 启动前设置环境变量 `OLLAMA_ORIGINS=*`（参见下方 [Ollama CORS 配置](#ollama-cors-配置)）
3. 打开扩展弹窗 → **设置** → 选择 **Ollama (本地模型)**
4. 点击 **🔄** 刷新模型列表 — 已安装的本地模型自动显示
5. 选择模型，设置源语言/目标语言，开始翻译

### 使用自定义 Prompt 模板
1. 进入 **设置** → **自定义 Prompt** 区域
2. 从下拉菜单中选择已有模板，或编写新的提示词
3. 使用 `{src}` 和 `{tgt}` 变量作为源语言/目标语言占位符
4. 点击 **💾 保存为新模板** 创建新模板，或 **✏️ 更新当前模板** 修改已有模板
5. 批量翻译模式下，系统会自动追加 `[#N]` 编号标记说明

## 技术细节

### 并行翻译（工作池）

页面文本被收集后按约 1000 字符分组，由 4 个并发 Worker 并行翻译：

```
Worker 1: [第0块] ──等待── [第4块] ──等待── ...
Worker 2: [第1块] ──等待── [第5块] ──等待── ...
Worker 3: [第2块] ──等待── [第6块] ──等待── ...
Worker 4: [第3块] ──等待── [第7块] ──等待── ...
```

每个 Worker 原子性地获取下一个块索引（`nextIdx++`），在 JS 单线程事件循环中安全运行。

### 批量翻译格式

为避免不可靠的分隔符，文本段落使用编号标记：

```
输入:
[#1]
Hello world
[#2]
Good morning

输出:
[#1]
你好世界
[#2]
早上好
```

系统提示词指示 LLM 保留标记。响应解析使用正则提取每个编号段落，缺失段落返回 null（保留原文）。

### 翻译缓存

- **第1层 — Content Script 内存**（`fullPageState`）：同一次页面会话中即时切换原文/译文
- **第2层 — Service Worker 内存**（`translationCache` Map）：页面刷新或导航后仍然有效。以 `URL::targetLang` 为键，LRU 淘汰，最多 80 条

当重新访问先前翻译过的页面时：
1. Content Script 收集文本节点
2. 查询后台缓存 → 获取 `[[原文, 译文], ...]` 配对
3. 按内容匹配每个节点 → 立即应用缓存翻译
4. 仅新增/更改的内容触发 API 调用

### PDF 渲染

PDF 页面使用内置的 pdf.js（v3.11.174）渲染：
1. 每页以 1.5x 比例渲染到 Canvas
2. Canvas 设为页面包装 div 的背景图
3. 通过 `page.getTextContent()` 提取文本，按空间聚类分组为段落（Y 轴距离 → 行 → 段落）
4. 每页下方的翻译面板同时显示原文和译文

### macOS 键盘快捷键

macOS 上 `Option+T` 会输出 `†` 字符。扩展使用 `e.code === 'KeyT'`（与键盘布局无关）而非 `e.key === 't'`。

### Ollama CORS 配置

Chrome 扩展运行在 `chrome-extension://` 源下，被 Ollama 默认的 CORS 策略阻止。要使扩展能连接本地 Ollama 实例：

**macOS（Ollama.app）：**
```bash
# 设置持久环境变量
launchctl setenv OLLAMA_ORIGINS "*"
# 然后退出并重启 Ollama（菜单栏 → 退出 → 重新打开）
```

**Linux / 终端启动：**
```bash
OLLAMA_ORIGINS=* ollama serve
```

**Windows（PowerShell）：**
```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```

**持久化配置（Linux systemd）：**
```ini
# /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_ORIGINS=*"
```

### 语言自动保存

在弹窗下拉框中更改源语言或目标语言时，扩展会自动保存选择到存储。这意味着：

- 划词翻译立即使用更新后的语言
- 整页翻译使用更新后的语言
- 语言更改无需再点击「保存设置」

### 扩展重载恢复

当扩展被重新加载时（例如在 `chrome://extensions` 页面更新后），已在页面中运行的 Content Script 会失去与扩展运行时的连接。扩展会检测到这种情况并显示提示，询问是否刷新页面以重新建立连接。

## 权限说明

| 权限 | 用途 |
|---|---|
| `storage` | 保存用户设置 |
| `contextMenus` | 右键翻译菜单 |
| `activeTab` | 访问当前标签页进行翻译 |
| `scripting` | 注入 Content Script |
| `webNavigation` | 检测 PDF/Office 文件导航 |
| `tabs` | 打开 PDF 阅读器，读取标签页 URL |
| `host_permissions` | 访问页面内容进行翻译，支持 file:// 本地文件 |

## 支持翻译的语言

自动检测、英语、中文、日语、韩语、法语、德语、西班牙语、俄语

## 支持的 LLM 后端

- OpenAI（GPT-4o、GPT-4o-mini、GPT-4-turbo）
- Anthropic Claude（Sonnet 4、Haiku 3.5、Opus 3）
- Google Gemini（2.5 Flash、2.5 Pro、2.0 Flash）
- DeepSeek（chat、reasoner）
- Qwen（Plus、Max）
- GLM（4、4v）
- **Ollama（本地模型）** — llama3.2、qwen2.5、gemma2、mistral、phi3 及所有本地拉取的模型
- 任何 OpenAI 兼容 API

## 许可证

MIT