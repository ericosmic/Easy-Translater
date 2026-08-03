// PDF Viewer — renders page images + translation panels below each page
(function () {
  'use strict';

  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('viewer/pdf.worker.min.js');

  // i18n.js is loaded first and exposes window.i18nGet
  const t = (key, ...subs) => (window.i18nGet ? window.i18nGet(key, ...subs) : key);

  const SCALE = 1.5;
  const MAX_PAGES = 100;
  const BATCH_SIZE = 8;
  const MAX_CONCURRENCY = 3;

  let pdfDoc = null;
  let currentPage = 1;
  let totalPages = 0;
  let allParagraphs = [];       // [{ page, lines: [{ text, spans }] }]
  let originalTexts = [];       // flat array of paragraph texts
  let translatedTexts = [];     // flat array of translated texts
  let isTranslated = false;
  let panelsVisible = false;    // whether the translation panels are currently shown
  let settings = {};

  const container = document.getElementById('viewer-container');
  const loading = document.getElementById('loading');
  const pageInfo = document.getElementById('page-info');
  const pageNumEl = document.getElementById('page-num');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const translateBtn = document.getElementById('translate-btn');
  const toggleBtn = document.getElementById('toggle-btn');
  const sourceLang = document.getElementById('source-lang');
  const targetLang = document.getElementById('target-lang');

  async function init() {
    settings = await loadSettings();
    sourceLang.value = settings.sourceLang || 'auto';
    targetLang.value = settings.targetLang || getDefaultTargetLang();

    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    const id = params.get('id');
    if (!src && !id) { loading.textContent = t('viewerMissingParam'); return; }
    if (id && id.startsWith('office_')) { await initOfficeFile(id); return; }
    await initPDF(src, id);
  }

  async function initPDF(src, id) {
    let pdfData;
    if (src) { pdfData = src; }
    else if (id) {
      pdfData = await loadFromBg(id);
      if (!pdfData) { loading.textContent = t('viewerNoPdfData'); return; }
    }

    try {
      pdfDoc = await pdfjsLib.getDocument(pdfData).promise;
      totalPages = Math.min(pdfDoc.numPages, MAX_PAGES);
      pageInfo.textContent = t('viewerPagesCount', totalPages);
      updateNav();
      await renderAllPages();
      loading.style.display = 'none';
      translateBtn.disabled = false;
    } catch (err) {
      loading.textContent = t('viewerParseFailed', err.message);
    }
  }

  async function renderAllPages() {
    allParagraphs = [];
    originalTexts = [];
    translatedTexts = [];
    isTranslated = false;
    toggleBtn.style.display = 'none';
    container.querySelectorAll('.pdf-page-wrapper').forEach(p => p.remove());

    for (let i = 1; i <= totalPages; i++) {
      loading.textContent = t('viewerRendering', i, totalPages);
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: SCALE });

      // Render page image
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Create page wrapper with image + translation panel container
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page-wrapper';
      wrapper.dataset.page = i;

      // Page image
      const imgDiv = document.createElement('div');
      imgDiv.className = 'pdf-page-img';
      imgDiv.style.width = viewport.width + 'px';
      imgDiv.style.height = viewport.height + 'px';
      imgDiv.style.backgroundImage = `url(${canvas.toDataURL()})`;
      wrapper.appendChild(imgDiv);

      // Extract text and group into paragraphs
      const textContent = await page.getTextContent();
      const paragraphs = groupIntoParagraphs(textContent.items, viewport.height);
      allParagraphs.push({ page: i, paragraphs });

      // Collect paragraph texts for translation
      for (const para of paragraphs) {
        originalTexts.push(para.text);
      }

      // Translation panel (hidden until translated)
      const panel = document.createElement('div');
      panel.className = 'pdf-trans-panel';
      panel.style.display = 'none';
      panel.style.width = viewport.width + 'px';
      wrapper.appendChild(panel);

      container.appendChild(wrapper);
      await sleep(0);
    }
  }

  // Group text items into paragraphs by spatial clustering
  function groupIntoParagraphs(items, pageHeight) {
    if (!items || items.length === 0) return [];

    // Filter empty and sort by Y descending (pdf.js Y axis goes up), then X ascending
    const filtered = items
      .filter(item => item.str && item.str.trim().length > 0)
      .map(item => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        w: item.width,
        h: item.height
      }))
      .sort((a, b) => {
        const yDiff = b.y - a.y; // descending Y = top-to-bottom in page coords
        if (Math.abs(yDiff) < 3) return a.x - b.x;
        return yDiff;
      });

    // Group into lines by Y proximity
    const lines = [];
    let curLine = null;
    const LINE_TOLERANCE = 2;
    const PARA_GAP = 8; // larger Y gap = new paragraph

    for (const item of filtered) {
      if (!curLine || Math.abs(item.y - curLine.y) > LINE_TOLERANCE) {
        if (curLine) lines.push(curLine);
        curLine = { y: item.y, items: [], text: '' };
      }
      curLine.items.push(item);
      curLine.text += (curLine.text ? ' ' : '') + item.text;
    }
    if (curLine) lines.push(curLine);

    // Group lines into paragraphs by Y gap
    const paragraphs = [];
    let curPara = null;

    for (const line of lines) {
      if (!curPara || (curPara.lines.length > 0 &&
          Math.abs(curPara.lines[curPara.lines.length - 1].y - line.y) > PARA_GAP)) {
        if (curPara) paragraphs.push(curPara);
        curPara = { lines: [], text: '' };
      }
      curPara.lines.push(line);
      curPara.text += (curPara.text ? '\n' : '') + line.text;
    }
    if (curPara) paragraphs.push(curPara);

    return paragraphs;
  }

  // ─── Navigation ─────────────────────────────────

  function scrollToPage(n) {
    const el = container.querySelector(`.pdf-page-wrapper[data-page="${n}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function updateNav() {
    pageNumEl.textContent = `${currentPage} / ${totalPages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; updateNav(); scrollToPage(currentPage); }
  });
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) { currentPage++; updateNav(); scrollToPage(currentPage); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prevBtn.click();
    if (e.key === 'ArrowRight') nextBtn.click();
  });

  container.addEventListener('scroll', () => {
    const pages = container.querySelectorAll('.pdf-page-wrapper');
    let nearest = 1, min = Infinity;
    pages.forEach(p => {
      const d = Math.abs(p.getBoundingClientRect().top);
      if (d < min) { min = d; nearest = +p.dataset.page; }
    });
    if (nearest !== currentPage) { currentPage = nearest; updateNav(); }
  }, { passive: true });

  // ─── Translation ────────────────────────────────

  translateBtn.addEventListener('click', async () => {
    if (isTranslated) { toggleTranslation(); return; }
    await translateAll();
  });
  toggleBtn.addEventListener('click', toggleTranslation);

  async function translateAll() {
    if (!settings.apiKey) { alert(t('errNoApiKey')); return; }
    settings.sourceLang = sourceLang.value;
    settings.targetLang = targetLang.value;

    translateBtn.disabled = true;
    translateBtn.textContent = t('btnTranslating');

    translatedTexts = new Array(originalTexts.length).fill(null);
    const items = originalTexts.map((text, i) => ({ text: text.trim(), idx: i }))
      .filter(item => item.text.length > 0);

    const chunks = buildChunks(items, 1200);
    let completed = 0, nextIdx = 0;
    const workerCount = Math.min(MAX_CONCURRENCY, chunks.length);

    async function worker() {
      let idx;
      while ((idx = nextIdx++) < chunks.length) {
        const chunk = chunks[idx];
        const texts = chunk.map(c => c.text);
        try {
          const result = await chrome.runtime.sendMessage({
            action: 'translate', text: formatBatchText(texts), settings, batchMode: true
          });
          if (result.success) {
            const trans = parseBatchResponse(result.text, texts.length);
            chunk.forEach((c, i) => {
              if (trans[i] && trans[i].trim().length > 0) {
                translatedTexts[c.idx] = trans[i].trim();
              }
            });
          }
        } catch (err) { console.warn('Chunk error:', err); }
        completed += chunk.length;
        translateBtn.textContent = t('viewerTranslatingProgress', Math.min(completed, items.length), items.length);
      }
    }

    await Promise.all(Array(workerCount).fill(null).map(() => worker()));

    // Build translation panels
    buildTranslationPanels();
    container.querySelectorAll('.pdf-trans-panel').forEach(p => p.style.display = 'block');
    isTranslated = true;
    panelsVisible = true;
    translateBtn.textContent = t('viewerTranslate') + ' ✓';
    toggleBtn.style.display = 'inline-block';
    toggleBtn.textContent = '↩ ' + t('viewerToggleOrig');
  }

  // Build translation panel content for each page
  function buildTranslationPanels() {
    let paraIdx = 0;
    const wrappers = container.querySelectorAll('.pdf-page-wrapper');
    wrappers.forEach(wrapper => {
      const panel = wrapper.querySelector('.pdf-trans-panel');
      if (!panel) return;
      panel.innerHTML = '';

      const pageData = allParagraphs.find(p => p.page === +wrapper.dataset.page);
      if (!pageData) return;

      for (const para of pageData.paragraphs) {
        const orig = para.text;
        const trans = translatedTexts[paraIdx] || '';
        paraIdx++;

        const row = document.createElement('div');
        row.className = 'trans-row';

        const origDiv = document.createElement('div');
        origDiv.className = 'trans-orig';
        origDiv.textContent = orig;

        const transDiv = document.createElement('div');
        transDiv.className = 'trans-text';
        transDiv.textContent = trans || t('viewerTransFailed');

        row.appendChild(origDiv);
        row.appendChild(transDiv);
        panel.appendChild(row);
      }
    });
  }

  function toggleTranslation() {
    if (!isTranslated || translatedTexts.length === 0) return;
    panelsVisible = !panelsVisible;
    container.querySelectorAll('.pdf-trans-panel')
      .forEach(p => p.style.display = panelsVisible ? 'block' : 'none');
    toggleBtn.textContent = panelsVisible
      ? '↩ ' + t('viewerToggleOrig')
      : '🌐 ' + t('viewerToggleTrans');
  }

  // ─── Office files ────────────────────────────────

  async function initOfficeFile(id) {
    loading.textContent = t('viewerLoadingFile');
    const data = await loadFromBg(id);
    if (!data) { loading.textContent = t('viewerNoFileData'); return; }
    const text = new TextDecoder('utf-8').decode(data);
    if (!text.trim()) { loading.textContent = t('viewerEmptyFile'); return; }

    const pars = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    totalPages = 1;
    pageInfo.textContent = t('viewerSegments', pars.length);
    prevBtn.style.display = 'none'; nextBtn.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-page-wrapper office-wrapper';
    wrapper.dataset.page = 1;

    const panel = document.createElement('div');
    panel.className = 'pdf-trans-panel';
    panel.style.width = '800px';
    panel.style.display = 'block';

    originalTexts = pars.map(p => p.trim());
    pars.forEach(pText => {
      const row = document.createElement('div');
      row.className = 'trans-row';
      const origDiv = document.createElement('div');
      origDiv.className = 'trans-orig';
      origDiv.textContent = pText.trim();
      const transDiv = document.createElement('div');
      transDiv.className = 'trans-text';
      transDiv.textContent = '';
      row.appendChild(origDiv);
      row.appendChild(transDiv);
      panel.appendChild(row);
    });

    wrapper.appendChild(panel);
    container.appendChild(wrapper);
    loading.style.display = 'none';
    translateBtn.disabled = false;
  }

  // ─── Helpers ────────────────────────────────────

  async function loadFromBg(id) {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'getPDFData', id });
      return res?.data ? new Uint8Array(res.data) : null;
    } catch { return null; }
  }

  function getDefaultTargetLang() {
    const code = (navigator.language || 'en').split('-')[0].toLowerCase();
    const map = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', ru: 'Русский' };
    return map[code] || 'English';
  }

  async function loadSettings() {
    try { const r = await chrome.runtime.sendMessage({ action: 'getSettings' }); return r?.settings || {}; }
    catch { return {}; }
  }

  function buildChunks(items, maxSize) {
    const chunks = []; let cur = [], len = 0;
    for (const item of items) {
      const l = item.text.length;
      if (len + l > maxSize && cur.length > 0) { chunks.push(cur); cur = []; len = 0; }
      cur.push(item); len += l;
    }
    if (cur.length > 0) chunks.push(cur);
    return chunks;
  }

  function formatBatchText(texts) { return texts.map((t, i) => `[#${i + 1}]\n${t}`).join('\n\n'); }

  function parseBatchResponse(response, count) {
    const results = new Array(count).fill(null);
    for (let i = 1; i <= count; i++) {
      const m = response.match(new RegExp(`\\[#${i}\\]([\\s\\S]*?)(?=\\[#${i + 1}\\]|\\[#\\d+\\]|$)`, 'i'));
      if (m) results[i - 1] = m[1].trim();
    }
    return results;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  init();
})();
