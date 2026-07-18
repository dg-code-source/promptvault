// State Management
let prompts = [];
let drafts = JSON.parse(localStorage.getItem('pv_drafts')) || [];
let favorites = JSON.parse(localStorage.getItem('pv_favorites')) || [];
let activeCategory = 'all';
let searchQuery = '';
let hapticsEnabled = localStorage.getItem('pv_haptics') !== 'false'; // default true
let newServiceWorker = null;
let editingDraftId = null; // Track draft being edited

// GitHub Repository Auto-detection
let repoOwner = 'dg-code-source';
let repoName = 'promptvault';
if (window.location.hostname.endsWith('github.io')) {
  repoOwner = window.location.hostname.split('.')[0];
  const paths = window.location.pathname.split('/').filter(p => p.length > 0);
  if (paths.length > 0) {
    repoName = paths[0];
  }
}

// GitHub API Token State
let githubToken = localStorage.getItem('pv_github_token') || '';

// UI Elements
const promptsGrid = document.getElementById('prompts-grid');
const categoryTabs = document.getElementById('category-tabs');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const emptyState = document.getElementById('empty-state');
const emptyTitle = document.getElementById('empty-title');
const emptyDescription = document.getElementById('empty-description');
const emptyActionBtn = document.getElementById('empty-action-btn');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const modalOverlay = document.getElementById('modal-overlay');
const syncBtn = document.getElementById('sync-btn');
const copyTemplateBtn = document.getElementById('copy-template-btn');
const vibrateCheckbox = document.getElementById('setting-vibrate');
const updateBanner = document.getElementById('update-banner');
const updateBtn = document.getElementById('update-btn');
const toastContainer = document.getElementById('toast-container');

// Draft UI Elements
const addDraftBtn = document.getElementById('add-draft-btn');
const draftModal = document.getElementById('draft-modal');
const draftCloseBtn = document.getElementById('draft-close-btn');
const draftOverlay = document.getElementById('draft-overlay');
const draftForm = document.getElementById('draft-form');

// GitHub Token Input Element
const githubTokenInput = document.getElementById('setting-github-token');

// Initialize settings checkbox state
vibrateCheckbox.checked = hapticsEnabled;

// Core Initialization
async function init() {
  await loadPrompts();
  setupEventListeners();
  registerServiceWorker();
}

// Fetch Prompts JSON
async function loadPrompts(forceFetch = false) {
  try {
    // Force sync works by appending a timestamp to bypass HTTP cache
    const url = forceFetch ? `./prompts.json?t=${Date.now()}` : './prompts.json';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    prompts = await response.json();
    renderCategories();
    renderPrompts();
    
    if (forceFetch) {
      showToast('Prompts synchronized successfully!', 'success');
    }
  } catch (error) {
    console.error('Failed to load prompts:', error);
    showToast('Failed to load prompts. Showing offline backup.', 'error');
    // Try to load cached version if offline
    if (prompts.length === 0) {
      promptsGrid.innerHTML = '';
      showEmptyState('Could not load prompts', 'Are you offline? Check your connection and try again.');
    }
  }
}

// Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Service Worker registered with scope:', reg.scope);
        
        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New update is available but waiting
                  newServiceWorker = installingWorker;
                  updateBanner.classList.remove('hidden');
                }
              }
            });
          }
        });
      })
      .catch(err => {
        console.error('Service Worker registration failed:', err);
      });
  }
}

// Trigger Service Worker Activation Update
updateBtn.addEventListener('click', () => {
  if (newServiceWorker) {
    newServiceWorker.postMessage({ action: 'skipWaiting' });
    updateBanner.classList.add('hidden');
    // Reload page once new worker is activated
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
});

// Category Rendering
function renderCategories() {
  // Extract unique categories from prompts + local drafts
  const allPrompts = [...prompts, ...drafts];
  const categories = [...new Set(allPrompts.map(p => p.category))].filter(Boolean);
  
  // Clear dynamic tabs (everything after the static 'Favorites' tab)
  const staticTabsCount = 2; // All, Favorites
  while (categoryTabs.children.length > staticTabsCount) {
    categoryTabs.removeChild(categoryTabs.lastChild);
  }
  
  // Create tab buttons
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.textContent = cat;
    btn.dataset.category = cat.toLowerCase();
    categoryTabs.appendChild(btn);
  });
}

// Prompt Filtering and Rendering
function renderPrompts() {
  promptsGrid.innerHTML = '';
  
  const allPrompts = [...prompts, ...drafts];
  let filtered = allPrompts.filter(p => {
    // Category filter
    if (activeCategory === 'favorites') {
      return favorites.includes(p.id);
    } else if (activeCategory !== 'all') {
      return p.category.toLowerCase() === activeCategory;
    }
    return true;
  });
  
  // Search query filter
  if (searchQuery.trim().length > 0) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => {
      const matchTitle = p.title.toLowerCase().includes(query);
      const matchDesc = p.description.toLowerCase().includes(query);
      const matchTags = p.tags && p.tags.some(tag => tag.toLowerCase().includes(query));
      return matchTitle || matchDesc || matchTags;
    });
  }
  
  if (filtered.length === 0) {
    if (activeCategory === 'favorites') {
      showEmptyState('No favorites yet', 'Tap the star icon on any prompt card to add it to your favorites list.');
      emptyActionBtn.classList.add('hidden'); // No action button needed
    } else {
      showEmptyState('No prompts found', 'Try adjusting your search keywords or view another category.');
      emptyActionBtn.classList.remove('hidden');
      emptyActionBtn.textContent = 'Clear Search';
      emptyActionBtn.onclick = () => {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.classList.add('hidden');
        renderPrompts();
      };
    }
    return;
  }
  
  emptyState.classList.add('hidden');
  
  filtered.forEach(p => {
    const isFav = favorites.includes(p.id);
    const card = document.createElement('div');
    card.className = `prompt-card ${isFav ? 'favorited' : ''}`;
    card.dataset.id = p.id;
    
    // Star toggle button
    const starBtn = document.createElement('button');
    starBtn.className = `card-star-btn ${isFav ? 'active' : ''}`;
    starBtn.innerHTML = isFav ? '★' : '☆';
    starBtn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
    starBtn.onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(p.id, starBtn, card);
    };
    
    // Header
    const cat = document.createElement('div');
    cat.className = 'card-category';
    cat.textContent = p.category;
    
    const title = document.createElement('h2');
    title.className = 'card-title';
    title.textContent = p.title;
    
    if (p.isDraft) {
      const badge = document.createElement('span');
      badge.className = 'draft-badge';
      badge.textContent = 'Draft';
      title.appendChild(badge);
    }
    
    const desc = document.createElement('p');
    desc.className = 'card-description';
    desc.textContent = p.description;
    
    // Code block preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'card-prompt-preview';
    
    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'prompt-body-wrapper';
    
    const code = document.createElement('code');
    code.textContent = p.prompt;
    bodyWrapper.appendChild(code);
    previewContainer.appendChild(bodyWrapper);
    
    card.appendChild(starBtn);
    card.appendChild(cat);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(previewContainer);
    
    // Variables section (if prompt has variables)
    if (p.variables && p.variables.length > 0) {
      const varSection = document.createElement('div');
      varSection.className = 'variables-section';
      
      p.variables.forEach(v => {
        const field = document.createElement('div');
        field.className = 'variable-field';
        
        const label = document.createElement('label');
        label.textContent = formatVarLabel(v.name);
        
        let input;
        const isTextArea = ['text', 'content', 'document', 'context', 'message'].some(kw => v.name.toLowerCase().includes(kw));
        
        if (isTextArea) {
          input = document.createElement('textarea');
          input.rows = 3;
        } else {
          input = document.createElement('input');
          input.type = 'text';
        }
        
        input.className = 'variable-input';
        input.placeholder = v.default ? `Default: ${v.default}` : `Enter ${formatVarLabel(v.name).toLowerCase()}`;
        input.dataset.varName = v.name;
        input.dataset.defaultVal = v.default;
        
        // Prefill default value
        if (v.default) {
          input.value = v.default;
        }
        
        field.appendChild(label);
        field.appendChild(input);
        varSection.appendChild(field);
      });
      
      card.appendChild(varSection);
    }
    
    // Actions panel
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    
    // Copy Action
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-dark';
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      Copy Prompt
    `;
    copyBtn.onclick = () => {
      const finalPrompt = compilePromptText(p.prompt, card);
      copyToClipboard(finalPrompt);
    };
    
    // Share Action
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn btn-outline btn-icon-only';
    shareBtn.setAttribute('aria-label', 'Share prompt');
    shareBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
    `;
    shareBtn.onclick = () => {
      const finalPrompt = compilePromptText(p.prompt, card);
      sharePrompt(p.title, finalPrompt);
    };
    
    // Reset inputs Action (Only show if prompt has variables)
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-outline btn-icon-only';
    resetBtn.setAttribute('aria-label', 'Reset inputs');
    resetBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 4v6h-6"></path>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
      </svg>
    `;
    resetBtn.onclick = () => {
      confirmAndResetInputs(card);
    };
    
    // Copy Markdown template for local drafts
    let copyMdBtn, deleteBtn, publishBtn;
    if (p.isDraft) {
      publishBtn = document.createElement('button');
      publishBtn.className = 'btn btn-outline';
      publishBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        Publish
      `;
      publishBtn.onclick = () => {
        publishDraftToGitHub(p, publishBtn);
      };

      editBtn = document.createElement('button');
      editBtn.className = 'btn btn-outline btn-icon-only';
      editBtn.setAttribute('aria-label', 'Edit draft');
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.onclick = () => {
        openEditDraftModal(p);
      };

      copyMdBtn = document.createElement('button');
      copyMdBtn.className = 'btn btn-outline btn-icon-only';
      copyMdBtn.setAttribute('aria-label', 'Copy raw markdown');
      copyMdBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        </svg>
      `;
      copyMdBtn.onclick = () => {
        const md = `---
title: ${p.title}
description: ${p.description}
category: ${p.category}
tags: ${p.tags ? p.tags.join(', ') : ''}
---

${p.prompt}`;
        copyToClipboard(md);
        showToast('Markdown template copied!', 'success');
      };
      
      deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-outline btn-icon-only';
      deleteBtn.style.borderColor = '#dc2626';
      deleteBtn.style.color = '#dc2626';
      deleteBtn.setAttribute('aria-label', 'Delete draft');
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `;
      deleteBtn.onclick = () => {
        if (confirm('Delete this local draft?')) {
          deleteDraft(p.id);
        }
      };
    }
    
    // Assemble buttons based on draft vs repository status
    if (p.isDraft) {
      actions.appendChild(copyBtn);
      actions.appendChild(publishBtn);
      actions.appendChild(editBtn);
      actions.appendChild(copyMdBtn);
      actions.appendChild(deleteBtn);
    } else {
      if (p.variables && p.variables.length > 0) {
        actions.appendChild(copyBtn);
        actions.appendChild(shareBtn);
        actions.appendChild(resetBtn);
      } else {
        actions.appendChild(copyBtn);
        actions.appendChild(shareBtn);
      }
    }
    
    card.appendChild(actions);
    promptsGrid.appendChild(card);
  });
}

// Helper: Format variable names to title case label text
function formatVarLabel(name) {
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Compile template text with user inputs or defaults
function compilePromptText(template, cardElement) {
  let compiled = template;
  const inputs = cardElement.querySelectorAll('.variable-input');
  
  inputs.forEach(input => {
    const varName = input.dataset.varName;
    const defaultVal = input.dataset.defaultVal;
    
    let userVal = input.value.trim();
    if (userVal === '') {
      userVal = defaultVal !== undefined ? defaultVal : '';
    }
    
    // Replace all instances of {name} or {name:default}
    // Matches {varName} or {varName:anything}
    const escapedVarName = varName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('\\{' + escapedVarName + '(?::[^}]*)?\\}', 'g');
    compiled = compiled.replace(regex, userVal);
  });
  
  return compiled;
}

// Favorites management
function toggleFavorite(id, starBtn, card) {
  const index = favorites.indexOf(id);
  
  if (index > -1) {
    // Unfavorite
    favorites.splice(index, 1);
    starBtn.classList.remove('active');
    starBtn.innerHTML = '☆';
    card.classList.remove('favorited');
    showToast('Removed from favorites', 'success');
  } else {
    // Favorite
    favorites.push(id);
    starBtn.classList.add('active');
    starBtn.innerHTML = '★';
    card.classList.add('favorited');
    showToast('Added to favorites!', 'success');
  }
  
  localStorage.setItem('pv_favorites', JSON.stringify(favorites));
  
  // If active tab is favorites, re-render to update the list immediately
  if (activeCategory === 'favorites') {
    setTimeout(renderPrompts, 150); // slight delay for smooth visual transition
  }
}

// Copy to clipboard with legacy fallback
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => {
        triggerHapticFeedback();
        showToast('Prompt copied to clipboard!', 'success');
      })
      .catch(err => {
        console.error('Modern Clipboard copy failed:', err);
        fallbackCopyToClipboard(text);
      });
  } else {
    fallbackCopyToClipboard(text);
  }
}

// Legacy fallback copy (critical for mobile HTTP dev environments)
function fallbackCopyToClipboard(text) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed'; // Avoid scrolling to bottom
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      triggerHapticFeedback();
      showToast('Prompt copied to clipboard (fallback)!', 'success');
    } else {
      showToast('Copy failed. Please copy manually.', 'error');
    }
  } catch (err) {
    console.error('Fallback copy failed:', err);
    showToast('Failed to copy to clipboard.', 'error');
  }
}

// Share API Wrapper
function sharePrompt(title, text) {
  if (navigator.share) {
    navigator.share({
      title: title,
      text: text
    })
    .then(() => showToast('Prompt shared!', 'success'))
    .catch((error) => {
      // Don't show toast on AbortError (user cancelled)
      if (error.name !== 'AbortError') {
        console.error('Sharing failed:', error);
        showToast('Sharing failed.', 'error');
      }
    });
  } else {
    // Fallback: Copy to clipboard and tell the user
    copyToClipboard(text);
    showToast('Share not supported. Text copied to clipboard instead.', 'success');
  }
}

// Accidental Reset Protection
function confirmAndResetInputs(cardElement) {
  const inputs = cardElement.querySelectorAll('.variable-input');
  let hasTypedText = false;
  
  inputs.forEach(input => {
    const defaultVal = input.dataset.defaultVal || '';
    if (input.value.trim() !== defaultVal.trim()) {
      hasTypedText = true;
    }
  });
  
  if (hasTypedText) {
    if (confirm('Clear your custom input values?')) {
      resetInputs(inputs);
    }
  } else {
    resetInputs(inputs);
  }
}

function resetInputs(inputs) {
  inputs.forEach(input => {
    input.value = input.dataset.defaultVal || '';
  });
  showToast('Inputs cleared', 'success');
}

// Haptic Vibration Feedback
function triggerHapticFeedback() {
  if (hapticsEnabled && 'vibrate' in navigator) {
    try {
      navigator.vibrate(50);
    } catch (e) {
      console.warn('Vibration API blocked or failed:', e);
    }
  }
}

// Delete Local Draft
function deleteDraft(id) {
  drafts = drafts.filter(d => d.id !== id);
  localStorage.setItem('pv_drafts', JSON.stringify(drafts));
  renderCategories();
  renderPrompts();
}

// Open Draft Edit Modal
function openEditDraftModal(prompt) {
  editingDraftId = prompt.id;
  
  // Set modal header and submit button text
  document.querySelector('#draft-modal h2').textContent = 'Edit Prompt Draft';
  document.querySelector('#draft-modal button[type="submit"]').textContent = 'Save Changes';
  
  // Prefill values
  document.getElementById('draft-title').value = prompt.title;
  document.getElementById('draft-desc').value = prompt.description;
  document.getElementById('draft-cat').value = prompt.category;
  document.getElementById('draft-tags').value = prompt.tags ? prompt.tags.join(', ') : '';
  document.getElementById('draft-prompt').value = prompt.prompt;
  
  draftModal.classList.remove('hidden');
}

// Extract variables from prompt text
function extractVariables(promptText) {
  const variableRegex = /\{([a-zA-Z0-9_-]+)(?::([^}]+))?\}/g;
  const variablesMap = new Map();
  let match;
  
  while ((match = variableRegex.exec(promptText)) !== null) {
    const varName = match[1];
    const defaultValue = match[2] || '';
    
    if (!variablesMap.has(varName) || defaultValue !== '') {
      variablesMap.set(varName, defaultValue);
    }
  }
  
  return Array.from(variablesMap.entries()).map(([name, defVal]) => ({
    name,
    default: defVal
  }));
}

// Publish Local Draft directly to GitHub API
function publishDraftToGitHub(prompt, btnElement) {
  if (!githubToken) {
    showToast('Please configure your GitHub Access Token in Settings first!', 'error');
    settingsModal.classList.remove('hidden');
    return;
  }
  
  const originalHtml = btnElement.innerHTML;
  btnElement.innerHTML = `
    <svg class="btn-icon animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
      <line x1="12" y1="2" x2="12" y2="6"></line>
      <line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
      <line x1="2" y1="12" x2="6" y2="12"></line>
      <line x1="18" y1="12" x2="22" y2="12"></line>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
    </svg>
    Publishing...
  `;
  btnElement.disabled = true;
  
  const mdContent = `---
title: ${prompt.title}
description: ${prompt.description}
category: ${prompt.category}
tags: ${prompt.tags ? prompt.tags.join(', ') : ''}
---

${prompt.prompt}`;

  // UTF-8 safe base64 encoding
  const b64Content = btoa(unescape(encodeURIComponent(mdContent)));
  
  // Dynamic API URL matching the deployed Pages domain or defaulting locally
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/prompts/${prompt.id}.md`;
  
  fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Add prompt '${prompt.title}' via PromptVault PWA`,
      content: b64Content
    })
  })
  .then(async res => {
    if (res.status === 201 || res.status === 200) {
      showToast('Published successfully! Rebuilding site...', 'success');
      deleteDraft(prompt.id);
    } else {
      const errData = await res.json();
      throw new Error(errData.message || 'API Error');
    }
  })
  .catch(err => {
    console.error('GitHub API error:', err);
    showToast(`Publish failed: ${err.message}`, 'error');
    btnElement.innerHTML = originalHtml;
    btnElement.disabled = false;
  });
}

// Custom Toast notifications (placed at the top)
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.innerHTML = type === 'success' ? '✓' : '⚠';
  
  const text = document.createElement('span');
  text.textContent = message;
  
  toast.appendChild(icon);
  toast.appendChild(text);
  
  toastContainer.appendChild(toast);
  
  // Slide out after 2.5 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 2500);
}

// Empty state setup
function showEmptyState(title, description) {
  emptyTitle.textContent = title;
  emptyDescription.textContent = description;
  emptyState.classList.remove('hidden');
}

// Event Listeners Setup
function setupEventListeners() {
  // Category tabs click handler
  categoryTabs.addEventListener('click', (e) => {
    const target = e.target.closest('.tab-btn');
    if (!target) return;
    
    // Toggle active state
    categoryTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    target.classList.add('active');
    
    activeCategory = target.dataset.category;
    renderPrompts();
  });
  
  // Real-time search handler
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    
    if (searchQuery.length > 0) {
      searchClearBtn.classList.remove('hidden');
    } else {
      searchClearBtn.classList.add('hidden');
    }
    
    renderPrompts();
  });
  
  // Clear search bar action
  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClearBtn.classList.add('hidden');
    renderPrompts();
    searchInput.focus();
  });
  
  // Modal control
  settingsToggleBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });
  
  const closeModal = () => {
    settingsModal.classList.add('hidden');
  };
  
  settingsCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', closeModal);
  
  // Vibrate setting toggle
  vibrateCheckbox.addEventListener('change', (e) => {
    hapticsEnabled = e.target.checked;
    localStorage.setItem('pv_haptics', hapticsEnabled);
    if (hapticsEnabled) {
      triggerHapticFeedback();
    }
  });
  
  // Force fetch data sync
  syncBtn.addEventListener('click', () => {
    loadPrompts(true);
    closeModal();
  });
  
  // Copy template action
  copyTemplateBtn.addEventListener('click', () => {
    const templateMarkdown = `---
title: Prompt Title
description: Short description of the prompt.
category: Productivity
tags: tag1, tag2
---

Write your prompt template here. Use {variable} or {variable:default} for inputs.`;
    copyToClipboard(templateMarkdown);
    closeModal();
  });

  // GitHub Access Token setting events
  githubTokenInput.value = githubToken;
  githubTokenInput.addEventListener('input', (e) => {
    githubToken = e.target.value.trim();
    localStorage.setItem('pv_github_token', githubToken);
  });
  
  // Connection monitoring: auto refresh prompts when network returns
  window.addEventListener('online', () => {
    loadPrompts(true).then(() => {
      showToast('Connection restored. Prompts synced!', 'sync');
    });
  });
  
  window.addEventListener('offline', () => {
    showToast('Running in Offline Mode.', 'error');
  });

  // Draft Modal events
  addDraftBtn.addEventListener('click', () => {
    draftModal.classList.remove('hidden');
  });

  const closeDraftModal = () => {
    draftModal.classList.add('hidden');
    draftForm.reset();
    editingDraftId = null;
    document.querySelector('#draft-modal h2').textContent = 'Create Prompt Draft';
    document.querySelector('#draft-modal button[type="submit"]').textContent = 'Save Local Draft';
  };

  draftCloseBtn.addEventListener('click', closeDraftModal);
  draftOverlay.addEventListener('click', closeDraftModal);

  // Draft Creation/Edit Form submit
  draftForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('draft-title').value.trim();
    const description = document.getElementById('draft-desc').value.trim();
    const category = document.getElementById('draft-cat').value.trim() || 'General';
    const tagsInput = document.getElementById('draft-tags').value.trim();
    const prompt = document.getElementById('draft-prompt').value;

    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
    const variables = extractVariables(prompt);

    if (editingDraftId) {
      // Edit mode
      const draftIndex = drafts.findIndex(d => d.id === editingDraftId);
      if (draftIndex > -1) {
        drafts[draftIndex].title = title;
        drafts[draftIndex].description = description;
        drafts[draftIndex].category = category;
        drafts[draftIndex].tags = tags;
        drafts[draftIndex].prompt = prompt;
        drafts[draftIndex].variables = variables;
        localStorage.setItem('pv_drafts', JSON.stringify(drafts));
        showToast('Local draft updated!', 'success');
      }
    } else {
      // Creation mode
      const id = 'draft-' + Date.now();
      const newDraft = {
        id,
        title,
        description,
        category,
        tags,
        prompt,
        variables,
        isDraft: true
      };

      drafts.push(newDraft);
      localStorage.setItem('pv_drafts', JSON.stringify(drafts));
      showToast('Local draft created!', 'success');
    }

    closeDraftModal();
    renderCategories();
    renderPrompts();
  });
}

// Start App
document.addEventListener('DOMContentLoaded', init);
