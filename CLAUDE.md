# PromptVault – Project Guide for AI Assistants

## Project Overview

**PromptVault** is a minimalist PWA (Progressive Web App) for managing LLM prompt templates. It is hosted on **GitHub Pages**, requires no backend server, and is installable as an Android app via Chrome's "Add to Home Screen".

**Tech Stack:**
- **Frontend:** Vanilla HTML, CSS (no framework), plain JavaScript (no bundler for runtime code)
- **Build Tool:** Vite (dev server + production bundler, defined in `package.json`)
- **Compiler:** Python 3 script (`scripts/compile-prompts.py`) that converts `prompts/*.md` → `prompts.json`
- **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`) — runs tests, compiles prompts, deploys to GitHub Pages
- **Offline Support:** Service Worker (`sw.js`) with Cache-First for static assets and Network-First for `prompts.json`

---

## Repository Layout

```
/
├── index.html              # Single-page app shell; all UI structure
├── app.js                  # All application logic (~1900 lines)
├── app.css                 # All styles (light mode, card grid, modals, animations)
├── sw.js                   # Service Worker (caching + offline support)
├── manifest.json           # PWA manifest (icons, theme color, display mode)
├── prompt_template.md      # Starter template for new prompt files
├── prompts.json            # COMPILED output — do NOT edit manually
├── prompts/                # Source prompt Markdown files (source of truth)
├── scripts/
│   ├── compile-prompts.py  # Python: Markdown → prompts.json compiler
│   └── compile-prompts.js  # JS equivalent of compiler (for local Node use)
├── tests/                  # Python unittest suite
│   ├── test_compile_prompts.py
│   ├── test_html_structure.py
│   └── test_js_app_logic.py
├── .github/workflows/
│   └── deploy.yml          # CI: test → compile → deploy to GitHub Pages
└── design_decisions.md     # Authoritative technical design decisions log
```

---

## Core Principles & Constraints

1. **No Backend** — All data lives in `prompts.json` (read-only) and `localStorage` (drafts, settings).
2. **No External JS Dependencies at Runtime** — `app.js` uses zero npm imports; Vite is for dev server only.
3. **`prompts.json` is auto-generated** — Never edit `prompts.json` by hand. Always edit `.md` files in `prompts/` and run the compiler.
4. **Single-File Architecture** — Logic in `app.js`, styles in `app.css`, structure in `index.html`. Do not introduce component files or split into modules without discussion.
5. **GitHub as Storage** — Publishing a prompt sends it to GitHub via REST API using the user's Personal Access Token stored in `localStorage`.

---

## localStorage Keys Reference

| Key | Type | Purpose |
|-----|------|---------|
| `pv_drafts` | JSON array | Local prompt drafts |
| `pv_favorites` | JSON array | Starred prompt IDs |
| `pv_copy_counts` | JSON object | `{id: count}` copy statistics |
| `pv_haptics` | string `'true'/'false'` | Vibration toggle |
| `pv_github_token` | string | GitHub Personal Access Token |
| `pv_gemini_key` | string | Google Gemini API key |
| `pv_draft_fullscreen` | string `'true'/'false'` | Editor modal fullscreen preference |

---

## Common Development Commands

```bash
# Start dev server
npm run dev

# Compile prompts (Markdown → prompts.json)
npm run compile
# or
python scripts/compile-prompts.py

# Run all tests
npm test
# or
python -m unittest discover -s tests -p "test_*.py"

# Production build
npm run build
```

---

## GitHub Auto-Detection

`app.js` auto-detects the GitHub repo owner and name from `window.location.hostname` when deployed to `github.io`. The fallback dev values are:
```js
let repoOwner = 'dg-code-source';
let repoName = 'promptvault';
```

---

## Key Design Decisions

See `design_decisions.md` for the full, authoritative record of every architectural and UX decision. Always read it before making changes that could affect:
- Prompt parsing/variable syntax
- Clipboard handling
- PWA caching strategy
- Draft lifecycle (create → publish → delete)
- Mobile layout and toast positioning

---

## What NOT to Do

- Do NOT introduce React, Vue, or any frontend framework
- Do NOT add npm runtime dependencies (Vite is dev-only)
- Do NOT manually edit `prompts.json`
- Do NOT change the variable placeholder syntax `{name:default}` without updating both `app.js` regex AND `compile-prompts.py` regex simultaneously
- Do NOT store sensitive credentials anywhere other than `localStorage` (never commit tokens to git)
- Do NOT break the offline-first caching — always maintain Service Worker compatibility
