// 后台服务工作者
importScripts('lib/translator.js');

// 翻译缓存：{ "url::targetLang" → { pairs: [[orig, trans], ...], ts: number } }
const translationCache = new Map();
const MAX_CACHE_ENTRIES = 80;

// PDF 数据暂存（供 viewer 页面读取）
const pdfStore = new Map(); // id → { data: ArrayBuffer, contentType: string }

function cacheKey(url, targetLang) {
  return `${url}::${targetLang || getDefaultTargetLang()}`;
}

function evictOldest() {
  if (translationCache.size <= MAX_CACHE_ENTRIES) return;
  let oldestKey = null;
  let oldestTs = Infinity;
  for (const [key, entry] of translationCache) {
    if (entry.ts < oldestTs) {
      oldestTs = entry.ts;
      oldestKey = key;
    }
  }
  if (oldestKey) translationCache.delete(oldestKey);
}

// 安装事件
chrome.runtime.onInstalled.addListener(() => {
  // 创建右键菜单（使用 i18n）
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: chrome.i18n.getMessage('contextMenuSelection'),
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'translate-page',
    title: chrome.i18n.getMessage('contextMenuPage'),
    contexts: ['page']
  });

  // 初始化默认设置（根据浏览器语言自动选择目标语言）
  chrome.storage.sync.get(['provider'], (result) => {
    if (!result.provider) {
      chrome.storage.sync.set({
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini',
        sourceLang: 'auto',
        targetLang: getDefaultTargetLang(),
        style: 'natural'
      });
    }
  });
});

// 右键菜单事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'translateSelection',
      text: info.selectionText
    }).catch(() => {});
  }
  if (info.menuItemId === 'translate-page') {
    chrome.tabs.sendMessage(tab.id, { action: 'translatePage' }).catch(() => {});
  }
});

// 处理来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'translate':
      handleTranslation(request.text, request.settings, request.batchMode)
        .then(result => sendResponse({ success: true, text: result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'testConnection':
      testConnection(request.settings)
        .then(result => sendResponse({ success: true, text: result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'getSettings':
      chrome.storage.sync.get(null, (settings) => {
        sendResponse({ success: true, settings });
      });
      return true;

    case 'getModels': {
      (async () => {
        try {
          const models = await getAvailableModels(
            request.settings?.provider || 'openai',
            request.settings?.apiKey || '',
            request.settings?.apiUrl || 'https://api.openai.com/v1'
          );
          sendResponse({ success: true, models });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    case 'getCachedTranslation': {
      const key = cacheKey(request.url, request.targetLang);
      const entry = translationCache.get(key);
      sendResponse({ success: true, pairs: entry?.pairs || null });
      return true;
    }

    case 'cacheTranslation':
      evictOldest();
      translationCache.set(cacheKey(request.url, request.targetLang), {
        pairs: request.pairs,
        ts: Date.now()
      });
      sendResponse({ success: true });
      return true;

    case 'getPDFData': {
      const entry = pdfStore.get(request.id);
      if (entry) {
        pdfStore.delete(request.id);
        sendResponse({ success: true, data: Array.from(new Uint8Array(entry.data)) });
      } else {
        sendResponse({ success: false, error: 'PDF data not found' });
      }
      return true;
    }

    case 'openFileViewer': {
      (async () => {
        const lower = (request.url || '').toLowerCase();
        if (lower.endsWith('.pdf') || lower.includes('.pdf#') || lower.includes('.pdf?')) {
          await openPDFViewer(request.url, request.tabId);
        } else {
          await openOfficeViewer(request.url, request.tabId);
        }
        sendResponse({ success: true });
      })();
      return true;
    }
  }
});

async function handleTranslation(text, customSettings, batchMode = false) {
  const defaults = await new Promise(resolve => chrome.storage.sync.get(null, resolve));
  const settings = { ...defaults, ...customSettings };
  return await translateText(text, settings, batchMode);
}

async function handlePDFTranslation(tabId, fileUrl) {
  try {
    const resp = await fetch(fileUrl);
    const blob = await resp.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Simple text extraction from PDF (handles text-based PDFs)
    const text = await extractTextFromPDF(arrayBuffer);
    if (!text.trim()) throw new Error('无法从PDF中提取文本，或PDF为扫描件');

    const settings = await new Promise(resolve => chrome.storage.sync.get(null, resolve));
    return await translateText(text.slice(0, 10000), settings);
  } catch (err) {
    throw new Error(`PDF处理失败: ${err.message}`);
  }
}

// Simple PDF text extraction using pure JS
async function extractTextFromPDF(arrayBuffer) {
  const text = new TextDecoder('utf-8').decode(arrayBuffer);
  const textChunks = [];

  // Match text between parentheses in PDF stream objects
  const textBetweenParens = text.match(/\(([^)]*)\)/g) || [];
  for (const match of textBetweenParens) {
    const content = match.slice(1, -1);
    // Filter out binary/non-text content
    if (content.length > 2 && /[ -~一-鿿]/.test(content)) {
      textChunks.push(content
        .replace(/\\n/g, '\n')
        .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\(.)/g, '$1')
      );
    }
  }

  // Also try TJ operator (more common in modern PDFs)
  const tjMatches = text.match(/\[([^\]]*)\]\s*TJ/g) || [];
  for (const match of tjMatches) {
    const inner = match.slice(1, match.indexOf(']'));
    const parts = inner.match(/\(([^)]*)\)/g) || [];
    const line = parts.map(p => p.slice(1, -1)
      .replace(/\\n/g, ' ')
      .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\(.)/g, '$1')
    ).join('');
    if (line.trim()) textChunks.push(line);
  }

  return textChunks.join('\n').replace(/\s+/g, ' ').trim();
}

// 打开 PDF 查看器（仅通过 popup 按钮手动触发）

async function openPDFViewer(fileUrl, tabId) {
  if (fileUrl.startsWith('file://')) {
    // 本地文件：后台读取后传入 viewer
    try {
      const resp = await fetch(fileUrl);
      const buffer = await resp.arrayBuffer();
      const id = 'pdf_' + Date.now();
      pdfStore.set(id, { data: buffer });
      // 10 分钟后清理
      setTimeout(() => pdfStore.delete(id), 600000);
      const viewerUrl = chrome.runtime.getURL('viewer/viewer.html') + '?id=' + id;
      await chrome.tabs.update(tabId, { url: viewerUrl });
    } catch (err) {
      console.warn('Failed to load local PDF:', err);
    }
  } else {
    // 远程 PDF：viewer 可直接加载
    const viewerUrl = chrome.runtime.getURL('viewer/viewer.html') + '?src=' + encodeURIComponent(fileUrl);
    try {
      await chrome.tabs.update(tabId, { url: viewerUrl });
    } catch {
      // fallback: open in new tab
      chrome.tabs.create({ url: viewerUrl });
    }
  }
}

// 打开 Office 文件查看器（提取文本为 HTML）
async function openOfficeViewer(fileUrl, tabId) {
  // 目前仅尝试获取文本内容展示
  try {
    const resp = await fetch(fileUrl);
    const text = await resp.text();
    const id = 'office_' + Date.now();
    pdfStore.set(id, { data: new TextEncoder().encode(text).buffer, contentType: 'text/html' });
    setTimeout(() => pdfStore.delete(id), 600000);
    const viewerUrl = chrome.runtime.getURL('viewer/viewer.html') + '?id=' + id;
    await chrome.tabs.update(tabId, { url: viewerUrl });
  } catch (err) {
    console.warn('Failed to load office file:', err);
  }
}
