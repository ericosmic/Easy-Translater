// i18n — thin wrapper over chrome.i18n; applies translations via data-i18n attributes.
// Messages live in _locales/<lang>/messages.json; Chrome picks the locale itself
// (UI language → default_locale from the manifest).
(function () {
  'use strict';

  // Returns the localized string for `key`, or the key itself if it is missing —
  // a missing key stays visible instead of collapsing to an empty label.
  // Extra arguments are passed to chrome.i18n as $1..$9 substitutions.
  function t(key, ...subs) {
    if (typeof chrome === 'undefined' || !chrome.i18n) return key;
    const msg = subs.length
      ? chrome.i18n.getMessage(key, subs.map(String))
      : chrome.i18n.getMessage(key);
    return msg || key;
  }

  // Apply translations to DOM elements with data-i18n attribute
  window.applyI18n = function (root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const msg = t(el.dataset.i18n);
      if (msg !== el.dataset.i18n) el.textContent = msg;
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      const msg = t(key);
      if (msg !== key) el.placeholder = msg;
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      const msg = t(key);
      if (msg !== key) el.title = msg;
    });
  };

  // Expose i18n message getter for JS use
  window.i18nGet = t;

  // Auto-apply on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyI18n());
  } else {
    applyI18n();
  }
})();
