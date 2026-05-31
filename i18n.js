// i18n — detects browser language and applies translations via data-i18n attributes
(function () {
  'use strict';

  const messages = {
    en: {
      tabTranslate: 'Translate', tabSettings: 'Settings', tabAbout: 'About',
      translatePage: 'Translate Entire Page', translatePageDesc: 'Replace all page text with translations',
      translateFile: 'Translate Current File', translateFileDesc: 'Translate PDF / PPT / DOCX content',
      orInputText: 'or enter text', inputPlaceholder: 'Enter or paste text to translate...',
      autoDetect: 'Auto Detect', translateBtn: 'Translate', swapLang: 'Swap languages',
      providerLabel: 'API Provider', apiUrlLabel: 'API URL', apiKeyLabel: 'API Key',
      modelLabel: 'Model Name', styleLabel: 'Translation Style',
      styleNatural: 'Natural & Fluent', styleFormal: 'Formal & Professional',
      modelConfigTitle: 'Model Configuration', pageTranslateLabel: 'Page Translation',
      shortcutLabel: 'Shortcut', shortcutHint: 'Select text and press', shortcutHint2: 'for quick translation',
      displayModeLabel: 'Display Mode', displayModeTooltip: 'Floating Tooltip',
      displayModeInline: 'Replace Inline', displayModeSidebar: 'Sidebar',
      testBtn: 'Test Connection', saveBtn: 'Save Settings', showHide: 'Show/Hide',
      refreshModels: 'Refresh Models',
      aboutTitle: 'Universal Translator v1.0.0',
      aboutDesc: 'Translate web pages, PDF, PPT, DOCX and more.',
      aboutModels: 'Supports multiple LLM backends:',
      aboutUsage: 'How to use:', aboutUsage1: 'Select text → Right-click → Translate',
      aboutUsage2: 'Select text → Press Alt+T', aboutUsage3: 'Click extension icon to translate input text',
      aboutPDF: 'PDF: Opens automatically in the translation viewer',
      viewerTranslate: 'Translate', viewerToggleOrig: 'Show Original', viewerToggleTrans: 'Show Translation',
    },
    zh_CN: {
      tabTranslate: '翻译', tabSettings: '设置', tabAbout: '关于',
      translatePage: '翻译整个页面', translatePageDesc: '替换当前页面所有文字为译文',
      translateFile: '翻译当前文件', translateFileDesc: '翻译 PDF / PPT / DOCX 内容',
      orInputText: '或输入文本', inputPlaceholder: '输入或粘贴要翻译的文本...',
      autoDetect: '自动检测', translateBtn: '翻译', swapLang: '交换语言',
      providerLabel: 'API 提供商', apiUrlLabel: 'API 地址', apiKeyLabel: 'API Key',
      modelLabel: '模型名称', styleLabel: '翻译风格',
      styleNatural: '自然流畅', styleFormal: '正式专业',
      modelConfigTitle: '模型配置', pageTranslateLabel: '页面翻译',
      shortcutLabel: '快捷键', shortcutHint: '选中文本后按', shortcutHint2: '快速翻译',
      displayModeLabel: '显示模式', displayModeTooltip: '浮动提示框',
      displayModeInline: '替换原文', displayModeSidebar: '侧边栏',
      testBtn: '测试连接', saveBtn: '保存设置', showHide: '显示/隐藏',
      refreshModels: '刷新可用模型',
      aboutTitle: '万能翻译器 v1.0.0',
      aboutDesc: '支持翻译网页、PDF、PPT、DOCX等文件内容。',
      aboutModels: '可接入多种大模型：',
      aboutUsage: '使用方式：', aboutUsage1: '选中文本 → 右键 → 翻译选中文本',
      aboutUsage2: '选中文本 → 按 Alt+T', aboutUsage3: '点击图标打开弹窗输入文本',
      aboutPDF: 'PDF 支持：打开 PDF 文件后自动加载翻译工具',
      viewerTranslate: '翻译', viewerToggleOrig: '显示原文', viewerToggleTrans: '显示译文',
    },
    ja: {
      tabTranslate: '翻訳', tabSettings: '設定', tabAbout: '概要',
      translatePage: 'ページ全体を翻訳', translatePageDesc: 'ページ上のすべてのテキストを翻訳に置き換え',
      translateFile: '現在のファイルを翻訳', translateFileDesc: 'PDF / PPT / DOCX の内容を翻訳',
      orInputText: 'またはテキストを入力', inputPlaceholder: '翻訳するテキストを入力または貼り付け...',
      autoDetect: '自動検出', translateBtn: '翻訳', swapLang: '言語を入れ替え',
      providerLabel: 'API プロバイダ', apiUrlLabel: 'API URL', apiKeyLabel: 'API キー',
      modelLabel: 'モデル名', styleLabel: '翻訳スタイル',
      styleNatural: '自然で流暢', styleFormal: 'フォーマル・専門的',
      modelConfigTitle: 'モデル設定', pageTranslateLabel: 'ページ翻訳',
      shortcutLabel: 'ショートカット', shortcutHint: 'テキストを選択して', shortcutHint2: 'でクイック翻訳',
      displayModeLabel: '表示モード', displayModeTooltip: 'フローティングツールチップ',
      displayModeInline: 'インライン置換', displayModeSidebar: 'サイドバー',
      testBtn: '接続テスト', saveBtn: '設定を保存', showHide: '表示/非表示',
      refreshModels: 'モデル更新',
      aboutTitle: '万能翻訳機 v1.0.0',
      aboutDesc: 'ウェブページ、PDF、PPT、DOCXなどを翻訳します。',
      aboutModels: '複数のLLMバックエンドに対応：',
      aboutUsage: '使い方：', aboutUsage1: 'テキストを選択 → 右クリック → 翻訳',
      aboutUsage2: 'テキストを選択 → Alt+T を押す', aboutUsage3: '拡張機能アイコンをクリックしてテキストを入力',
      aboutPDF: 'PDF：自動的に翻訳ビューアーで開きます',
      viewerTranslate: '翻訳', viewerToggleOrig: '原文表示', viewerToggleTrans: '訳文表示',
    },
    ko: {
      tabTranslate: '번역', tabSettings: '설정', tabAbout: '정보',
      translatePage: '전체 페이지 번역', translatePageDesc: '페이지의 모든 텍스트를 번역문으로 교체',
      translateFile: '현재 파일 번역', translateFileDesc: 'PDF / PPT / DOCX 내용 번역',
      orInputText: '또는 텍스트 입력', inputPlaceholder: '번역할 텍스트를 입력하거나 붙여넣기...',
      autoDetect: '자동 감지', translateBtn: '번역', swapLang: '언어 교환',
      providerLabel: 'API 제공자', apiUrlLabel: 'API URL', apiKeyLabel: 'API 키',
      modelLabel: '모델 이름', styleLabel: '번역 스타일',
      styleNatural: '자연스럽고 유창하게', styleFormal: '격식 있고 전문적으로',
      modelConfigTitle: '모델 설정', pageTranslateLabel: '페이지 번역',
      shortcutLabel: '단축키', shortcutHint: '텍스트 선택 후', shortcutHint2: '로 빠른 번역',
      displayModeLabel: '표시 모드', displayModeTooltip: '플로팅 툴팁',
      displayModeInline: '인라인 교체', displayModeSidebar: '사이드바',
      testBtn: '연결 테스트', saveBtn: '설정 저장', showHide: '표시/숨기기',
      refreshModels: '모델 새로고침',
      aboutTitle: '만능 번역기 v1.0.0',
      aboutDesc: '웹페이지, PDF, PPT, DOCX 등을 번역합니다.',
      aboutModels: '다양한 LLM 백엔드 지원:',
      aboutUsage: '사용 방법:', aboutUsage1: '텍스트 선택 → 우클릭 → 번역',
      aboutUsage2: '텍스트 선택 → Alt+T 누르기', aboutUsage3: '확장 프로그램 아이콘 클릭하여 텍스트 입력',
      aboutPDF: 'PDF: 번역 뷰어에서 자동으로 열립니다',
      viewerTranslate: '번역', viewerToggleOrig: '원문 보기', viewerToggleTrans: '번역문 보기',
    }
  };

  function detectLang() {
    const lang = (navigator.language || 'en').replace('-', '_');
    if (messages[lang]) return lang;
    const base = lang.split('_')[0];
    if (messages[base]) return base;
    // check if any key starts with the base
    for (const k of Object.keys(messages)) {
      if (k.startsWith(base + '_')) return k;
    }
    return 'en';
  }

  const currentLang = detectLang();
  const t = messages[currentLang] || messages.en;

  // Apply translations to DOM elements with data-i18n attribute
  window.applyI18n = function (root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (t[key]) el.textContent = t[key];
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (t[key]) el.placeholder = t[key];
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      if (t[key]) el.title = t[key];
    });
  };

  // Expose i18n message getter for JS use
  window.i18nGet = function (key) {
    return t[key] || key;
  };

  // Auto-apply on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyI18n());
  } else {
    applyI18n();
  }
})();
