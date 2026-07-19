// State Management
let prompts = [];

// Safe JSON parse helper — prevents app crash from corrupted localStorage data
function safeJsonParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`[PromptVault] Corrupted localStorage key "${key}", resetting to default.`, e);
    return fallback;
  }
}

let drafts = safeJsonParse('pv_drafts', []);
let favorites = safeJsonParse('pv_favorites', []);
let activeCategory = 'all';
let searchQuery = '';
let hapticsEnabled = localStorage.getItem('pv_haptics') !== 'false'; // default true
let newServiceWorker = null;
let editingDraftId = null; // Track draft being edited
let editingPromptIsDraft = false; // Track if currently editing draft vs repository prompt
let selectedTagsSet = new Set(); // Selected tags in prompt create/edit modal
let isFetchingPrompts = false;
let isSubmittingDraft = false;

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

let isDraftFullscreen = localStorage.getItem('pv_draft_fullscreen') === 'true'; // Track modal fullscreen state

let copyCounts = safeJsonParse('pv_copy_counts', {});
let activeSort = 'default';

// Draft UI Elements
const addDraftBtn = document.getElementById('add-draft-btn');
const draftModal = document.getElementById('draft-modal');
const draftModalContent = document.querySelector('#draft-modal .modal-content');
const draftCloseBtn = document.getElementById('draft-close-btn');
const draftDeleteBtn = document.getElementById('draft-delete-btn');
const draftExpandBtn = document.getElementById('draft-expand-btn');
const draftOverlay = document.getElementById('draft-overlay');
const draftForm = document.getElementById('draft-form');
const draftCatSelect = document.getElementById('draft-cat-select');
const draftCatCustom = document.getElementById('draft-cat-custom');
const toggleCustomCatBtn = document.getElementById('toggle-custom-cat-btn');
const selectedTagsWrapper = document.getElementById('selected-tags-wrapper');
const newTagInput = document.getElementById('new-tag-input');
const addTagBtn = document.getElementById('add-tag-btn');
const existingTagsChips = document.getElementById('existing-tags-chips');
const sortPillsContainer = document.getElementById('sort-pills');
const draftPromptTabEdit = document.getElementById('draft-prompt-tab-edit');
const draftPromptTabPreview = document.getElementById('draft-prompt-tab-preview');
const draftPromptTextarea = document.getElementById('draft-prompt');
const draftPromptPreview = document.getElementById('draft-prompt-preview');

// GitHub Token Input Element
const githubTokenInput = document.getElementById('setting-github-token');

// ─── Gemini Model Registry ──────────────────────────────────────────────────
// To add a new Google model in the future, simply append one object here.
// No other code needs to change.
const GEMINI_MODELS = [
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Most capable · best reasoning · slower · 🌐 Google Search',
    supportsSearch: true,
    isDefault: false
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Fast · balanced quality · 🌐 Google Search · recommended',
    supportsSearch: true,
    isDefault: true
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    description: 'Fastest · lowest latency · no web search · offline knowledge only',
    supportsSearch: false,
    isDefault: false
  }
];

// Gemini API Key & Model State + UI Elements
let geminiApiKey = localStorage.getItem('pv_gemini_key') || '';
const savedModelId = localStorage.getItem('pv_gemini_model');
let selectedGeminiModel = GEMINI_MODELS.find(m => m.id === savedModelId) ||
                          GEMINI_MODELS.find(m => m.isDefault) ||
                          GEMINI_MODELS[0];
const geminiKeyInput = document.getElementById('setting-gemini-key');
const geminiModelSelect = document.getElementById('setting-gemini-model');
const geminiModelDesc = document.getElementById('gemini-model-desc');
const aiRunnerModelBadge = document.getElementById('ai-runner-model-badge');
const aiRunnerModal = document.getElementById('ai-runner-modal');
const aiRunnerOverlay = document.getElementById('ai-runner-overlay');
const aiRunnerCloseBtn = document.getElementById('ai-runner-close-btn');
const aiRunnerPromptBox = document.getElementById('ai-runner-prompt-box');
const aiRunnerStatus = document.getElementById('ai-runner-status');
const aiResponseBox = document.getElementById('ai-response-box');
const copyAiResponseBtn = document.getElementById('copy-ai-response-btn');

// ─── LLM Chat Provider Registry ────────────────────────────────────────
// To add a new LLM chat provider in the future, append one object here.
// No other code needs to change.
const LLM_CHAT_PROVIDERS = [
  {
    id: 'gemini',
    label: 'Gemini',
    emoji: '✨',
    color: '#1a73e8',
    // {prompt} is replaced with the URL-encoded compiled prompt
    urlTemplate: 'https://gemini.google.com',
    copyBeforeOpen: true,
    defaultEnabled: true
  },
  {
    id: 'claude',
    label: 'Claude',
    emoji: '🟠',
    color: '#c96442',
    urlTemplate: 'https://claude.ai',
    copyBeforeOpen: true,
    defaultEnabled: true
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    emoji: '💬',
    color: '#10a37f',
    urlTemplate: 'https://chatgpt.com/?q={prompt}',
    copyBeforeOpen: false,
    defaultEnabled: false
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    emoji: '🔍',
    color: '#20b2aa',
    urlTemplate: 'https://www.perplexity.ai/search?q={prompt}',
    copyBeforeOpen: false,
    defaultEnabled: false
  }
];

// Load persisted provider visibility; fall back to defaultEnabled per provider
// Use safeJsonParse to prevent a corrupted key from crashing app startup
const _savedProviders = safeJsonParse('pv_chat_providers', null);
const enabledChatProviders = {};
LLM_CHAT_PROVIDERS.forEach(p => {
  enabledChatProviders[p.id] = _savedProviders
    ? (_savedProviders[p.id] !== undefined ? _savedProviders[p.id] : p.defaultEnabled)
    : p.defaultEnabled;
});

const chatProvidersListEl = document.getElementById('chat-providers-list');

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
  if (isFetchingPrompts) return;
  isFetchingPrompts = true;
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
      emptyActionBtn.classList.add('hidden');
    }
  } finally {
    isFetchingPrompts = false;
  }
}

// Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Service Worker registered with scope:', reg.scope);
        
        // Force explicit update check on launch
        reg.update();

        // Re-check for updates whenever user switches back to the app
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update();
          }
        });

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
    // Reload page once new worker is activated — { once: true } prevents listener accumulation
    // if the user clicks "Update Now" multiple times before the controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });
  }
});

// Category Rendering
function renderCategories() {
  // Extract unique categories from prompts + local drafts
  const allPrompts = [...prompts, ...drafts];
  const categories = [...new Set(allPrompts.map(p => p.category))].filter(Boolean);
  
  // Sync active state for static tabs
  const allTab = categoryTabs.querySelector('[data-category="all"]');
  const favTab = categoryTabs.querySelector('[data-category="favorites"]');
  if (allTab) {
    if (activeCategory === 'all') allTab.classList.add('active');
    else allTab.classList.remove('active');
  }
  if (favTab) {
    if (activeCategory === 'favorites') favTab.classList.add('active');
    else favTab.classList.remove('active');
  }

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
    if (activeCategory === cat.toLowerCase()) {
      btn.classList.add('active');
    }
    categoryTabs.appendChild(btn);
  });
}

// Prompt Filtering and Rendering
function renderPrompts() {
  promptsGrid.innerHTML = '';
  
  const allPrompts = [...prompts, ...drafts];
  let filtered = allPrompts.filter(p => {
    if (!p) return false;
    // Category filter
    if (activeCategory === 'favorites') {
      return favorites.includes(p.id);
    } else if (activeCategory !== 'all') {
      const pCat = p.category ? String(p.category).toLowerCase() : 'general';
      return pCat === activeCategory;
    }
    return true;
  });
  
  // Search query filter
  if (searchQuery.trim().length > 0) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => {
      if (!p) return false;
      const matchTitle = p.title ? String(p.title).toLowerCase().includes(query) : false;
      const matchDesc = p.description ? String(p.description).toLowerCase().includes(query) : false;
      const matchTags = p.tags && Array.isArray(p.tags) && p.tags.some(tag => tag ? String(tag).toLowerCase().includes(query) : false);
      return matchTitle || matchDesc || matchTags;
    });
  }

  // Apply sorting
  if (activeSort === 'most-copied') {
    filtered.sort((a, b) => (copyCounts[b.id] || 0) - (copyCounts[a.id] || 0));
  } else if (activeSort === 'alphabetical') {
    filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }
  
  if (filtered.length === 0) {
    if (activeCategory === 'favorites') {
      showEmptyState('No favorites yet', 'Tap the star icon on any prompt card to add it to your favorites list.');
      emptyActionBtn.classList.add('hidden');
    } else if (searchQuery.trim().length > 0) {
      // There is an active search query — offer to clear it
      showEmptyState('No prompts found', 'Try adjusting your search keywords or view another category.');
      emptyActionBtn.classList.remove('hidden');
      emptyActionBtn.textContent = 'Clear Search';
      emptyActionBtn.onclick = () => {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.classList.add('hidden');
        renderPrompts();
      };
    } else {
      // No search, no results (e.g. empty category) — offer to go back to All
      showEmptyState('No prompts found', 'Try viewing another category or sync from GitHub.');
      emptyActionBtn.classList.remove('hidden');
      emptyActionBtn.textContent = 'View All Prompts';
      emptyActionBtn.onclick = () => {
        activeCategory = 'all';
        categoryTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const allTab = categoryTabs.querySelector('[data-category="all"]');
        if (allTab) allTab.classList.add('active');
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
    
    const catText = document.createElement('span');
    catText.textContent = p.category;
    cat.appendChild(catText);
    
    const title = document.createElement('h2');
    title.className = 'card-title';
    title.textContent = p.title;
    
    if (p.isDraft) {
      const badge = document.createElement('span');
      badge.className = 'draft-badge';
      badge.textContent = 'Draft';
      title.appendChild(badge);
    }

    if (p.id && copyCounts[p.id]) {
      const copyBadge = document.createElement('span');
      copyBadge.className = 'copy-count-badge';
      copyBadge.textContent = `📋 ${copyCounts[p.id]}`;
      title.appendChild(copyBadge);
    }
    
    const desc = document.createElement('p');
    desc.className = 'card-description';
    desc.textContent = p.description;
    
    // Code block preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'card-prompt-preview';
    
    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'prompt-body-wrapper';

    // View toggle button (Code vs Formatted Markdown)
    const viewToggleBtn = document.createElement('button');
    viewToggleBtn.className = 'view-toggle-btn';
    viewToggleBtn.textContent = 'Preview';
    
    let isShowingMarkdown = false;
    viewToggleBtn.onclick = (e) => {
      e.stopPropagation();
      isShowingMarkdown = !isShowingMarkdown;
      if (isShowingMarkdown) {
        viewToggleBtn.textContent = 'Code';
        bodyWrapper.innerHTML = `<div class="markdown-preview">${renderMarkdown(p.prompt)}</div>`;
      } else {
        viewToggleBtn.textContent = 'Preview';
        bodyWrapper.innerHTML = '';
        const code = document.createElement('code');
        code.textContent = p.prompt;
        bodyWrapper.appendChild(code);
      }
    };
    cat.appendChild(viewToggleBtn);
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
      incrementCopyCount(p.id);
      const finalPrompt = compilePromptText(p.prompt, card);
      copyToClipboard(finalPrompt);
      // Update the copy count badge in-place — avoids full re-render that would destroy variable inputs
      // Read count AFTER incrementCopyCount so the badge reflects the new value
      const count = copyCounts[p.id] || 0;
      let badge = card.querySelector('.copy-count-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'copy-count-badge';
        card.querySelector('.card-title').appendChild(badge);
      }
      badge.textContent = `📋 ${count}`;
    };

    // Duplicate Action
    const dupBtn = document.createElement('button');
    dupBtn.className = 'btn btn-outline btn-icon-only';
    dupBtn.setAttribute('aria-label', 'Duplicate prompt');
    dupBtn.title = 'Duplicate Prompt';
    dupBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    dupBtn.onclick = () => {
      duplicatePrompt(p);
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
     // Edit Action (Pencil Icon) - available on all cards
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-outline btn-icon-only';
    editBtn.setAttribute('aria-label', 'Edit prompt');
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editBtn.onclick = () => {
      openEditDraftModal(p);
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
    
    // Run AI Action (100% Inside App Gemini Runner)
    const runAiBtn = document.createElement('button');
    runAiBtn.className = 'btn btn-outline btn-ai-run';
    runAiBtn.innerHTML = `⚡ Run AI`;
    runAiBtn.onclick = () => {
      const compiledPrompt = compilePromptText(p.prompt, card);
      runPromptWithGemini(compiledPrompt);
    };

    // LLM Chat Buttons — rendered dynamically from enabled providers in registry
    const chatBtns = LLM_CHAT_PROVIDERS
      .filter(provider => enabledChatProviders[provider.id])
      .map(provider => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline btn-llm-chat';
        btn.style.setProperty('--llm-color', provider.color);
        btn.innerHTML = `${provider.emoji} ${provider.label}`;
        btn.title = `Open ${provider.label} with this prompt`;
        btn.onclick = () => {
          const compiledPrompt = compilePromptText(p.prompt, card);
          launchLLMChat(provider, compiledPrompt);
        };
        return btn;
      });

    // Assemble buttons based on draft vs repository status
    if (p.isDraft) {
      actions.appendChild(copyBtn);
      actions.appendChild(runAiBtn);
      chatBtns.forEach(b => actions.appendChild(b));
      actions.appendChild(publishBtn);
      actions.appendChild(editBtn);
      actions.appendChild(dupBtn);
      actions.appendChild(copyMdBtn);
      actions.appendChild(deleteBtn);
    } else {
      actions.appendChild(copyBtn);
      actions.appendChild(runAiBtn);
      chatBtns.forEach(b => actions.appendChild(b));
      actions.appendChild(editBtn);
      actions.appendChild(dupBtn);
      actions.appendChild(shareBtn);
      if (p.variables && p.variables.length > 0) {
        actions.appendChild(resetBtn);
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
    compiled = compiled.replace(regex, () => userVal);
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

// Close Draft Creation/Edit Modal & Reset All State
function closeDraftModal() {
  draftModal.classList.add('hidden');
  draftForm.reset();
  editingDraftId = null;
  editingPromptIsDraft = false;
  selectedTagsSet.clear();
  if (draftCatCustom) {
    draftCatCustom.classList.add('hidden');
    draftCatCustom.value = '';
  }
  if (toggleCustomCatBtn) {
    toggleCustomCatBtn.textContent = '+ New Category';
  }
  if (draftDeleteBtn) {
    draftDeleteBtn.classList.add('hidden');
    draftDeleteBtn.onclick = null;
  }
  if (draftPromptTabEdit && draftPromptTabPreview && draftPromptTextarea && draftPromptPreview) {
    draftPromptTabEdit.classList.add('active');
    draftPromptTabPreview.classList.remove('active');
    draftPromptTextarea.classList.remove('hidden');
    draftPromptPreview.classList.add('hidden');
  }
  document.querySelector('#draft-modal h2').textContent = 'Create Prompt Draft';
  document.querySelector('#draft-modal button[type="submit"]').textContent = 'Save Local Draft';
}

// Extract unique categories from loaded prompts + local drafts
function getAllCategories() {
  const allPrompts = [...prompts, ...drafts];
  const cats = [...new Set(allPrompts.map(p => p.category))].filter(Boolean);
  if (cats.length === 0) return ['General'];
  return cats;
}

// Extract unique normalized (lowercased) tags from loaded prompts + local drafts
function getAllTags() {
  const allPrompts = [...prompts, ...drafts];
  const tagSet = new Set();
  allPrompts.forEach(p => {
    if (p.tags && Array.isArray(p.tags)) {
      p.tags.forEach(t => {
        if (t && typeof t === 'string') {
          const norm = t.trim().toLowerCase();
          if (norm) tagSet.add(norm);
        }
      });
    }
  });
  return Array.from(tagSet).sort();
}

// Populate Category Select Dropdown & custom input
function populateCategorySelect(selectedCategory = '') {
  if (!draftCatSelect) return;
  draftCatSelect.innerHTML = '';
  const categories = getAllCategories();

  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    draftCatSelect.appendChild(opt);
  });

  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = '+ Add New Category';
  draftCatSelect.appendChild(customOpt);

  if (selectedCategory && categories.includes(selectedCategory)) {
    draftCatSelect.value = selectedCategory;
    draftCatCustom.classList.add('hidden');
    draftCatCustom.value = '';
    if (toggleCustomCatBtn) toggleCustomCatBtn.textContent = '+ New Category';
  } else if (selectedCategory && selectedCategory.trim()) {
    draftCatSelect.value = '__custom__';
    draftCatCustom.value = selectedCategory;
    draftCatCustom.classList.remove('hidden');
    if (toggleCustomCatBtn) toggleCustomCatBtn.textContent = 'Cancel';
  } else {
    draftCatSelect.value = categories[0] || 'General';
    draftCatCustom.classList.add('hidden');
    draftCatCustom.value = '';
    if (toggleCustomCatBtn) toggleCustomCatBtn.textContent = '+ New Category';
  }
}

// Tag Picker Component Renderer & Interaction Manager
function renderTagPicker(currentPromptTags = null) {
  if (!selectedTagsWrapper || !existingTagsChips) return;

  if (currentPromptTags !== null) {
    selectedTagsSet = new Set(
      currentPromptTags
        .map(t => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
        .filter(Boolean)
    );
  }

  // 1. Render selected tags wrapper
  selectedTagsWrapper.innerHTML = '';
  if (selectedTagsSet.size === 0) {
    const placeholder = document.createElement('span');
    placeholder.className = 'selected-tags-placeholder';
    placeholder.textContent = 'No tags selected yet (click existing tags below or type a new one)';
    selectedTagsWrapper.appendChild(placeholder);
  } else {
    Array.from(selectedTagsSet).forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip active';
      chip.textContent = tag;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tag-chip-remove';
      removeBtn.innerHTML = '×';
      removeBtn.setAttribute('aria-label', `Remove tag ${tag}`);
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        selectedTagsSet.delete(tag);
        renderTagPicker();
      };

      chip.appendChild(removeBtn);
      selectedTagsWrapper.appendChild(chip);
    });
  }

  // 2. Render available existing tags chips
  existingTagsChips.innerHTML = '';
  const allTags = getAllTags();
  const combinedTags = Array.from(new Set([...allTags, ...Array.from(selectedTagsSet)])).sort();

  if (combinedTags.length === 0) {
    const noTagsMsg = document.createElement('span');
    noTagsMsg.style.fontSize = '12px';
    noTagsMsg.style.color = 'var(--text-muted)';
    noTagsMsg.textContent = 'No existing tags found. Type above to add one!';
    existingTagsChips.appendChild(noTagsMsg);
  } else {
    combinedTags.forEach(tag => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `tag-chip ${selectedTagsSet.has(tag) ? 'active' : ''}`;
      chip.textContent = tag;
      chip.onclick = () => {
        if (selectedTagsSet.has(tag)) {
          selectedTagsSet.delete(tag);
        } else {
          selectedTagsSet.add(tag);
        }
        renderTagPicker();
      };
      existingTagsChips.appendChild(chip);
    });
  }
}

// Add New Tag Handler
function handleAddNewTag(showEmptyWarning = false) {
  if (!newTagInput) return;
  const inputVal = newTagInput.value.trim().toLowerCase();
  if (!inputVal) {
    if (showEmptyWarning) {
      showToast('Please type a tag name before clicking + Add!', 'error');
    }
    return;
  }

  const tagsToAdd = inputVal.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  let addedCount = 0;
  tagsToAdd.forEach(t => {
    if (!selectedTagsSet.has(t)) {
      selectedTagsSet.add(t);
      addedCount++;
    }
  });

  newTagInput.value = '';
  renderTagPicker();
  newTagInput.focus();

  if (addedCount > 0) {
    showToast(`Added tag${addedCount > 1 ? 's' : ''}: ${tagsToAdd.join(', ')}`, 'success');
  } else {
    showToast('Tag is already added!', 'error');
  }
}

// Delete a published repository prompt directly via GitHub API
function deleteRepoPromptFromGitHub(id, title, deleteBtn) {
  if (!githubToken) {
    showToast('Please configure your GitHub Access Token in Settings first!', 'error');
    settingsModal.classList.remove('hidden');
    return;
  }

  const originalHtml = deleteBtn.innerHTML;
  deleteBtn.innerHTML = `
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
  `;
  deleteBtn.disabled = true;

  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/prompts/${id}.md`;
  const headers = {
    'Authorization': `token ${githubToken}`,
    'Accept': 'application/vnd.github+json'
  };

  // Step 1: Query SHA first
  fetch(url, { headers })
  .then(async res => {
    if (res.status === 200) {
      const data = await res.json();
      return data.sha;
    } else {
      const err = await res.json();
      throw new Error(err.message || 'Could not find file on GitHub');
    }
  })
  .then(sha => {
    // Step 2: Send DELETE request
    return fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Delete prompt '${title}' via PromptVault PWA`,
        sha: sha
      })
    });
  })
  .then(async res => {
    if (res.status === 200 || res.status === 204) {
      showToast('Prompt deleted from GitHub!', 'success');
      prompts = prompts.filter(p => p.id !== id);
      closeDraftModal();
      renderCategories();
      renderPrompts();
    } else {
      const err = await res.json();
      throw new Error(err.message || 'Failed deleting prompt file');
    }
  })
  .catch(err => {
    console.error('Delete prompt error:', err);
    showToast(`Delete failed: ${err.message}`, 'error');
    deleteBtn.innerHTML = originalHtml;
    deleteBtn.disabled = false;
  });
}

// Dynamic Fullscreen UI Updater
function updateFullscreenUI() {
  if (!draftModalContent || !draftExpandBtn) return;
  if (isDraftFullscreen) {
    draftModalContent.classList.add('fullscreen');
    draftExpandBtn.setAttribute('title', 'Minimize to dialog box');
    draftExpandBtn.setAttribute('aria-label', 'Minimize Fullscreen');
    draftExpandBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20"></polyline>
        <polyline points="20 10 14 10 14 4"></polyline>
        <line x1="14" y1="10" x2="21" y2="3"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
    `;
  } else {
    draftModalContent.classList.remove('fullscreen');
    draftExpandBtn.setAttribute('title', 'Expand to Fullscreen');
    draftExpandBtn.setAttribute('aria-label', 'Expand to Fullscreen');
    draftExpandBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9"></polyline>
        <polyline points="9 21 3 21 3 15"></polyline>
        <line x1="21" y1="3" x2="14" y2="10"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
    `;
  }
}

// Client-side Markdown Renderer
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (triple backticks)
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers (# H1, ## H2, ### H3)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Bullet lists (* or -)
  html = html.replace(/^\s*[\*\-] (.*$)/gim, '<li>$1</li>');
  // Wrap consecutive <li> groups in <ul> — use gm flags (no dotAll) to avoid greedy across-block capture
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\s*<li>[\s\S]*?<\/li>)*/g, '<ul>$&</ul>');

  // Line breaks: only on non-block lines
  // Split on <pre>...</pre> blocks so newlines inside code blocks are preserved as-is
  const parts = html.split(/(<pre>[\s\S]*?<\/pre>)/g);
  html = parts.map((part, i) => {
    if (i % 2 === 1) return part; // odd index = inside a <pre> block, leave untouched
    // Replace newlines not immediately following a block-level closing tag
    return part.replace(/\n(?!<\/(h[1-6]|ul|li|pre|blockquote)>)/g, '<br>');
  }).join('');

  return html;
}

// Duplicate / Clone Prompt into a new Draft
function duplicatePrompt(prompt) {
  const clonedPrompt = {
    id: null,
    title: `Copy of ${prompt.title}`,
    description: prompt.description,
    category: prompt.category,
    tags: prompt.tags ? [...prompt.tags] : [],
    prompt: prompt.prompt,
    isDraft: true
  };
  openEditDraftModal(clonedPrompt);
}

// Increment Copy Count for a prompt
function incrementCopyCount(id) {
  if (!id) return;
  copyCounts[id] = (copyCounts[id] || 0) + 1;
  localStorage.setItem('pv_copy_counts', JSON.stringify(copyCounts));
}

// Web Chat Launchers
// Generic LLM Chat Launcher — works for any provider in LLM_CHAT_PROVIDERS
function launchLLMChat(provider, compiledPrompt) {
  const encoded = encodeURIComponent(compiledPrompt);
  const url = provider.urlTemplate.replace('{prompt}', encoded);
  if (provider.copyBeforeOpen) {
    copyToClipboard(compiledPrompt);
    showToast(`Prompt copied! Opening ${provider.label}...`, 'success');
  } else {
    showToast(`Opening ${provider.label}...`, 'info');
  }
  setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), 300);
}

// 100% Inside-App Free Gemini AI Execution Runner
function runPromptWithGemini(compiledPrompt) {
  if (!geminiApiKey) {
    showToast('Please configure your Gemini API Key in Settings first!', 'error');
    settingsModal.classList.remove('hidden');
    return;
  }

  const model = selectedGeminiModel;

  // Update modal badge to reflect the active model
  if (aiRunnerModelBadge) aiRunnerModelBadge.textContent = model.label;

  aiRunnerPromptBox.textContent = compiledPrompt;
  const searchNote = model.supportsSearch ? ' · 🌐 Google Search' : '';
  aiRunnerStatus.innerHTML = `
    <svg class="btn-icon animate-spin" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
      <line x1="12" y1="2" x2="12" y2="6"></line>
      <line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
      <line x1="2" y1="12" x2="6" y2="12"></line>
      <line x1="18" y1="12" x2="22" y2="12"></line>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
    </svg>
    <span>Generating with ${model.label}${searchNote}...</span>
  `;
  aiResponseBox.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Thinking...</span>';
  copyAiResponseBtn.disabled = true;

  aiRunnerModal.classList.remove('hidden');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiApiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: compiledPrompt }]
      }],
      ...(model.supportsSearch ? { tools: [{ google_search: {} }] } : {})
    })
  })
  .then(async res => {
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ? err.error.message : 'API Request Failed');
    }
    return res.json();
  })
  .then(data => {
    // Grounded responses can be split across multiple parts — join them all
    const parts = data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts;
    const text = parts ? parts.map(p => p.text || '').join('') : '';

    if (!text) {
      throw new Error('No text generated in response');
    }

    const isGrounded = data.candidates[0].groundingMetadata &&
      data.candidates[0].groundingMetadata.webSearchQueries &&
      data.candidates[0].groundingMetadata.webSearchQueries.length > 0;
    const groundedLabel = isGrounded ? ' · <span title="Response grounded with live Google Search">🌐 Web</span>' : '';

    aiRunnerStatus.innerHTML = `<span style="color: #1a7f37;">✓ Generated with ${model.label}${groundedLabel}</span>`;
    aiResponseBox.innerHTML = renderMarkdown(text);
    copyAiResponseBtn.disabled = false;
    copyAiResponseBtn.onclick = () => {
      copyToClipboard(text);
      showToast('AI response copied to clipboard!', 'success');
    };
  })
  .catch(err => {
    console.error('Gemini API Error:', err);
    aiRunnerStatus.innerHTML = '';
    const errSpan = document.createElement('span');
    errSpan.style.color = '#dc2626';
    errSpan.textContent = `⚠ Generation failed: ${err.message}`;
    aiRunnerStatus.appendChild(errSpan);
    aiResponseBox.innerHTML = `<div style="color: #dc2626; padding: 8px;">Error generating AI response. Please check your Gemini API Key in Settings.</div>`;
  });
}

// Open Draft Edit Modal
function openEditDraftModal(prompt) {
  editingDraftId = prompt.id;
  editingPromptIsDraft = prompt.isDraft === true;
  
  // id===null means this is a brand-new duplicate (creation mode), not an edit
  const isCreationMode = !prompt.id;
  const isRepoEdit = !editingPromptIsDraft && !isCreationMode;
  
  // Set modal header and submit button text
  if (isCreationMode) {
    document.querySelector('#draft-modal h2').textContent = 'Create Prompt Draft';
    document.querySelector('#draft-modal button[type="submit"]').textContent = 'Save Local Draft';
  } else {
    document.querySelector('#draft-modal h2').textContent = isRepoEdit ? 'Edit Published Prompt' : 'Edit Prompt Draft';
    document.querySelector('#draft-modal button[type="submit"]').textContent = isRepoEdit ? 'Publish Updates' : 'Save Changes';
  }
  
  // Prefill values
  document.getElementById('draft-title').value = prompt.title;
  document.getElementById('draft-desc').value = prompt.description;
  populateCategorySelect(prompt.category);
  renderTagPicker(prompt.tags || []);
  document.getElementById('draft-prompt').value = prompt.prompt;

  // Show top-left delete icon & attach deletion event (only when editing an existing prompt)
  if (draftDeleteBtn) {
    if (isCreationMode) {
      // Hide delete for brand-new / duplicate prompts — there's nothing to delete yet
      draftDeleteBtn.classList.add('hidden');
      draftDeleteBtn.onclick = null;
    } else {
      draftDeleteBtn.classList.remove('hidden');
      draftDeleteBtn.onclick = () => {
        const confirmMsg = prompt.isDraft 
          ? `Delete local draft '${prompt.title}'?` 
          : `Are you sure you want to delete '${prompt.title}' from GitHub?`;
        
        if (confirm(confirmMsg)) {
          if (prompt.isDraft) {
            deleteDraft(prompt.id);
            closeDraftModal();
            showToast('Local draft deleted!', 'success');
          } else {
            deleteRepoPromptFromGitHub(prompt.id, prompt.title, draftDeleteBtn);
          }
        }
      };
    }
  }
  
  updateFullscreenUI();
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

// Helper: Slugify text for clean filenames
function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

// Publish Local Draft directly to GitHub API
function publishDraftToGitHub(prompt, btnElement) {
  if (btnElement.disabled) return;
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
  
  const safeTitle = slugify(prompt.title) || 'prompt';
  const repoId = `${safeTitle}-${Date.now().toString().slice(-6)}`;
  
  // Dynamic API URL matching the deployed Pages domain or defaulting locally
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/prompts/${repoId}.md`;
  
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
      const publishedPrompt = { ...prompt, id: repoId, isDraft: false };
      prompts.unshift(publishedPrompt);
      deleteDraft(prompt.id);
      closeDraftModal(); // Fix 7: close modal after publish, consistent with publishRepoUpdateToGitHub
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

// Publish modifications to GitHub for an already published prompt
async function publishRepoUpdateToGitHub(id, title, description, category, tags, promptText, submitBtn) {
  if (!githubToken) {
    showToast('Please configure your GitHub Access Token in Settings first!', 'error');
    settingsModal.classList.remove('hidden');
    return;
  }

  const originalHtml = submitBtn.innerHTML;
  submitBtn.innerHTML = `
    <svg class="btn-icon animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite; margin-right: 6px;">
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
  submitBtn.disabled = true;

  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/prompts/${id}.md`;
  const headers = {
    'Authorization': `token ${githubToken}`,
    'Accept': 'application/vnd.github+json'
  };

  // Step 1: Query SHA first
  return fetch(url, { headers })
  .then(async res => {
    if (res.status === 200) {
      const data = await res.json();
      return data.sha;
    } else if (res.status === 404) {
      return null;
    } else {
      const err = await res.json();
      throw new Error(err.message || 'Failed fetching file details');
    }
  })
  .then(sha => {
    // Step 2: Overwrite content via PUT
    const mdContent = `---
title: ${title}
description: ${description}
category: ${category}
tags: ${tags ? tags.join(', ') : ''}
---

${promptText}`;

    const b64Content = btoa(unescape(encodeURIComponent(mdContent)));
    const body = {
      message: `Update prompt '${title}' via PromptVault PWA`,
      content: b64Content
    };
    if (sha) {
      body.sha = sha;
    }

    return fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  })
  .then(async res => {
    if (res.status === 200 || res.status === 201) {
      showToast('Updates published to GitHub!', 'success');
      
      // Step 3: Optimistic Update (Update local memory so changes display instantly)
      const promptIndex = prompts.findIndex(pr => pr.id === id);
      if (promptIndex > -1) {
        prompts[promptIndex].title = title;
        prompts[promptIndex].description = description;
        prompts[promptIndex].category = category;
        prompts[promptIndex].tags = tags;
        prompts[promptIndex].prompt = promptText;
        prompts[promptIndex].variables = extractVariables(promptText);
      }
      
      closeDraftModal();
      activeCategory = category.toLowerCase();
      renderCategories();
      renderPrompts();
    } else {
      const err = await res.json();
      throw new Error(err.message || 'Error updating prompt file');
    }
  })
  .catch(err => {
    console.error('Publish update error:', err);
    showToast(`Update failed: ${err.message}`, 'error');
    submitBtn.innerHTML = originalHtml;
    submitBtn.disabled = false;
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

  // Purge Cache & Load Newest Version action
  const purgeCacheBtn = document.getElementById('purge-cache-btn');
  if (purgeCacheBtn) {
    purgeCacheBtn.addEventListener('click', async () => {
      showToast('Clearing cache and loading newest version...', 'success');
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let reg of registrations) {
          await reg.unregister();
        }
      }
      setTimeout(() => {
        window.location.reload();
      }, 500);
    });
  }

  // GitHub Access Token setting events
  githubTokenInput.value = githubToken;
  githubTokenInput.addEventListener('input', (e) => {
    githubToken = e.target.value.trim();
    localStorage.setItem('pv_github_token', githubToken);
  });

  // Gemini API Key setting events
  if (geminiKeyInput) {
    geminiKeyInput.value = geminiApiKey;
    geminiKeyInput.addEventListener('input', (e) => {
      geminiApiKey = e.target.value.trim();
      localStorage.setItem('pv_gemini_key', geminiApiKey);
    });
  }

  // Gemini Model selector — populate from registry & wire up persistence
  if (geminiModelSelect) {
    // Build <option> elements from the central registry
    GEMINI_MODELS.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      if (m.id === selectedGeminiModel.id) opt.selected = true;
      geminiModelSelect.appendChild(opt);
    });

    // Show the description of the currently selected model
    if (geminiModelDesc) {
      geminiModelDesc.textContent = selectedGeminiModel.description;
    }

    geminiModelSelect.addEventListener('change', (e) => {
      const chosen = GEMINI_MODELS.find(m => m.id === e.target.value);
      if (!chosen) return;
      selectedGeminiModel = chosen;
      localStorage.setItem('pv_gemini_model', chosen.id);
      if (geminiModelDesc) geminiModelDesc.textContent = chosen.description;
      if (aiRunnerModelBadge) aiRunnerModelBadge.textContent = chosen.label;
      showToast(`Model set to ${chosen.label}`, 'success');
    });
  }

  // LLM Chat Provider toggles — rendered from registry into #chat-providers-list
  if (chatProvidersListEl) {
    function renderChatProviderToggles() {
      chatProvidersListEl.innerHTML = '';
      LLM_CHAT_PROVIDERS.forEach(provider => {
        const row = document.createElement('div');
        row.className = 'chat-provider-row';

        const left = document.createElement('div');
        left.className = 'chat-provider-info';
        left.innerHTML = `
          <span class="chat-provider-emoji">${provider.emoji}</span>
          <div>
            <span class="chat-provider-name">${provider.label}</span>
            <span class="chat-provider-url">${provider.urlTemplate.replace('{prompt}', '…')}</span>
          </div>`;

        const toggle = document.createElement('label');
        toggle.className = 'switch-label';
        toggle.style.minWidth = '44px';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = enabledChatProviders[provider.id];
        checkbox.addEventListener('change', () => {
          enabledChatProviders[provider.id] = checkbox.checked;
          localStorage.setItem('pv_chat_providers', JSON.stringify(enabledChatProviders));
          renderPrompts();
          showToast(`${provider.label} ${checkbox.checked ? 'enabled' : 'hidden'}`, 'success');
        });
        const slider = document.createElement('span');
        slider.className = 'slider';
        toggle.appendChild(checkbox);
        toggle.appendChild(slider);

        row.appendChild(left);
        row.appendChild(toggle);
        chatProvidersListEl.appendChild(row);
      });
    }
    renderChatProviderToggles();
  }

  // AI Runner Modal Controls
  if (aiRunnerCloseBtn && aiRunnerOverlay && aiRunnerModal) {
    const closeAiRunnerModal = () => {
      aiRunnerModal.classList.add('hidden');
    };
    aiRunnerCloseBtn.addEventListener('click', closeAiRunnerModal);
    aiRunnerOverlay.addEventListener('click', closeAiRunnerModal);
  }
  
  // Connection monitoring: auto refresh prompts when network returns
  window.addEventListener('online', () => {
    showToast('Connection restored. Syncing prompts...', 'info');
    loadPrompts(true);
  });
  
  window.addEventListener('offline', () => {
    showToast('Running in Offline Mode.', 'error');

  });

  // Draft Modal events
  addDraftBtn.addEventListener('click', () => {
    editingDraftId = null;
    editingPromptIsDraft = true;
    selectedTagsSet.clear();
    draftForm.reset();
    populateCategorySelect('');
    renderTagPicker([]);
    if (draftDeleteBtn) {
      draftDeleteBtn.classList.add('hidden');
      draftDeleteBtn.onclick = null;
    }
    updateFullscreenUI();
    document.querySelector('#draft-modal h2').textContent = 'Create Prompt Draft';
    document.querySelector('#draft-modal button[type="submit"]').textContent = 'Save Local Draft';
    draftModal.classList.remove('hidden');
  });

  if (draftExpandBtn) {
    draftExpandBtn.addEventListener('click', () => {
      isDraftFullscreen = !isDraftFullscreen;
      localStorage.setItem('pv_draft_fullscreen', isDraftFullscreen);
      updateFullscreenUI();
    });
  }

  draftCloseBtn.addEventListener('click', closeDraftModal);
  draftOverlay.addEventListener('click', closeDraftModal);

  // Sort Pills Event Listener
  if (sortPillsContainer) {
    sortPillsContainer.addEventListener('click', (e) => {
      const target = e.target.closest('.sort-pill');
      if (!target) return;

      sortPillsContainer.querySelectorAll('.sort-pill').forEach(btn => btn.classList.remove('active'));
      target.classList.add('active');

      activeSort = target.dataset.sort;
      renderPrompts();
    });
  }

  // Modal Prompt Tab Toggle (Edit Code vs Preview Markdown)
  if (draftPromptTabEdit && draftPromptTabPreview && draftPromptTextarea && draftPromptPreview) {
    draftPromptTabEdit.addEventListener('click', () => {
      draftPromptTabEdit.classList.add('active');
      draftPromptTabPreview.classList.remove('active');
      draftPromptTextarea.classList.remove('hidden');
      draftPromptPreview.classList.add('hidden');
    });

    draftPromptTabPreview.addEventListener('click', () => {
      draftPromptTabPreview.classList.add('active');
      draftPromptTabEdit.classList.remove('active');
      draftPromptTextarea.classList.add('hidden');
      draftPromptPreview.classList.remove('hidden');
      draftPromptPreview.innerHTML = renderMarkdown(draftPromptTextarea.value);
    });
  }

  // Dynamic Category Select Toggle
  if (draftCatSelect) {
    draftCatSelect.addEventListener('change', (e) => {
      if (e.target.value === '__custom__') {
        draftCatCustom.classList.remove('hidden');
        draftCatCustom.focus();
        if (toggleCustomCatBtn) toggleCustomCatBtn.textContent = 'Cancel';
      } else {
        draftCatCustom.classList.add('hidden');
        draftCatCustom.value = '';
        if (toggleCustomCatBtn) toggleCustomCatBtn.textContent = '+ New Category';
      }
    });
  }

  if (toggleCustomCatBtn) {
    toggleCustomCatBtn.addEventListener('click', () => {
      const isHidden = draftCatCustom.classList.contains('hidden');
      if (isHidden) {
        draftCatCustom.classList.remove('hidden');
        draftCatSelect.value = '__custom__';
        draftCatCustom.focus();
        toggleCustomCatBtn.textContent = 'Cancel';
      } else {
        draftCatCustom.classList.add('hidden');
        draftCatCustom.value = '';
        const categories = getAllCategories();
        draftCatSelect.value = categories[0] || 'General';
        toggleCustomCatBtn.textContent = '+ New Category';
      }
    });
  }

  // Tag Picker Event Listeners
  if (addTagBtn) {
    addTagBtn.addEventListener('click', () => handleAddNewTag(true));
  }
  if (newTagInput) {
    newTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddNewTag(true);
      }
    });
  }

  // Draft Creation/Edit Form submit
  draftForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmittingDraft) return;
    isSubmittingDraft = true;

    try {
      const title = document.getElementById('draft-title').value.trim();
      const description = document.getElementById('draft-desc').value.trim();

      // Fix 2: Validate blank/whitespace-only title
      if (!title) {
        showToast('Title cannot be blank.', 'error');
        return;
      }

      // Resolve Category (Custom input box if visible & filled, else select dropdown)
      const customCatVal = draftCatCustom ? draftCatCustom.value.trim() : '';
      const isCustomVisible = draftCatCustom && !draftCatCustom.classList.contains('hidden');
      const selectedCatVal = draftCatSelect ? draftCatSelect.value : 'General';

      let category = 'General';
      if (isCustomVisible && customCatVal) {
        category = customCatVal;
      } else if (selectedCatVal === '__custom__') {
        category = customCatVal || 'General';
      } else {
        category = selectedCatVal;
      }

      // Automatically commit any pending tag typed in input box
      handleAddNewTag();

      // Resolve Tags from Tag Picker Set
      const tags = Array.from(selectedTagsSet);

      // Fix 3: Trim prompt body before saving
      const prompt = document.getElementById('draft-prompt').value.trim();

      // Fix 2: Validate blank/whitespace-only prompt body
      if (!prompt) {
        showToast('Prompt template cannot be empty.', 'error');
        return;
      }

      const variables = extractVariables(prompt);

      if (editingDraftId) {
        if (editingPromptIsDraft) {
          // Edit Mode for Local Draft
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
            closeDraftModal();
            activeCategory = category.toLowerCase();
            renderCategories();
            renderPrompts();
          }
        } else {
          // Edit Mode for Repository Prompt (Publish directly to GitHub)
          const submitBtn = draftForm.querySelector('button[type="submit"]');
          await publishRepoUpdateToGitHub(editingDraftId, title, description, category, tags, prompt, submitBtn);
        }
      } else {
        // Creation mode — Fix 6: collision-safe ID with random suffix
        const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
        closeDraftModal();
        activeCategory = category.toLowerCase();
        renderCategories();
        renderPrompts();
      }
    } finally {
      isSubmittingDraft = false;
    }
  });

  // Variable Inserter helper events
  const helperVarNameInput = document.getElementById('helper-var-name');
  const helperVarDefaultInput = document.getElementById('helper-var-default');
  const helperInsertBtn = document.getElementById('helper-insert-btn');
  // Fix 5: draftPromptTextarea re-declaration removed — module-level variable is used instead

  helperInsertBtn.addEventListener('click', () => {
    const varName = helperVarNameInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!varName) {
      showToast('Please enter a variable name!', 'error');
      return;
    }

    const defVal = helperVarDefaultInput.value.trim();
    const varString = defVal ? `{${varName}:${defVal}}` : `{${varName}}`;

    const startPos = draftPromptTextarea.selectionStart;
    const endPos = draftPromptTextarea.selectionEnd;
    const text = draftPromptTextarea.value;

    draftPromptTextarea.value = text.substring(0, startPos) + varString + text.substring(endPos);
    
    const newCursorPos = startPos + varString.length;
    draftPromptTextarea.focus();
    draftPromptTextarea.setSelectionRange(newCursorPos, newCursorPos);

    helperVarNameInput.value = '';
    helperVarDefaultInput.value = '';
  });
}

// Start App
document.addEventListener('DOMContentLoaded', init);
