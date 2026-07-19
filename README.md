# PromptVault

A minimalist **Progressive Web App (PWA)** for managing and using LLM prompt templates. Installable on Android, iOS, and desktop. No backend required — hosted entirely on GitHub Pages.

![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa)
![GitHub Pages](https://img.shields.io/badge/hosted-GitHub%20Pages-0078D4?logo=github)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Prompt Library** — browse, search, and filter prompts by category or tag
- **Variable Templates** — `{variable}` and `{variable:default}` placeholders auto-render into input fields
- **Favorites** — star prompts; they persist across sessions via `localStorage`
- **Local Drafts** — create prompts in-app without a keyboard or file manager
- **Publish to GitHub** — push drafts directly to the repo via GitHub REST API
- **Offline Support** — Service Worker caches the app shell; works without internet
- **AI Runner** — run any prompt against Google Gemini API directly inside the app
- **Sort & Copy Tracking** — sort by most-copied or alphabetically; copy counts are tracked locally
- **Markdown Preview** — toggle between raw template view and rendered Markdown on every card
- **Duplication** — clone any prompt as a local draft with one tap

---

## Quick Start

### 1. Deploy to GitHub Pages

Fork this repository, then:

1. Go to **Settings → Pages → Build and deployment**
2. Set **Source** to **GitHub Actions**
3. Push any commit to `main` — the CI pipeline will automatically:
   - Run the test suite
   - Compile `prompts/*.md` → `prompts.json`
   - Deploy to `https://<your-username>.github.io/promptvault/`

### 2. Install as a PWA (Android)

1. Open the GitHub Pages URL in **Chrome for Android**
2. Tap the **three-dot menu → Install app** (or "Add to Home Screen")
3. The app appears in your app drawer like a native app

### 3. Add Your First Prompt

Create a new file in `prompts/` using this format:

```markdown
---
title: My Prompt Title
description: What this prompt does in one sentence.
category: Productivity
tags: writing, ai
---

Write a {tone:professional} email about {topic}.
```

Then commit and push — the CI pipeline handles the rest.

---

## Local Development

```bash
# Install dev dependencies (Vite only)
npm install

# Start dev server at http://localhost:5173
npm run dev

# Compile prompts manually
npm run compile

# Run tests
npm test
```

---

## Project Structure

```
promptvault/
├── index.html              # App shell (all DOM structure)
├── app.js                  # All application logic
├── app.css                 # All styles
├── sw.js                   # Service Worker
├── manifest.json           # PWA manifest
├── prompts.json            # Auto-generated — do not edit manually
├── prompts/                # Prompt source files (*.md) — edit these
├── scripts/
│   ├── compile-prompts.py  # Markdown → prompts.json compiler (used by CI)
│   └── compile-prompts.js  # Node.js equivalent
├── tests/                  # Python unittest suite
└── .github/workflows/
    └── deploy.yml          # CI/CD: test → compile → deploy
```

---

## Settings

Access the gear icon (⚙️) in the app header to configure:

| Setting | Description |
|---------|-------------|
| **GitHub Token** | Personal Access Token for publishing drafts to GitHub |
| **Gemini API Key** | Google AI Studio key for in-app AI prompt execution |
| **Haptic Feedback** | Toggle vibration on copy (Android) |
| **Force Sync** | Re-fetch `prompts.json` bypassing cache |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`design_decisions.md`](./design_decisions.md) | Authoritative log of all architectural and UX decisions |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System architecture, data flow, and component diagram |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | How to add prompts or contribute code |
| [`SECURITY.md`](./SECURITY.md) | Security model for tokens and sensitive data |
| [`CHANGELOG.md`](./CHANGELOG.md) | Feature history and release notes |
| [`prompt_template.md`](./prompt_template.md) | Blank starter template for new prompts |

---

## License

MIT
