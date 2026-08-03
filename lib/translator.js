// LLM API 抽象层 - 支持多种大模型

// i18n — available in the service worker via chrome.i18n; falls back to the key.
// Both the user-facing errors and the system prompts below are localized, so the
// prompt sent to the model follows the extension's UI language.
function t(key, ...subs) {
  if (typeof chrome === 'undefined' || !chrome.i18n) return key;
  const msg = subs.length
    ? chrome.i18n.getMessage(key, subs.map(String))
    : chrome.i18n.getMessage(key);
  return msg || key;
}

const DEFAULT_PROVIDERS = {
  openai: {
    name: t('providerOpenAI'),
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'deepseek-chat', 'qwen-plus', 'glm-4'],
    chatEndpoint: '/chat/completions'
  },
  anthropic: {
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
    chatEndpoint: '/v1/messages'
  },
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    chatEndpoint: '/models/{model}:generateContent'
  }
};

// 根据浏览器语言推断默认目标语言
function getDefaultTargetLang() {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'zh-CN';
  const code = lang.split('-')[0].toLowerCase();
  const map = {
    zh: '中文', en: 'English', ja: '日本語', ko: '한국어',
    fr: 'Français', de: 'Deutsch', es: 'Español', ru: 'Русский'
  };
  return map[code] || 'English';
}

async function translateText(text, settings, batchMode = false, signal = null) {
  const { provider, apiKey, apiUrl, model, sourceLang, targetLang, style, customPrompts, activePrompt } = settings;

  if (!apiKey && provider !== 'ollama') throw new Error(t('errNoApiKey'));
  if (!text?.trim()) throw new Error(t('errNoText'));

  const src = sourceLang === 'auto' ? t('promptSrcAuto') : sourceLang;
  const tgt = targetLang || getDefaultTargetLang();

  let systemPrompt;

  // 使用自定义 prompt
  if (activePrompt && activePrompt !== 'default' && customPrompts?.[activePrompt]) {
    systemPrompt = customPrompts[activePrompt].template
      .replace(/\{src\}/g, src)
      .replace(/\{tgt\}/g, tgt);
  } else if (batchMode) {
    systemPrompt = t('promptBatch', src, tgt);
  } else if (style === 'formal') {
    systemPrompt = t('promptFormal', src, tgt);
  } else {
    systemPrompt = t('promptNatural', src, tgt);
  }

  // 批量翻译时，如果使用自定义 prompt，追加段落标记说明
  if (batchMode && activePrompt && activePrompt !== 'default' && customPrompts?.[activePrompt]) {
    systemPrompt += '\n\n' + t('promptBatchSuffix');
  }

  switch (provider) {
    case 'anthropic': return translateWithAnthropic(apiKey, apiUrl, model, systemPrompt, text, signal);
    case 'gemini': return translateWithGemini(apiKey, apiUrl, model, systemPrompt, text, signal);
    case 'ollama': return translateWithOllama(apiKey, apiUrl, model, systemPrompt, text, signal);
    default: return translateWithOpenAI(apiKey, apiUrl, model, systemPrompt, text, signal);
  }
}

async function translateWithOpenAI(apiKey, apiUrl, model, systemPrompt, text, signal) {
  const url = `${apiUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    signal,
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 4096
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(t('errApi', res.status, err));
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function translateWithAnthropic(apiKey, apiUrl, model, systemPrompt, text, signal) {
  const url = `${apiUrl.replace(/\/$/, '')}/v1/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    signal,
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(t('errApi', res.status, err));
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

async function translateWithGemini(apiKey, apiUrl, model, systemPrompt, text, signal) {
  const modelName = model || 'gemini-2.5-flash';
  const url = `${apiUrl.replace(/\/$/, '')}/models/${modelName}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(t('errApi', res.status, err));
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function translateWithOllama(apiKey, apiUrl, model, systemPrompt, text, signal) {
  const url = `${apiUrl.replace(/\/$/, '')}/chat/completions`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: model || 'llama3.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 4096
      })
    });
  } catch (e) {
    throw new Error(t('errOllamaConnect'));
  }
  if (res.status === 403) {
    throw new Error(t('errOllamaCors'));
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(t('errApi', res.status, err));
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function testConnection(settings) {
  return translateText('Hello, how are you?', { ...settings, sourceLang: 'English', targetLang: getDefaultTargetLang() });
}

async function getAvailableModels(provider, apiKey, apiUrl) {
  if (provider === 'anthropic') {
    // Claude models are predefined
    return DEFAULT_PROVIDERS.anthropic.models;
  }
  if (provider === 'gemini') {
    return DEFAULT_PROVIDERS.gemini.models;
  }
  if (provider === 'ollama') {
    // Try to fetch from Ollama tags API
    try {
      const url = `${apiUrl.replace(/\/$/, '').replace(/\/v1$/, '')}/api/tags`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.models?.length) {
          return data.models.map(m => m.name);
        }
      }
    } catch (e) {
      // fallback to defaults
    }
    return ['llama3.2', 'llama3.1', 'qwen2.5', 'gemma2', 'mistral', 'phi3'];
  }
  // OpenAI-compatible - try to fetch models
  try {
    const url = `${apiUrl.replace(/\/$/, '')}/models`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data?.length) {
        return data.data
          .filter(m => m.id?.includes('gpt') || m.id?.includes('claude') || m.id?.includes('deepseek') || m.id?.includes('qwen') || m.id?.includes('glm'))
          .map(m => m.id)
          .slice(0, 20);
      }
    }
  } catch (e) {
    // fallback to defaults
  }
  return DEFAULT_PROVIDERS.openai.models;
}

async function translateBatch(texts, settings) {
  // For translating multiple text segments at once (e.g., PDF paragraphs)
  const batchText = texts.map((t, i) => `[${i + 1}] ${t}`).join('\n---\n');
  const result = await translateText(batchText, settings);
  // Parse results back into array
  const lines = result.split('\n---\n');
  return texts.map((_, i) => {
    const match = lines.find(l => l.trim().startsWith(`[${i + 1}]`));
    return match ? match.replace(`[${i + 1}]`, '').trim() : '';
  });
}
