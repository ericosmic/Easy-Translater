# Easy Translator

> **最近更新**: 2026-06-20 — 见下方 [更新日志](#更新日志)

A Chrome extension that translates web pages, PDF files, and Office documents using custom LLM backends (OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Qwen, GLM, **Ollama local models**, etc.).
## 更新日志

### 2026-06-20

- **品牌统一** — 所有语言（中/英/日/韩）的扩展名称统一为 **Easy Translator**，不再使用「万能翻译器」「Universal Translator」等不同名称
- **自定义 Prompt 系统** — 设置页新增 Prompt 管理器：
  - 支持保存多个翻译 Prompt 模板，随时切换
  - 变量 `{src}` / `{tgt}` 自动替换为源语言/目标语言
  - 批量翻译时自动追加段落标记说明，与自定义 Prompt 兼容
  - 支持保存新模板、更新当前模板、删除模板
- **翻译终止机制** — 新增 `AbortController` 支持：
  - 点击"停止"按钮时不仅在前端终止，还通过 `abortTranslation` 消息中断后台所有进行中的 HTTP 请求
  - 所有 LLM 后端（OpenAI / Anthropic / Gemini / Ollama）均支持 signal 传递
  - 中断后返回 `aborted: true`，避免误报错误
- **右键菜单稳定性修复** — 安装时先调用 `chrome.contextMenus.removeAll()` 清除旧菜单，再创建新菜单项，避免 `duplicate id` 错误

### 2026-06-11
- **Ollama local model support** — supports local Ollama models, including custom models trained with `ollama train`
  

## Features

### Page Translation
- **Full page translation** — translates all text content on a web page while preserving DOM structure
- **Selection translation** — select text and press `Alt+T` (or `Option+T` on macOS) for instant translation
- **Right-click context menu** — "Translate Selected Text" and "Translate Entire Page" options
- **Display modes** — floating tooltip, sidebar, or inline replacement
- **Toggle original/translated** — switch between original text and translations after page translation
- **Stop button** — cancel in-progress translation at any time
- **Auto-recovery** — if extension is updated/reloaded, prompts to refresh the page automatically

### File Translation
- **PDF translation** — opens PDFs in a custom viewer that renders pages as images with translation panels below each page, preserving exact layout
- **Office files** — basic text extraction for PPTX, DOCX files
- **Manual viewer** — PDF/Office files are no longer auto-redirected; open via popup button only

### Translation Engine
- **Parallel translation** — translates content in chunks using a concurrent worker pool (4 workers by default) for 4x speed improvement
- **Batch translation** — uses numbered segment markers (`[#N]`) with LLM prompts for reliable batch processing
- **Content-based chunking** — splits text into ~1000-character chunks following natural layout boundaries
- **Multiple LLM backends** — supports OpenAI-compatible APIs, Anthropic Claude, Google Gemini, and **Ollama local models**

### Local LLM (Ollama)
- **No API key required** — connects to your local Ollama instance directly
- **Auto model discovery** — fetches installed model list from Ollama automatically
- **CORS configuration** — requires `OLLAMA_ORIGINS=*` environment variable

### Caching
- **In-memory cache** (content script) — same-session toggle support, instant
- **Background service worker cache** — persists across page refreshes within browser session, avoids re-translating the same URL

### i18n / Localization
- **Auto-detects browser language** — UI switches between English, Chinese (zh_CN), Japanese (ja), and Korean (ko) based on Chrome's language setting
- All popup and viewer UI text is localized

### UX
- **Language auto-save** — switching source/target language in the popup immediately saves to storage, so selection translation respects the update without needing to click "Save Settings"
- **API Key auto-hide** — selecting Ollama as provider hides the API Key field

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Chrome Extension                │
├─────────────────────────────────────────────────┤
│  popup/                                         │
│  ├── popup.html    Quick translate + Settings   │
│  ├── popup.js      Settings logic, API calls    │
│  └── popup.css                                   │
├─────────────────────────────────────────────────┤
│  content/                                       │
│  ├── content.js    Page translation engine      │
│  │   - Text node collection & filtering         │
│  │   - Parallel chunk translation (worker pool) │
│  │   - Selection translation (tooltip/sidebar)  │
│  │   - Toggle original/translated text          │
│  │   - Stop/abort mechanism                     │
│  ├── content.css   Float button, tooltip, banner│
│  └── pdf-content.js (legacy, replaced by viewer)│
├─────────────────────────────────────────────────┤
│  viewer/                                        │
│  ├── viewer.html   PDF/Office translation UI    │
│  ├── viewer.js     pdf.js renderer + translator │
│  │   - Page image rendering (canvas → bg image) │
│  │   - Paragraph grouping by spatial clustering │
│  │   - Translation panels below each page       │
│  ├── viewer.css                                  │
│  ├── pdf.min.js    (bundled pdf.js 3.11.174)    │
│  └── pdf.worker.min.js (bundled worker)         │
├─────────────────────────────────────────────────┤
│  lib/                                           │
│  └── translator.js  LLM API abstraction layer   │
│      - OpenAI-compatible (GPT, DeepSeek, Qwen)  │
│      - Anthropic Claude                         │
│      - Google Gemini                            │
│      - Ollama (local models)                    │
│      - Batch mode with numbered segment markers │
├─────────────────────────────────────────────────┤
│  background.js    Service worker                 │
│      - Message routing (translate, cache, PDF)  │
│      - Translation cache (Map, LRU eviction)    │
│      - PDF/Office file detection & redirect     │
│      - Context menu creation                    │
├─────────────────────────────────────────────────┤
│  i18n.js          JS-based localization         │
│      - Browser language detection               │
│      - data-i18n attribute processor            │
│      - en, zh_CN, ja, ko translations           │
├─────────────────────────────────────────────────┤
│  _locales/        Chrome i18n (extension name)  │
│  manifest.json                                   │
│  README.md                                       │
└─────────────────────────────────────────────────┘
```

## Installation

1. Clone or download this repository
2. Go to `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the project directory
6. Click the extension icon → Settings → configure your API Key

## Setup

1. Open the extension popup
2. Go to **Settings** tab
3. Select your API provider (OpenAI-compatible, Anthropic, Gemini, or **Ollama**)
4. Enter your API URL and API Key (not needed for Ollama)
5. Choose a model
6. Set source/target languages
7. Click **Save Settings**
8. Click **Test Connection** to verify

## Usage

### Translate a web page
- Click the extension icon → **Translate Entire Page**
- Or right-click on the page → **Translate Entire Page**
- Click **↩ Show Original** / **🌐 Show Translation** to toggle
- Click **✕** to close (translation is cached for the session)

### Translate selected text
- Select text on any page → click the floating **🌐 Translate** button
- Or select text + press `Alt+T` (`Option+T` on macOS)
- Or right-click selected text → **Translate Selected Text**
- The result appears in a floating tooltip (or sidebar, depending on settings)

### Translate a PDF
- Navigate to any PDF URL or open a local PDF file
- The PDF viewer opens automatically with the PDF rendered
- Click **🌐 Translate** to translate
- Translation appears in a panel below each page
- Use **← →** arrow keys or buttons to navigate pages

### Quick text translation
- Open the extension popup → **Translate** tab
- Type or paste text → click **Translate**
- Languages are auto-saved when changed in the popup — no need to click "Save Settings"

### Using Ollama (local models)
1. Install and start [Ollama](https://ollama.ai)
2. Set environment variable `OLLAMA_ORIGINS=*` before starting Ollama (see [Ollama CORS Configuration](#ollama-cors-configuration) below)
3. Open the extension popup → **Settings** → select **Ollama (本地模型)**
4. Click **🔄** to refresh the model list — installed local models appear automatically
5. Select a model, set source/target languages, and start translating

## Technical Details

### Parallel Translation (Worker Pool)

Page text is collected, grouped into ~1000-character chunks, and translated by 4 concurrent workers:

```
Worker 1: [Chunk 0] ──await── [Chunk 4] ──await── ...
Worker 2: [Chunk 1] ──await── [Chunk 5] ──await── ...
Worker 3: [Chunk 2] ──await── [Chunk 6] ──await── ...
Worker 4: [Chunk 3] ──await── [Chunk 7] ──await── ...
```

Each worker atomically grabs the next chunk index (`nextIdx++`), safe in JS's single-threaded event loop.

### Batch Translation Format

Instead of unreliable separator characters, text segments use numbered markers:

```
Input:
[#1]
Hello world
[#2]
Good morning

Output:
[#1]
你好世界
[#2]
早上好
```

The system prompt instructs the LLM to preserve markers. Response parsing uses regex to extract each numbered segment, with null fallback for missing segments (keeps original text).

### Translation Caching

- **Level 1 — Content script memory** (`fullPageState`): Instant toggle within the same page session
- **Level 2 — Service worker memory** (`translationCache` Map): Persists across page refreshes/navigation. Keyed by `URL::targetLang`. LRU eviction at 80 entries.

When re-visiting a previously translated page:
1. Content script collects text nodes
2. Queries background cache → gets `[[original, translated], ...]` pairs
3. Content-matches each node → applies cached translations instantly
4. Only new/changed content triggers API calls

### PDF Rendering

PDF pages are rendered using pdf.js (bundled, v3.11.174):
1. Each page rendered to canvas at 1.5x scale
2. Canvas set as background image on page wrapper div
3. Text extracted via `page.getTextContent()`, grouped into paragraphs by spatial clustering (Y-proximity → lines → paragraphs by gap size)
4. Translation panel below each page shows original/translated side-by-side

### macOS Keyboard Shortcut

On macOS, `Option+T` produces the `†` character. The extension uses `e.code === 'KeyT'` (keyboard-layout independent) instead of `e.key === 't'`.

### Ollama CORS Configuration

Chrome extensions run under the `chrome-extension://` origin, which is blocked by Ollama's default CORS policy. To allow the extension to connect to your local Ollama instance:

**macOS (Ollama.app):**
```bash
# Set persistent environment variable
launchctl setenv OLLAMA_ORIGINS "*"
# Then quit and restart Ollama (menubar → Quit → reopen)
```

**Linux / Terminal launch:**
```bash
OLLAMA_ORIGINS=* ollama serve
```

**Windows (PowerShell):**
```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```

**Persistent (Linux systemd):**
```ini
# /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_ORIGINS=*"
```

### Language Auto-Save

When you change the source or target language in the popup dropdowns, the extension automatically saves the selection to storage. This means:

- Selection translation (划词翻译) immediately uses the updated language
- Full page translation uses the updated language
- No need to click "Save Settings" for language changes to take effect

### Extension Reload Recovery

When the extension is reloaded (e.g., after updating at `chrome://extensions`), content scripts already running on pages lose their connection to the extension runtime. The extension detects this and shows a prompt asking whether to refresh the page to re-establish the connection.

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Save user settings |
| `contextMenus` | Right-click translation menu |
| `activeTab` | Access current tab for translation |
| `scripting` | Inject content scripts |
| `webNavigation` | Detect PDF/Office file navigation |
| `tabs` | Open PDF viewer, read tab URLs |
| `host_permissions` | Access page content for translation, file:// for local files |

## Supported Languages (Translation)

Auto-detect, English, 中文, 日本語, 한국어, Français, Deutsch, Español, Русский

## Supported LLM Backends

- OpenAI (GPT-4o, GPT-4o-mini, GPT-4-turbo)
- Anthropic Claude (Sonnet 4, Haiku 3.5, Opus 3)
- Google Gemini (2.5 Flash, 2.5 Pro, 2.0 Flash)
- DeepSeek (chat, reasoner)
- Qwen (Plus, Max)
- GLM (4, 4v)
- **Ollama (local models)** — llama3.2, qwen2.5, gemma2, mistral, phi3, and any model pulled locally
- Any OpenAI-compatible API


## License

MIT
