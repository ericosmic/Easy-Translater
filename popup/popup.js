// 设置弹窗逻辑
const CONFIG_KEYS = ['provider', 'apiUrl', 'apiKey', 'model', 'sourceLang', 'targetLang', 'style', 'displayMode'];

function getDefaultTargetLang() {
  const code = (navigator.language || 'en').split('-')[0].toLowerCase();
  const map = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', ru: 'Русский' };
  return map[code] || 'English';
}

// DOM elements
const els = {};
document.querySelectorAll('[id]').forEach(el => els[el.id] = el);

const PROVIDER_DEFAULTS = {
  openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  anthropic: { url: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' },
  ollama: { url: 'http://localhost:11434/v1', model: 'llama3.2' }
};

// 初始化：加载设置
document.addEventListener('DOMContentLoaded', async () => {
  const { settings } = await chrome.runtime.sendMessage({ action: 'getSettings' });
  if (settings) applySettings(settings);

  // 加载模型列表
  const provider = settings?.provider || 'openai';
  updateModelList(provider);
  updateApiKeyVisibility(provider);
  if (provider === 'ollama') fetchOllamaModels();
});

function applySettings(s) {
  els.provider.value = s.provider || 'openai';
  els.apiUrl.value = s.apiUrl || PROVIDER_DEFAULTS.openai.url;
  els.apiKey.value = s.apiKey || '';
  els.model.value = s.model || '';
  els.sourceLang.value = s.sourceLang || 'auto';
  els.targetLang.value = s.targetLang || getDefaultTargetLang();
  els.style.value = s.style || 'natural';
  els.displayMode.value = s.displayMode || 'tooltip';
}

function collectSettings() {
  return {
    provider: els.provider.value,
    apiUrl: els.apiUrl.value,
    apiKey: els.apiKey.value,
    model: els.model.value,
    sourceLang: els.sourceLang.value,
    targetLang: els.targetLang.value,
    style: els.style.value,
    displayMode: els.displayMode.value
  };
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// Provider change → update default URL and model
els.provider.addEventListener('change', () => {
  const def = PROVIDER_DEFAULTS[els.provider.value];
  if (def) {
    els.apiUrl.value = def.url;
    els.model.value = def.model;
  }
  updateModelList(els.provider.value);
  updateApiKeyVisibility(els.provider.value);
  if (els.provider.value === 'ollama') fetchOllamaModels();
});

function updateApiKeyVisibility(provider) {
  const keyRow = els.apiKey.closest('.password-row');
  const keyLabel = keyRow?.previousElementSibling;
  const isOllama = provider === 'ollama';
  if (keyRow) keyRow.style.display = isOllama ? 'none' : '';
  if (keyLabel) keyLabel.style.display = isOllama ? 'none' : '';

  const ollamaHint = document.getElementById('ollamaHint');
  if (ollamaHint) ollamaHint.style.display = isOllama ? 'block' : 'none';
}

async function fetchOllamaModels() {
  const apiUrl = els.apiUrl.value || 'http://localhost:11434/v1';
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'getModels',
      settings: { provider: 'ollama', apiKey: '', apiUrl }
    });
    if (result.success && result.models?.length) {
      const datalist = els.modelList;
      datalist.innerHTML = '';
      result.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        datalist.appendChild(opt);
      });
      // 默认选第一个已安装的模型
      if (!els.model.value || els.model.value === 'llama3.2') {
        els.model.value = result.models[0];
      }
    }
  } catch {
    // 保留预设列表
  }
}

async function updateModelList(provider) {
  const datalist = els.modelList;
  datalist.innerHTML = '';

  const predefined = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'deepseek-chat', 'deepseek-reasoner', 'qwen-plus', 'qwen-max', 'glm-4', 'glm-4v'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
    gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    ollama: ['llama3.2', 'llama3.1', 'qwen2.5', 'gemma2', 'mistral', 'phi3']
  };

  const models = predefined[provider] || predefined.openai;
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    datalist.appendChild(opt);
  });
}

// Refresh models from API
els.refreshModels.addEventListener('click', async () => {
  const provider = els.provider.value;
  const apiKey = els.apiKey.value;
  const apiUrl = els.apiUrl.value;

  showStatus('正在获取模型列表...', 'info');
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'getModels',
      settings: { provider, apiKey, apiUrl }
    });
    if (result.success && result.models?.length) {
      const datalist = els.modelList;
      datalist.innerHTML = '';
      result.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        datalist.appendChild(opt);
      });
      showStatus('模型列表已更新', 'success');
    } else {
      updateModelList(provider);
      showStatus('已加载默认模型列表', 'info');
    }
  } catch {
    updateModelList(provider);
    showStatus('已加载默认模型列表', 'info');
  }
});

// Toggle API key visibility
els.toggleKey.addEventListener('click', () => {
  const input = els.apiKey;
  input.type = input.type === 'password' ? 'text' : 'password';
  els.toggleKey.textContent = input.type === 'password' ? '👁' : '👁‍🗨';
});

// Swap languages
els.swapLang.addEventListener('click', () => {
  [els.sourceLang.value, els.targetLang.value] = [els.targetLang.value, els.sourceLang.value];
  if (els.sourceLang.value === '中文') els.sourceLang.value = 'auto';
  if (els.targetLang.value === 'auto') els.targetLang.value = 'English';
});

// Quick translate
els.translateBtn.addEventListener('click', async () => {
  const text = els.inputText.value.trim();
  if (!text) return;

  const settings = collectSettings();
  els.translateBtn.disabled = true;
  els.translateBtn.textContent = '翻译中...';

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'translate',
      text,
      settings
    });

    if (result.success) {
      els.translateResult.textContent = result.text;
      els.translateResult.hidden = false;
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    els.translateBtn.disabled = false;
    els.translateBtn.textContent = '翻译';
  }
});

// Test connection
els.testBtn.addEventListener('click', async () => {
  const settings = collectSettings();
  if (!settings.apiKey && settings.provider !== 'ollama') {
    showStatus('请填写 API Key', 'error');
    return;
  }

  els.testBtn.disabled = true;
  els.testBtn.textContent = '测试中...';
  showStatus('正在测试连接...', 'info');

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'testConnection',
      settings
    });

    if (result.success) {
      showStatus(`✓ 连接成功！测试翻译: ${result.text}`, 'success');
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    showStatus(`✗ 连接失败: ${err.message}`, 'error');
  } finally {
    els.testBtn.disabled = false;
    els.testBtn.textContent = '测试连接';
  }
});

// Save settings
els.saveBtn.addEventListener('click', async () => {
  const settings = collectSettings();
  await chrome.storage.sync.set(settings);
  showStatus('✓ 设置已保存', 'success');
});

function showStatus(msg, type) {
  els.statusMsg.textContent = msg;
  els.statusMsg.className = `status-msg ${type}`;
  els.statusMsg.style.display = 'block';
  if (type === 'success') {
    setTimeout(() => { els.statusMsg.style.display = 'none'; }, 3000);
  }
}

// 语言切换时自动保存（让划词翻译立即生效）
els.sourceLang.addEventListener('change', () => {
  chrome.storage.sync.set({ sourceLang: els.sourceLang.value }).catch(() => {});
});
els.targetLang.addEventListener('change', () => {
  chrome.storage.sync.set({ targetLang: els.targetLang.value }).catch(() => {});
});

// Ctrl+Enter to translate in textarea
els.inputText.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    els.translateBtn.click();
  }
});

// 翻译整个页面
els.translateFullPage.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const msg = {
    action: 'translateFullPage',
    sourceLang: els.sourceLang.value,
    targetLang: els.targetLang.value
  };

  // 保存当前语言设置，让划词翻译等也能使用更新后的语言
  await chrome.storage.sync.set({
    sourceLang: els.sourceLang.value,
    targetLang: els.targetLang.value
  });

  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    });
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tab.id, msg);
      } catch (e) {
        showStatus('无法注入翻译脚本', 'error');
      }
    }, 300);
  }
  window.close();
});

// 翻译当前文件 (PDF/Office)
els.translateFile.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const url = (tab.url || '').toLowerCase();
  if (url.endsWith('.pdf') || url.includes('.pdf#') || url.includes('.pdf?') ||
      url.endsWith('.pptx') || url.endsWith('.ppt') ||
      url.endsWith('.docx') || url.endsWith('.doc')) {
    // 通过 background 打开文件查看器
    await chrome.runtime.sendMessage({ action: 'openFileViewer', url: tab.url, tabId: tab.id });
  } else if (url.includes('office.com') || url.includes('docs.google.com') || url.includes('sharepoint.com')) {
    const msg = {
      action: 'translateFullPage',
      sourceLang: els.sourceLang.value,
      targetLang: els.targetLang.value
    };
    await chrome.storage.sync.set({
      sourceLang: els.sourceLang.value,
      targetLang: els.targetLang.value
    });
    try {
      await chrome.tabs.sendMessage(tab.id, msg);
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content.js']
      });
      setTimeout(async () => {
        await chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      }, 300);
    }
  } else {
    showStatus('当前页面不是 PDF 或 Office 文件', 'error');
  }
  window.close();
});
