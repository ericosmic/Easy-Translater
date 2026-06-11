// 网页内容翻译脚本 - 选中翻译 + 全文翻译
(function () {
  'use strict';

  // 跳过 PDF 页面（由 pdf-content.js 处理）
  if (isPDFPage()) return;

  // ─── 状态 ──────────────────────────────────────────
  let floatBtn = null;
  let tooltip = null;
  let selectedText = '';
  let currentDisplayMode = 'tooltip';

  // 全文翻译状态
  let fullPageState = null; // { banner, originalTexts: Map<node, string>, translatedTexts: Map<node, string>, isShowingTranslation }
  let abortFlag = null;    // { aborted: boolean } — 用于中断正在进行的翻译

  // ─── 工具函数 ──────────────────────────────────────

  function isPDFPage() {
    return !!(
      document.querySelector('embed[type="application/pdf"]') ||
      document.querySelector('pdf-viewer') ||
      window.location.pathname.toLowerCase().endsWith('.pdf')
    );
  }

  async function loadSettings() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (res?.settings) {
        currentDisplayMode = res.settings.displayMode || 'tooltip';
        return res.settings;
      }
    } catch (e) {
      if (isExtensionInvalidated(e)) handleExtensionReload();
    }
    return {};
  }

  function isExtensionInvalidated(e) {
    return e.message?.includes('Extension context invalidated') ||
           e.message?.includes('Extension context') ||
           e.toString().includes('Extension context invalidated');
  }

  function handleExtensionReload() {
    console.warn('Extension reloaded detected, reloading page to re-inject content script');
    try {
      // Try to reconnect by triggering a page reload
      if (confirm('翻译插件已更新，需要刷新页面才能继续使用。是否刷新？')) {
        window.location.reload();
      }
    } catch {}
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── 消息监听 ──────────────────────────────────────

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translateSelection' && request.text) {
      selectedText = request.text;
      showTranslation(request.text);
      sendResponse({ success: true });
    }
    if (request.action === 'translatePage') {
      translateFullPage();
      sendResponse({ success: true });
    }
    if (request.action === 'translateFullPage') {
      translateFullPage(request.sourceLang, request.targetLang);
      sendResponse({ success: true });
    }
    if (request.action === 'revertTranslation') {
      revertFullPage();
      sendResponse({ success: true });
    }
    if (request.action === 'translateFile') {
      // Forward to pdf-content.js handler if present
      if (typeof window.translatePDFFile === 'function') {
        window.translatePDFFile();
      } else {
        translateFullPage();
      }
      sendResponse({ success: true });
    }
  });

  // ─── 快捷键 ────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    // Use e.code for keyboard-layout independence — fixes macOS where Option+T produces †
    if (e.altKey && e.code === 'KeyT' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text) {
        selectedText = text;
        showTranslation(text);
      }
    }
  });

  // ─── 选中翻译 ────────────────────────────────────

  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      removeFloatBtn();
      if (text && text.length > 0 && text.length < 5000) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        selectedText = text;
        showFloatBtn(rect);
      } else {
        selectedText = '';
      }
    }, 100);
  });

  document.addEventListener('mousedown', (e) => {
    if (floatBtn && !floatBtn.contains(e.target) && tooltip && !tooltip.contains(e.target)) {
      removeFloatBtn();
      removeTooltip();
    }
  });

  function showFloatBtn(rect) {
    if (!floatBtn) {
      floatBtn = document.createElement('button');
      floatBtn.className = 'translate-float-btn';
      floatBtn.innerHTML = '🌐 翻译';
      floatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showTranslation(selectedText);
      });
      document.body.appendChild(floatBtn);
    }
    floatBtn.style.display = 'flex';
    let left = rect.left + rect.width / 2 - 40;
    let top = rect.bottom + 8;
    if (left < 10) left = 10;
    if (top + 40 > window.innerHeight) {
      top = rect.top - 44;
    }
    floatBtn.style.left = `${left}px`;
    floatBtn.style.top = `${top}px`;
  }

  function removeFloatBtn() {
    if (floatBtn) floatBtn.style.display = 'none';
  }

  async function showTranslation(text) {
    if (!text?.trim()) return;
    removeTooltip();
    const settings = await loadSettings();
    if (currentDisplayMode === 'sidebar') {
      showSidebar(text);
    } else {
      showTooltip(text);
    }
  }

  // ─── 选中翻译 - 提示框 ────────────────────────────

  function showTooltip(text) {
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'translate-tooltip';
      tooltip.innerHTML = `
        <div class="tooltip-header">
          <span>翻译结果</span>
          <button class="tooltip-close">✕</button>
        </div>
        <div class="tooltip-content"><div class="tooltip-loading">翻译中...</div></div>
        <div class="tooltip-actions">
          <button class="action-copy">复制</button>
          <button class="action-switch">切换语言</button>
        </div>`;
      tooltip.querySelector('.tooltip-close').addEventListener('click', removeTooltip);
      tooltip.querySelector('.action-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(tooltip.querySelector('.tooltip-content').textContent);
      });
      tooltip.querySelector('.action-switch').addEventListener('click', () => retranslateWithSwappedLang(text));
      document.body.appendChild(tooltip);
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      let left = rect.right + 16, top = rect.top;
      if (left + 480 > window.innerWidth) left = rect.left - 480;
      if (left < 8) left = 8;
      if (top + 100 > window.innerHeight) top = window.innerHeight - 200;
      if (top < 8) top = 8;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    } else {
      tooltip.style.left = `${window.innerWidth / 2 - 200}px`;
      tooltip.style.top = `${window.innerHeight / 2 - 100}px`;
    }
    tooltip.style.display = 'block';
    removeFloatBtn();
    doTranslate(text);
  }

  async function doTranslate(text, langOverride) {
    const contentEl = tooltip?.querySelector('.tooltip-content');
    if (!contentEl) return;
    const settings = await loadSettings();
    if (langOverride) settings.targetLang = langOverride;
    try {
      const result = await chrome.runtime.sendMessage({ action: 'translate', text, settings });
      contentEl.textContent = result.success ? result.text : `翻译失败: ${result.error}`;
    } catch (err) {
      if (isExtensionInvalidated(err)) { handleExtensionReload(); return; }
      contentEl.textContent = `翻译失败: ${err.message}`;
    }
  }

  async function retranslateWithSwappedLang(text) {
    const settings = await loadSettings();
    [settings.sourceLang, settings.targetLang] = [settings.targetLang, settings.sourceLang === 'auto' ? 'English' : settings.sourceLang];
    const contentEl = tooltip?.querySelector('.tooltip-content');
    if (contentEl) contentEl.innerHTML = '<div class="tooltip-loading">翻译中...</div>';
    doTranslate(text, settings.targetLang);
  }

  function removeTooltip() {
    if (tooltip) tooltip.style.display = 'none';
  }

  // ─── 选中翻译 - 侧边栏 ────────────────────────────

  function showSidebar(text) {
    let sidebar = document.querySelector('.translate-sidebar');
    if (!sidebar) {
      sidebar = document.createElement('div');
      sidebar.className = 'translate-sidebar';
      sidebar.innerHTML = `
        <div class="translate-sidebar-header">
          <h3>万能翻译器</h3>
          <button class="sidebar-close">✕</button>
        </div>
        <div class="translate-sidebar-content">
          <div style="margin-bottom:8px;font-size:13px;color:#666">原文</div>
          <div class="sidebar-original" style="margin-bottom:16px;padding:12px;background:#f5f5f5;border-radius:8px;font-size:14px;line-height:1.6">${escapeHtml(text)}</div>
          <div style="margin-bottom:8px;font-size:13px;color:#666">译文</div>
          <div class="sidebar-translated" style="padding:12px;background:#f0f4ff;border-radius:8px;font-size:14px;line-height:1.6"><div class="tooltip-loading">翻译中...</div></div>
        </div>`;
      sidebar.querySelector('.sidebar-close').addEventListener('click', () => sidebar.remove());
      document.body.appendChild(sidebar);
    } else {
      sidebar.querySelector('.sidebar-original').textContent = text;
      sidebar.querySelector('.sidebar-translated').innerHTML = '<div class="tooltip-loading">翻译中...</div>';
    }
    loadSettings().then(settings => {
      chrome.runtime.sendMessage({ action: 'translate', text, settings }).then(result => {
        const el = sidebar?.querySelector('.sidebar-translated');
        if (el) el.textContent = result.success ? result.text : `翻译失败: ${result.error}`;
      }).catch(err => {
        if (isExtensionInvalidated(err)) { handleExtensionReload(); return; }
        const el = sidebar?.querySelector('.sidebar-translated');
        if (el) el.textContent = `翻译失败: ${err.message}`;
      });
    });
  }

  // ═══════════════════════════════════════════════════
  //  全文翻译引擎
  // ═══════════════════════════════════════════════════

  const CHUNK_SIZE = 1000;   // 每个翻译块的最大字符数
  const MAX_CONCURRENCY = 4; // 并行翻译请求数
  const MAX_TEXT_LENGTH = 1500;
  const MIN_TEXT_LENGTH = 1;

  async function translateFullPage(sourceLangOverride, targetLangOverride) {
    // 内存缓存命中（同一页面会话内）—— 语言不同则忽略缓存
    if (fullPageState && !sourceLangOverride && !targetLangOverride) {
      if (!fullPageState.banner) {
        const banner = createBanner();
        document.body.prepend(banner);
        fullPageState.banner = banner;
        updateBanner(banner, 'done', '已加载缓存翻译');
        banner.querySelector('.toggle-btn').style.display = 'inline-block';
        setupCloseButton(banner);
        showTranslated();
      } else {
        toggleFullPage();
      }
      return;
    }

    const settings = await loadSettings();
    // 应用 popup 传入的语言覆盖
    if (sourceLangOverride) settings.sourceLang = sourceLangOverride;
    if (targetLangOverride) settings.targetLang = targetLangOverride;

    if (!settings.apiKey && settings.provider !== 'ollama') {
      alert('请先配置 API Key！（点击扩展图标 → 设置）');
      return;
    }

    const banner = createBanner();
    document.body.prepend(banner);

    updateBanner(banner, 'collecting', '正在扫描页面文本...');
    const textNodes = collectTextNodes();
    if (textNodes.length === 0) {
      updateBanner(banner, 'error', '未找到可翻译的文本');
      setTimeout(() => banner.remove(), 2000);
      return;
    }

    const total = textNodes.length;
    const originalTexts = new Map();
    const translatedTexts = new Map();
    textNodes.forEach(n => originalTexts.set(n, n.textContent));

    // 查询 Background 持久缓存
    const cachedPairs = await loadBgCache(window.location.href, settings.targetLang);
    let cachedCount = 0;
    const uncachedNodes = [];

    if (cachedPairs) {
      const lookup = new Map(cachedPairs);
      textNodes.forEach(node => {
        const text = node.textContent.trim();
        const cached = lookup.get(text);
        if (cached) {
          node.textContent = cached;
          node['__ut'] = true;
          node.parentElement.classList.add('ut-translated');
          translatedTexts.set(node, cached);
          cachedCount++;
        } else {
          uncachedNodes.push(node);
        }
      });
    } else {
      uncachedNodes.push(...textNodes);
    }

    // 全部命中缓存 → 跳过 API
    if (uncachedNodes.length === 0) {
      updateBanner(banner, 'done', `已加载缓存翻译 (${cachedCount} 段)`);
      const toggleBtn = banner.querySelector('.toggle-btn');
      toggleBtn.style.display = 'inline-block';
      toggleBtn.onclick = () => revertFullPage();
      setupCloseButton(banner);
      fullPageState = { banner, originalTexts, translatedTexts, isShowingTranslation: true };
      return;
    }

    // 有新内容需要翻译
    const chunks = buildChunks(uncachedNodes, CHUNK_SIZE);
    abortFlag = { aborted: false };
    setupStopButton(banner, abortFlag, originalTexts);
    updateBanner(banner, 'progress',
      `正在翻译... 0/${uncachedNodes.length}  (缓存命中 ${cachedCount}, 需翻译 ${uncachedNodes.length})`);

    const resultMap = await translateChunksParallel(chunks, settings, banner, uncachedNodes.length, abortFlag);

    if (abortFlag.aborted) {
      revertNodes(originalTexts);
      banner.remove();
      document.body.style.paddingTop = banner._origPadding || '';
      abortFlag = null;
      return;
    }

    resultMap.forEach((translated, node) => translatedTexts.set(node, translated));

    const freshCount = resultMap.size;
    updateBanner(banner, 'done', `翻译完成！${cachedCount + freshCount}/${total} 段文本`);
    const toggleBtn = banner.querySelector('.toggle-btn');
    toggleBtn.style.display = 'inline-block';
    toggleBtn.onclick = () => revertFullPage();
    setupCloseButton(banner);

    // 合并后存入 Background 持久缓存
    const allPairs = buildPairs(originalTexts, translatedTexts);
    saveBgCache(window.location.href, settings.targetLang, allPairs);

    fullPageState = { banner, originalTexts, translatedTexts, isShowingTranslation: true };
    abortFlag = null;
  }

  // ─── Background 持久缓存（通过 Service Worker 内存） ──

  async function loadBgCache(url, targetLang) {
    try {
      const res = await chrome.runtime.sendMessage({
        action: 'getCachedTranslation',
        url,
        targetLang
      });
      return res?.pairs || null;
    } catch { return null; }
  }

  async function saveBgCache(url, targetLang, pairs) {
    try {
      await chrome.runtime.sendMessage({
        action: 'cacheTranslation',
        url,
        targetLang,
        pairs
      });
    } catch {}
  }

  function buildPairs(originalTexts, translatedTexts) {
    const pairs = [];
    translatedTexts.forEach((translated, node) => {
      const original = originalTexts.get(node);
      if (original && translated) {
        pairs.push([original.trim(), translated.trim()]);
      }
    });
    return pairs;
  }

  // 设置关闭按钮（翻译完成后或缓存命中时）
  function setupCloseButton(banner) {
    const btn = banner.querySelector('.ft-close-btn');
    btn.textContent = '✕';
    btn.title = '关闭';
    const origPadding = banner._origPadding;
    btn.replaceWith(btn.cloneNode(true));
    const newBtn = banner.querySelector('.ft-close-btn');
    newBtn.addEventListener('click', () => {
      if (fullPageState?.isShowingTranslation) {
        revertFullPage();
      }
      document.body.style.paddingTop = origPadding || '';
      banner.remove();
      if (fullPageState) {
        fullPageState.banner = null;
      }
    });
  }

  // 设置停止按钮（翻译进行中）
  function setupStopButton(banner, flag, originalTexts) {
    const btn = banner.querySelector('.ft-close-btn');
    btn.textContent = '⏹ 停止';
    btn.title = '停止翻译';
    const origPadding = banner._origPadding;
    btn.replaceWith(btn.cloneNode(true));
    const newBtn = banner.querySelector('.ft-close-btn');
    newBtn.addEventListener('click', () => {
      flag.aborted = true;
      updateBanner(banner, 'error', '翻译已停止');
    });
  }

  // 批量还原节点的原始文本
  function revertNodes(originalTexts) {
    originalTexts.forEach((text, node) => {
      try {
        if (node.parentNode) {
          node.textContent = text;
          delete node['__ut'];
          node.parentElement.classList.remove('ut-translated');
        }
      } catch {}
    });
  }

  // 将文本节点按字符数分块，每块不超过 maxSize 字符
  function buildChunks(textNodes, maxSize) {
    const chunks = [];
    let current = { nodes: [], len: 0 };

    for (const node of textNodes) {
      const text = node.textContent.trim();
      const textLen = text.length;

      if (current.len + textLen > maxSize && current.nodes.length > 0) {
        chunks.push(current);
        current = { nodes: [], len: 0 };
      }

      current.nodes.push(node);
      current.len += textLen;
    }

    if (current.nodes.length > 0) chunks.push(current);
    return chunks;
  }

  // 并发翻译所有块，返回 Map<node, translatedText>
  async function translateChunksParallel(chunks, settings, banner, totalNodes, abortFlag) {
    const translatedMap = new Map();
    let nextIdx = 0;
    let completedNodes = 0;
    let completedChunks = 0;

    async function worker() {
      let idx;
      while (!abortFlag.aborted && (idx = nextIdx++) < chunks.length) {
        const chunk = chunks[idx];
        const texts = chunk.nodes.map(n => {
          let t = n.textContent.trim();
          if (t.length > MAX_TEXT_LENGTH) t = t.slice(0, MAX_TEXT_LENGTH);
          return t;
        });

        const batchText = formatBatchText(texts);
        try {
          const result = await chrome.runtime.sendMessage({
            action: 'translate',
            text: batchText,
            settings,
            batchMode: true
          });

          // 请求返回后再次检查中断标志（处理进行中的请求）
          if (abortFlag.aborted) return;

          if (result.success) {
            const translations = parseBatchResponse(result.text, texts.length);
            chunk.nodes.forEach((node, ti) => {
              const translated = translations[ti];
              if (translated && translated.length > 0) {
                node.textContent = translated;
                node['__ut'] = true;
                node.parentElement.classList.add('ut-translated');
                translatedMap.set(node, translated);
              }
            });
          }
        } catch (err) {
          if (abortFlag.aborted) return;
          console.warn('Chunk translate error:', err);
        }

        completedNodes += chunk.nodes.length;
        completedChunks++;
        updateBanner(banner, 'progress',
          `正在翻译... ${Math.min(completedNodes, totalNodes)}/${totalNodes}  (${completedChunks}/${chunks.length} 块)`);
      }
    }

    const workerCount = Math.min(MAX_CONCURRENCY, chunks.length);
    const workers = Array(workerCount).fill(null).map(() => worker());
    await Promise.all(workers);

    return translatedMap;
  }

  function formatBatchText(texts) {
    return texts.map((t, i) => `[#${i + 1}]\n${t}`).join('\n\n');
  }

  function parseBatchResponse(response, count) {
    const results = new Array(count).fill(null);
    for (let i = 1; i <= count; i++) {
      const pattern = new RegExp(
        `\\[#${i}\\]([\\s\\S]*?)(?=\\[#${i + 1}\\]|\\[#\\d+\\]|$)`,
        'i'
      );
      const match = response.match(pattern);
      if (match) {
        results[i - 1] = match[1].trim();
      }
    }
    return results;
  }

  function revertFullPage() {
    if (!fullPageState) return;
    const { originalTexts } = fullPageState;
    originalTexts.forEach((text, node) => {
      try {
        if (node.parentNode) {
          node.textContent = text;
          delete node['__ut'];
          node.parentElement.classList.remove('ut-translated');
        }
      } catch {}
    });
    fullPageState.isShowingTranslation = false;
    if (fullPageState.banner) {
      updateBanner(fullPageState.banner, 'done', '已恢复原文');
      const toggleBtn = fullPageState.banner.querySelector('.toggle-btn');
      if (toggleBtn) {
        toggleBtn.textContent = '🌐 显示译文';
        toggleBtn.onclick = () => showTranslated();
      }
    }
  }

  function showTranslated() {
    if (!fullPageState) return;
    const { translatedTexts } = fullPageState;
    translatedTexts.forEach((text, node) => {
      try {
        if (node.parentNode) {
          node.textContent = text;
          node['__ut'] = true;
          node.parentElement.classList.add('ut-translated');
        }
      } catch {}
    });
    fullPageState.isShowingTranslation = true;
    if (fullPageState.banner) {
      updateBanner(fullPageState.banner, 'done', '显示译文');
      const toggleBtn = fullPageState.banner.querySelector('.toggle-btn');
      if (toggleBtn) {
        toggleBtn.textContent = '↩ 原文';
        toggleBtn.onclick = () => revertFullPage();
      }
    }
  }

  function toggleFullPage() {
    if (!fullPageState) return;
    if (fullPageState.isShowingTranslation) {
      revertFullPage();
    } else {
      showTranslated();
    }
  }

  // ─── 全文翻译 UI ──────────────────────────────────

  function createBanner() {
    const banner = document.createElement('div');
    banner.className = 'ft-banner';
    banner.innerHTML = `
      <div class="ft-banner-inner">
        <span class="ft-logo">🌐</span>
        <span class="ft-text">万能翻译器</span>
        <span class="ft-status">准备中...</span>
        <div class="ft-progress-bar"><div class="ft-progress-fill"></div></div>
        <button class="ft-toggle-btn toggle-btn" style="display:none">↩ 原文</button>
        <button class="ft-close-btn">✕</button>
      </div>`;
    document.body.appendChild(banner);

    banner._origPadding = document.body.style.paddingTop;
    document.body.style.paddingTop = '56px';

    return banner;
  }

  function updateBanner(banner, phase, text) {
    const status = banner.querySelector('.ft-status');
    const fill = banner.querySelector('.ft-progress-fill');
    if (status) status.textContent = text;
    if (fill) {
      if (phase === 'collecting') fill.style.width = '5%';
      else if (phase === 'progress') {
        const match = text.match(/(\d+)\/(\d+)/);
        if (match) fill.style.width = `${(parseInt(match[1]) / parseInt(match[2])) * 90 + 5}%`;
      } else if (phase === 'done') fill.style.width = '100%';
      else if (phase === 'error') fill.style.width = '0%';
    }
  }

  // ─── DOM 操作 ─────────────────────────────────────

  function collectTextNodes() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const el = node.parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;

          const tag = el.tagName;
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'TEXTAREA', 'SELECT', 'OPTION', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }

          if (node['__ut']) return NodeFilter.FILTER_REJECT;

          const text = node.textContent.trim();
          if (text.length < MIN_TEXT_LENGTH) return NodeFilter.FILTER_REJECT;

          if (el.closest('.ft-banner, .translate-tooltip, .translate-sidebar, .translate-float-btn, .translate-overlay')) {
            return NodeFilter.FILTER_REJECT;
          }

          // 跳过纯空白/数字/符号文本（不含任何字母或文字）
          if (!/[^\x00-\x7F]/.test(text) && !/[a-zA-Z]{2,}/.test(text) && /^[\d\s\p{P}]+$/u.test(text)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }


})();
