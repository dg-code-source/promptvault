# PromptVault: Technical Design Specifications & Decisions Log

This document records the architectural blueprints, technical specifications, and key design decisions made during the design and implementation of **PromptVault**.

---

## 1. Core Architecture

* **Hosting & Distribution**: Progressive Web App (PWA) hosted on **GitHub Pages**. This allows instant installation on Android (via Chrome's "Add to Home Screen") without building or sideloading APK files. Updates deploy instantly when code or data is pushed.
* **Storage Model**: **GitHub-only as the Single Source of Truth**. Prompts are managed as individual Markdown files inside the `prompts/` folder on GitHub. This allows secure, passwordless client-side reading, avoiding complex authentication/database setups and rate-limiting issues.
* **Compilation Pipeline**: A lightweight **Python compiler script** (`scripts/compile-prompts.py`) runs locally or inside a **GitHub Actions CI/CD workflow** on push. It scans the `prompts/` folder, parses markdown metadata/content, and outputs a unified `prompts.json` index file.

---

## 2. Front-End & UI/UX Specifications

* **Design Theme**: **Minimalist Light Mode**.
  - Background: High-contrast soft gray (`#f5f5f7`).
  - Cards: Crisp white (`#ffffff`) with sharp charcoal borders (2px solid `#2c2c2c`).
  - Typography: `Outfit` for UI text; `JetBrains Mono` for prompt text previews.
* **Real-time Search**: Matches input queries against prompt **titles, descriptions, and tags** (excludes the prompt body text to prevent cluttering results with unrelated keywords).
* **Category Tabs**: Displays dynamically generated filter buttons for each prompt category. Includes a pinned **Favorites** tab.
* **Starring (Favorites)**: Users can toggle a star icon on cards. Starred prompts persist locally in the browser's `localStorage` and are pinned to the Favorites tab.

---

## 3. Advanced Mobile & Clipboard Optimizations

* **Top-Aligned Toasts**: Success toasts (e.g. "Prompt copied!") are positioned at the **top** of the screen. This prevents overlap/stacking with the native Android 13+ clipboard confirmation popup (which appears at the bottom-left of the screen).
* **Robust Clipboard Fallback**: The Clipboard API (`navigator.clipboard`) is restricted to HTTPS/localhost in modern browsers. To prevent copy failures when testing locally on HTTP (like Wi-Fi network IPs), the app automatically falls back to an off-screen `<textarea>` and `document.execCommand('copy')` if `navigator.clipboard` is unavailable.
* **Haptic Settings & Vibration**: Copies trigger a short 50ms pulse `navigator.vibrate(50)`. This can be toggled on/off in the settings panel (saved in `localStorage` as `pv_haptics`) and is wrapped in feature-detection checks to prevent console errors on iOS/Safari (which do not support the Vibration API).
* **Accidental Clear Protection**: Card inputs contain a "Reset" button. If the user has typed text, clicking reset triggers a confirmation popup to prevent accidental data loss.

---

## 4. Prompt Templating & Variable Parsing Rules

* **Syntax**: Support placeholders in the format `{variable_name}` or `{variable_name:default_value}`.
* **Parsing Regular Expression**: `/\{([a-zA-Z0-9_-]+)(?::([^}]+))?\}/g` (in JavaScript) and `\{([a-zA-Z0-9_-]+)(?::([^}]+))?\}` (in Python). This allows variable names to contain letters, numbers, dashes, and underscores, while supporting default values containing spaces (e.g., `{tone:professional and friendly}`).
* **Form Field Generation**:
  - Variable labels are formatted from snake_case/dashes into user-friendly Title Case (e.g. `{target_language}` -> "Target Language").
  - Variable inputs render as a `<textarea>` if the variable name contains words like "text", "content", "document", "context", or "message". Otherwise, they render as a single-line `<input type="text">`.
* **Markdown Parser Fallbacks**:
  - The compiler parses standard markdown frontmatter (keys: `title`, `description`, `category`, `tags`).
  - If a file does not have frontmatter, the compiler falls back to parsing:
    - First header (`#` or `##`) as `title`.
    - First non-empty paragraph as `description`.
    - First code block (triple backticks) as `prompt`.
  - If no code block is found anywhere, it falls back to using all remaining document text as the prompt body.
  - Unique keys are mapped to the markdown file's **filename** (without `.md`) to prevent collisions if titles are identical.

---

## 5. PWA Caching & Synchronization

* **Offline Assets**: The Service Worker (`sw.js`) caches the core app shell files (`index.html`, `app.css`, `app.js`, `manifest.json`, `icon.svg`) using a **Cache-First** strategy.
* **Sticky Cache Prevention**: The Service Worker intercepts requests for `prompts.json` using a **Network-First** strategy. It fetches the latest file from GitHub when online and falls back to cached data only when offline.
* **Force Sync Button**: In settings, a "Force Sync" button fetches the index file with a cash-busting query parameter (`?t=Timestamp`) and updates local cache.
* **Network Listener**: The app monitors connection status (`window.addEventListener('online')`). When connection returns, it automatically refetches the latest prompts and displays a toast notification: "Connection restored. Prompts synced!".
* **Asset Update Notifications**: The Service Worker listens for new registrations. If a code/style change is made, the app displays a banner: "App update available! [Update Now]". Clicking it triggers a `skipWaiting` command to instantly activate the new version.
