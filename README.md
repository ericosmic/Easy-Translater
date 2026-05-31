# Universal Translator (万能翻译器)

A Chrome extension that translates web pages, PDF files, and Office documents using custom LLM backends (OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Qwen, GLM, etc.).

## Features

### Page Translation
- **Full page translation** — translates all text content on a web page while preserving DOM structure
- **Selection translation** — select text and press `Alt+T` (or `Option+T` on macOS) for instant translation
- **Right-click context menu** — "Translate Selected Text" and "Translate Entire Page" options
- **Display modes** — floating tooltip, sidebar, or inline replacement
- **Toggle original/translated** — switch between original text and translations after page translation
- **Stop button** — cancel in-progress translation at any time

### File Translation
- **PDF translation** — opens PDFs in a custom viewer that renders pages as images with translation panels below each page, preserving exact layout
- **Office files** — basic text extraction for PPTX, DOCX files
- **Auto-detection** — automatically detects PDF/Office files when navigating and opens the viewer

### Translation Engine
- **Parallel translation** — translates content in chunks using a concurrent worker pool (4 workers by default) for 4x speed improvement
- **Batch translation** — uses numbered segment markers (`[#N]`) with LLM prompts for reliable batch processing
- **Content-based chunking** — splits text into ~1000-character chunks following natural layout boundaries
- **Multiple LLM backends** — supports OpenAI-compatible APIs, Anthropic Claude, and Google Gemini

### Caching
- **In-memory cache** (content script) — same-session toggle support, instant
- **Background service worker cache** — persists across page refreshes within browser session, avoids re-translating the same URL

### i18n / Localization
- **Auto-detects browser language** — UI switches between English, Chinese (zh_CN), Japanese (ja), and Korean (ko) based on Chrome's language setting
- All popup and viewer UI text is localized

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
3. Select your API provider (OpenAI-compatible, Anthropic, or Gemini)
4. Enter your API URL and API Key
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
- Any OpenAI-compatible API

## License

MIT
