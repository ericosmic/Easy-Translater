// ═══════════════════════════════════════════════════
//  自定义 Prompt 管理
// ═══════════════════════════════════════════════════

let customPrompts = {}; // { promptId: { name: string, template: string } }

function loadPrompts(saved, activeId) {
  customPrompts = saved || {};
  const sel = document.getElementById('promptSelector');
  if (!sel) return;

  sel.innerHTML = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = 'default';
  defaultOpt.textContent = i18nGet('promptDefaultOption');
  sel.appendChild(defaultOpt);

  Object.entries(customPrompts).forEach(([id, p]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });

  sel.value = activeId || 'default';
  updatePromptText();
}

function updatePromptText() {
  const sel = document.getElementById('promptSelector');
  const text = document.getElementById('promptText');
  const updateBtn = document.getElementById('updatePrompt');
  const deleteBtn = document.getElementById('deletePrompt');
  if (!sel || !text) return;

  const id = sel.value;
  if (id === 'default') {
    text.value = '';
    text.placeholder = i18nGet('promptDefaultPlaceholder');
    if (updateBtn) updateBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
  } else {
    const p = customPrompts[id];
    text.value = p?.template || '';
    text.placeholder = '';
    if (updateBtn) updateBtn.disabled = false;
    if (deleteBtn) deleteBtn.disabled = false;
  }
}

function getCustomPrompts() {
  return customPrompts;
}

function initPromptManager(showStatusFn) {
  const sel = document.getElementById('promptSelector');
  const saveBtn = document.getElementById('savePrompt');
  const updateBtn = document.getElementById('updatePrompt');
  const deleteBtn = document.getElementById('deletePrompt');
  const text = document.getElementById('promptText');

  if (!sel) return;

  // Prompt 选择器变化
  sel.addEventListener('change', updatePromptText);

  // 保存为新模板
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!text) return;
      const content = text.value.trim();
      if (!content) {
        showStatusFn(i18nGet('statusPromptEmpty'), 'error');
        return;
      }
      const name = prompt(i18nGet('promptNamePrompt'), i18nGet('promptDefaultName', Object.keys(customPrompts).length + 1));
      if (!name) return;

      const id = 'custom_' + Date.now();
      customPrompts[id] = { name, template: content };
      loadPrompts(customPrompts, id);
      showStatusFn(i18nGet('statusPromptSaved'), 'success');
    });
  }

  // 更新当前模板
  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      const id = sel.value;
      if (id === 'default') return;
      if (!text) return;
      const content = text.value.trim();
      if (!content) {
        showStatusFn(i18nGet('statusPromptEmpty'), 'error');
        return;
      }
      customPrompts[id].template = content;
      showStatusFn(i18nGet('statusPromptUpdated'), 'success');
    });
  }

  // 删除模板
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const id = sel.value;
      if (id === 'default') return;
      if (!confirm(i18nGet('promptConfirmDelete'))) return;
      delete customPrompts[id];
      loadPrompts(customPrompts, 'default');
      showStatusFn(i18nGet('statusPromptDeleted'), 'success');
    });
  }
}

// 导出给 popup.js 使用
window.PromptManager = {
  load: loadPrompts,
  init: initPromptManager,
  getPrompts: getCustomPrompts
};
