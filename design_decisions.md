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
* **Flex Wrapping on Action Buttons**: Local draft cards render up to 5 action buttons. To prevent layout truncation and horizontal overflow on narrow Android viewports, `.card-actions` has `flex-wrap: wrap` enabled so buttons wrap cleanly on small screens.
* **Full-Width Variable Inputs**: Card variable inputs (`.variable-input`) are styled with `width: 100%` to ensure they span the full width of the card and do not overflow boundaries.

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

---

## 6. Local Drafts & Mobile Git Sync Workflow

* **Problem Statement**: Modifying or writing markdown files with frontmatter formatting directly on a mobile keyboard is prone to typos and syntax errors.
* **Solution (Local Drafts)**: Users can create temporary "Draft" prompts directly inside the app, which are stored in the browser's `localStorage` as `pv_drafts`.
* **Merged State Management**: When the app loads, it merges local drafts with the remote prompts list:
  ```javascript
  const allPrompts = [...prompts, ...drafts];
  ```
  This allows drafts to inherit all UI features (real-time filtering, search, variable form rendering, clipboard copy, haptic settings) automatically.
* **Draft Card Custom Actions**:
  - **Draft Badge**: Draft cards render a red `DRAFT` label to visually distinguish them.
  - **Publish**: Integrates directly with the GitHub REST API using a user-configured Personal Access Token stored locally. Encodes the markdown file in Base64 (UTF-8 safe) and performs a PUT request to save the file in the repository's `prompts/` directory. Once published, it automatically deletes the local draft card.
  - **Edit Draft**: Tapping the Edit button (Pencil icon) pre-fills the creation modal, switches it to "Edit Prompt Draft" mode, and saves modifications back to the `localStorage` drafts array upon form submission.
  - **Copy MD**: Formats the draft's title, description, category, tags, and prompt body into a standard Markdown frontmatter text string, copying it to the clipboard. The user can paste this directly when creating a new file in the GitHub app.
  - **Delete Draft**: Tapping the trash icon deletes the draft from `localStorage` once the compiled version is pushed and synced from GitHub Pages.
* **Editing Published Repository Prompts**: Published repository prompts also render the Edit button (Pencil icon). When modified, the app queries the current file metadata from the GitHub REST API to fetch its latest `sha` checksum, builds the overwritten Markdown text, and submits a PUT request to update the file on GitHub.
* **Optimistic Local Updates**: Since GitHub Actions deployment takes ~30 seconds to compile, the app performs an "optimistic update" locally inside browser memory immediately upon a successful API write. This ensures the user sees their changes in the UI instantly, without having to wait for the next sync cycle.
* **Template Variable Inserter Helper**: Typing braces and colons (e.g. `{tone:professional}`) is highly frustrating on mobile keyboards. The draft modal contains a "Var Name" and optional "Default" input helper row. Clicking "Insert" uses text selection ranges (`selectionStart`/`selectionEnd`) to splice the properly formatted placeholder exactly where the user's cursor is placed inside the prompt template textarea, automatically restoring cursor focus afterward.

---

## 7. Dynamic Category & Tag Selection with Custom Creation

* **Category Dropdown + Custom Creation**: Category field in prompt edit/create form presents a `<select>` dropdown pre-filled with all existing categories across prompts + local drafts, alongside an `+ Add New Category` option that conditionally reveals a text input field for custom category names.
* **Interactive Tag Chip Picker**: Existing tags across all prompts and drafts are normalized to lowercase and displayed as clickable pill chips (`.tag-chip`). Clicking a chip toggles selection.
* **Inline Custom Tag Input**: Users can type custom tags into an inline text field (supporting comma-separated entries and `Enter` key) to create and select new tag pills dynamically.
* **GitHub Sync Integration**: Categories and tags are saved as metadata on prompt frontmatter/draft objects. Using "Force Sync from GitHub" re-fetches `prompts.json`, dynamically updating available categories and tags app-wide.

---

## 8. Prompt Deletion via Edit Modal

* **Top-Left Header Placement**: Prompt deletion is accessible via a red trash icon (`#draft-delete-btn`) positioned at the top-left of the Edit Modal header for all prompts (both local drafts and published repository prompts). This placement avoids accidental deletions while keeping UX consistent.
* **Confirmation Dialog**: Clicking the delete button prompts the user for confirmation (`confirm(...)`) before executing the destructive deletion.
* **GitHub REST API Deletion**: Deleting a published repository prompt fetches the file's current `sha` checksum from GitHub API and issues a `DELETE` request (`/repos/{owner}/{repo}/contents/prompts/{id}.md`).
* **Token Guard**: If no Personal Access Token is configured in local settings, deletion requests trigger an error toast and automatically open the Settings modal.
* **Optimistic Removal**: Upon successful API response, the prompt is optimistically filtered out from in-memory arrays and re-rendered immediately.


