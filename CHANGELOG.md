# Changelog

All notable changes to PromptVault are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [v1.2.4] – 2026-07-19

### Fixed
- **Gemini API model updated** — replaced deprecated `gemini-1.5-flash` (retired from `v1beta`) with `gemini-3.5-flash`. The "Run AI" button now works without a 404 error.

### Changed
- Service Worker cache bumped to `promptvault-cache-v1.2.4` to force a clean reload for all existing users.
- Version badge in the app header and settings footer updated to `v1.2.4`.

### Added
- `icon-192.png` and `icon-512.png` PNG icons added to `manifest.json` for broader PWA compatibility (some Android launchers require raster icons).
- `ARCHITECTURE.md` — detailed system architecture, data flow diagrams, and technology choices.
- `CONTRIBUTING.md` — guide for adding prompts and contributing code.
- `README.md` — project overview, quickstart, and documentation index.
- `SECURITY.md` — security model, token scoping recommendations, and vulnerability reporting policy.
- `CHANGELOG.md` — this file.
- `CODE_OF_CONDUCT.md` — community standards.

---

## [v1.2.3] – 2026-07-19

### Added
- **Fullscreen Editor Mode** — expand/minimize toggle (`#draft-expand-btn`) in the draft modal header; preference persists in `localStorage` as `pv_draft_fullscreen`.
- **Prompt Duplication** — one-tap Duplicate button on all prompt cards spawns a pre-filled new draft (`"Copy of ..."`).
- **Copy Count Tracking** — `incrementCopyCount()` updates `pv_copy_counts` in `localStorage`; a copy badge `📋 X` is shown next to card titles.
- **Sort Pills** — `Default`, `🔥 Most Copied`, and `A-Z` pill buttons below category tabs for 1-tap sorting.
- **Live Markdown Preview** — `renderMarkdown()` parser for headers, bold, italic, code, lists; toggle between `Code` / `Preview` on cards and `Edit Code` / `Preview Markdown` tabs in the editor modal.
- **Inside-App Gemini AI Runner** — `⚡ Run AI` button on cards; sends compiled prompt to Gemini REST API and renders response live in `#ai-runner-modal`.

### Changed
- Settings modal is now always fullscreen (`100vw × 100vh`) on all screen sizes.
- Toast notifications remain at the top of the screen (prevents overlap with Android clipboard popup).

### Fixed
- Clipboard fallback for HTTP origins (Wi-Fi IP testing) using `execCommand('copy')`.
- Card action buttons wrap on narrow Android viewports via `flex-wrap: wrap` on `.card-actions`.

---

## [v1.2.0] – 2026-07-19

### Added
- **Prompt Deletion** — red trash icon in the Edit Modal header deletes both local drafts and published repository prompts via GitHub REST API `DELETE`.
- **Confirmation Dialog** on destructive actions (delete, reset variable inputs).
- **Optimistic Local Updates** — UI reflects publish/edit/delete changes immediately without waiting for CI/CD redeployment.
- **Edit Published Prompts** — pencil icon on repository prompt cards fetches the current `sha` and submits a `PUT` to update the file on GitHub.

---

## [v1.1.0] – 2026-07-19

### Added
- **Local Drafts** — create, edit, and manage prompt drafts stored in `localStorage` (`pv_drafts`).
- **Publish to GitHub** — PUT request to GitHub REST API using a user-configured Personal Access Token to push draft markdown files to `prompts/`.
- **Copy MD** — formats a draft as markdown frontmatter and copies to clipboard for pasting in GitHub's file editor.
- **Template Variable Inserter** — "Var Name" + "Default" helper row in the draft modal inserts `{var:default}` at the cursor position.
- **Dynamic Category Dropdown** — select from existing categories or create a new one inline.
- **Interactive Tag Chip Picker** — clickable tag pills aggregated from all prompts and drafts; supports custom inline tag input.

---

## [v1.0.0] – 2026-07-19

### Added
- Initial release of PromptVault as a PWA hosted on GitHub Pages.
- **Prompt Library** — browse, search, and filter prompts by category or tag from `prompts.json`.
- **Variable Templates** — `{variable}` and `{variable:default}` placeholders render as input fields on cards.
- **Favorites** — star/unstar prompts; persisted in `localStorage` (`pv_favorites`); pinned **Favorites** tab.
- **Real-time Search** — filters on title, description, and tags (not prompt body).
- **Offline Support** — Service Worker with Cache-First for static assets, Network-First for `prompts.json`.
- **Haptic Feedback** — 50ms vibration on copy; toggleable in Settings; guarded by feature detection.
- **Top-Aligned Toasts** — success/error/info notifications at top of screen to avoid Android clipboard popup.
- **PWA Install** — installable on Android via Chrome "Add to Home Screen"; standalone display mode.
- **Auto-Sync** — refetches `prompts.json` when the device comes back online.
- **App Update Banner** — detects new Service Worker and prompts users to reload with "Update Now".
- **Force Sync** — manually re-fetch `prompts.json` with a cache-busting query parameter.
- **Python Compiler** (`scripts/compile-prompts.py`) — converts `prompts/*.md` to `prompts.json`.
- **GitHub Actions CI/CD** — runs tests, compiles prompts, deploys to GitHub Pages on push to `main`.
- **Test Suite** — Python `unittest` covering compiler logic, HTML structure, and JS app logic.
