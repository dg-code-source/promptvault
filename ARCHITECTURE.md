# PromptVault – System Architecture

This document describes how the system components connect, how data flows through the app, and why key architectural decisions were made.

For the *rationale* behind specific decisions, see [`design_decisions.md`](./design_decisions.md).

---

## Component Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                            │
│                                                                     │
│   prompts/*.md  ──► scripts/compile-prompts.py ──► prompts.json    │
│       (source)           (CI/CD pipeline)           (compiled)      │
│                                                                     │
│   .github/workflows/deploy.yml                                      │
│     1. python -m unittest discover                                   │
│     2. python scripts/compile-prompts.py                            │
│     3. actions/deploy-pages                                         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ GitHub Pages (HTTPS)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser / PWA                               │
│                                                                     │
│   sw.js (Service Worker)                                            │
│   ├── Cache-First fallback for: index.html, app.js, app.css,       │
│   │   manifest.json, icons                                          │
│   └── Network-First for: prompts.json (5s timeout)                 │
│                                                                     │
│   index.html ──► app.js ──► app.css                                │
│   (DOM shell)   (logic)    (styles)                                 │
│                                                                     │
│   app.js reads:                                                     │
│   ├── prompts.json  (network/cache via fetch)                       │
│   └── localStorage  (drafts, favorites, settings, copy counts)      │
│                                                                     │
│   app.js writes:                                                    │
│   ├── localStorage  (all client state)                              │
│   └── GitHub REST API  (publish/edit/delete prompts)               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Loading Prompts

```
User opens app
      │
      ▼
Service Worker intercepts fetch('./prompts.json')
      │
      ├── [Online] ──► Network fetch (5s timeout)
      │                    │
      │               [Success] ──► update cache ──► return response
      │               [Timeout/Error] ──► return cached version
      │
      └── [Offline] ──► return cached version
                             │
                        app.js: prompts = await response.json()
                             │
                        merge with localStorage drafts:
                        allPrompts = [...prompts, ...drafts]
                             │
                        renderCategories() + renderPrompts()
```

---

## Data Flow: Using a Prompt

```
User fills variable inputs on a card
      │
      ▼
copyBtn.onclick → compilePromptText(p.prompt, card)
      │
      ├── Reads each .variable-input value (or falls back to dataset.defaultVal)
      ├── Replaces {variable_name} tokens with user values
      └── Returns final compiled string
             │
             ▼
      copyToClipboard(finalPrompt)
      ├── [HTTPS/localhost] → navigator.clipboard.writeText()
      └── [HTTP fallback]  → off-screen textarea + execCommand('copy')
             │
             ▼
      navigator.vibrate(50)  [if hapticsEnabled]
      showToast('Prompt copied!', 'success')
      incrementCopyCount(p.id) → pv_copy_counts in localStorage
```

---

## Data Flow: Publishing a Draft to GitHub

```
User clicks "Publish" on a Draft card
      │
      ▼
publishDraftToGitHub(draft, btn)
      │
      ├── Guard: if !githubToken → show error toast + open Settings
      │
      ▼
Build markdown string:
  "---\ntitle: ...\n---\n\n{prompt body}"
      │
      ▼
Base64 encode (UTF-8 safe):
  btoa(unescape(encodeURIComponent(markdownContent)))
      │
      ▼
PUT https://api.github.com/repos/{owner}/{repo}/contents/prompts/{id}.md
  { message, content: encoded }
      │
      ├── [201 Created] ──► delete draft from pv_drafts
      │                      optimistic UI update (add to prompts[])
      │                      re-render cards
      │
      └── [Error] ──► show toast with HTTP status
```

---

## Data Flow: Editing a Published Prompt

```
User edits a prompt and saves
      │
      ▼
Fetch current sha:
  GET /repos/{owner}/{repo}/contents/prompts/{id}.md
      │
      ▼
PUT with sha + new encoded content
      │
      ├── [200 OK] ──► optimistically update prompts[] in memory
      │                 re-render cards (no page reload needed)
      │
      └── [409 Conflict] ──► stale sha; user must retry
```

---

## State Storage Map

| Data | Where | Key | Lifetime |
|------|-------|-----|----------|
| Remote prompts | `prompts.json` (GitHub Pages) | — | Until next push to `main` |
| Local drafts | `localStorage` | `pv_drafts` | Until published or deleted |
| Favorites | `localStorage` | `pv_favorites` | Persistent |
| Copy counts | `localStorage` | `pv_copy_counts` | Persistent |
| Haptics toggle | `localStorage` | `pv_haptics` | Persistent |
| GitHub PAT | `localStorage` | `pv_github_token` | Until cleared |
| Gemini API key | `localStorage` | `pv_gemini_key` | Until cleared |
| Fullscreen pref | `localStorage` | `pv_draft_fullscreen` | Persistent |
| In-memory prompts | `app.js` `prompts[]` | — | Page session only |

---

## Compilation Pipeline

```
prompts/*.md
     │
     ▼  scripts/compile-prompts.py
     │
     ├── Parse YAML frontmatter (title, description, category, tags)
     │   └── Fallback: H1 heading → title, first paragraph → description
     │
     ├── Extract prompt body
     │   └── If code block present: extract code block content
     │       Else: use remaining text after frontmatter
     │
     ├── Extract variables via regex: \{([a-zA-Z0-9_-]+)(?::([^}]+))?\}
     │   └── Deduplicate; last non-empty default wins
     │
     └── Output entry: { id, title, description, category, tags, prompt, variables }
          │
          ▼
     prompts.json (array of all entries)
```

---

## PWA Update Flow

```
User opens app (or returns to tab)
      │
      ▼
registerServiceWorker() → reg.update()
      │
      ▼ (background)
Browser compares sw.js byte-by-byte with cached version
      │
      ├── [Same] ──► nothing happens
      │
      └── [Changed] ──► new SW begins installing
                              │
                         installingWorker.statechange → 'installed'
                              │
                         if (navigator.serviceWorker.controller)
                              │
                         Show #update-banner
                              │
                         User clicks "Update Now"
                              │
                         newServiceWorker.postMessage({ action: 'skipWaiting' })
                              │
                         sw.js: self.skipWaiting()
                              │
                         controllerchange → window.location.reload()
```

---

## Technology Choices

| Decision | Choice | Reason |
|----------|--------|--------|
| Hosting | GitHub Pages | Free, HTTPS, auto-deploys from repo |
| Runtime framework | None (vanilla JS) | No build step, maximum simplicity |
| Dev server | Vite | Fast HMR for local development |
| Compiler language | Python | Available in GitHub Actions without setup |
| Storage | localStorage | No auth, no server, works offline |
| API integration | GitHub REST API | Direct from browser, no proxy needed |
| Styling | Vanilla CSS | No dependencies, full control |
| Testing | Python unittest | Built-in, no install, CI-friendly |
