# PWA LLM Prompt Manager: PromptVault

A lightweight, beautiful Progressive Web App (PWA) designed for Android (and iOS/Desktop) that stores and manages LLM prompts. The app is hosted on GitHub Pages and fetches prompts compiled from separate Markdown files in your GitHub repository.

## User Review Required

> [!IMPORTANT]
> **GitHub Pages Deployment Setup**:
> Once the files are committed to your GitHub repository, you will need to:
> 1. Go to your repository settings on GitHub.
> 2. Go to **Pages** (under Code and automation).
> 3. Under **Build and deployment**, set the Source to **GitHub Actions**.
> 4. The action we provide will automatically run, compile the prompts, and deploy the application.

> [!NOTE]
> **PWA Installation**:
> To install the app on your Android device:
> 1. Open your GitHub Pages URL in Google Chrome.
> 2. Tap the three-dot menu icon in the top right.
> 3. Select **Install app** or **Add to Home screen**.
> 4. It will appear on your app drawer and home screen just like a native app.

## Proposed Changes

We will create a lightweight project structure containing the front-end application code, a script to compile the markdown prompts, and a GitHub Action to deploy everything.

---

### App Foundation & PWA Configuration

#### [index.html](file:///c:/code/index.html)
- Main HTML structure.
- Includes meta tags for mobile optimization (viewport, theme color, Apple mobile app capability).
- Includes links to `manifest.json` and `app.css`.
- Basic structure:
  - Header: Logo, App Title, Settings (Gear Icon).
  - Search bar (filters title, description, and tags) and Category tabs (including a special **Favorites** tab).
  - Grid of prompt cards.
  - Toast notification container (placed at the top of the screen).
  - Settings Modal (toggles like "Vibrate on Copy").
  - Update notification banner for new app assets.

#### [app.css](file:///c:/code/app.css)
- Minimalist Light Mode theme using CSS variables.
- Warm charcoal accents (`#2c2c2c`), high contrast soft-gray backgrounds (`#f5f5f7`), and clean white cards (`#ffffff`).
- Sharp, clean borders (2px solid `#2c2c2c` or `#e0e0e0`) for a modern, flat-design look.
- Responsive grids and card layouts.
- Dynamic input styling for variables (text inputs and textareas) inside prompt cards.
- Micro-animations for hover effects, active card click states (scale down slightly), star/unstar transitions, and toast popups.

#### [app.js](file:///c:/code/app.js)
- Fetches `prompts.json` compiled from the markdown files.
- Handles rendering the search inputs and real-time filtering of prompts (matching title, description, tags, or category).
- Manages active category tabs to filter prompts by category, including a special **Favorites** tab.
- Extracts variables (formatted as `{variable}` or `{variable:default}`) from the prompt text:
  - Supports default values (e.g. `{count:3}`).
  - Auto-formats variable names for UI labels (e.g., `{target_language}` becomes "Target Language").
  - Renders `<textarea>` for long variables (names containing "text", "content", "document", "context") and `<input type="text">` for short variables.
- Renders a "Reset" button for inputs on each card, prompting the user for confirmation if they have typed text.
- Copies the finalized prompt (with variables substituted) to the clipboard when a card is clicked, triggering:
  - A short vibration (50ms) if the setting is enabled.
  - A toast notification at the top of the screen.
- Manages favorited prompts in `localStorage` (star/unstar toggle).
- Implements the Web Share API on the share button (sharing pure prompt text with no metadata).
- Registers the Service Worker (`sw.js`) and handles the update banner when a new version is detected.
- Detects online/offline status, auto-updates the prompt list when coming back online, and triggers a toast notification: "Prompts updated from GitHub".

#### [sw.js](file:///c:/code/sw.js)
- Service Worker for offline capabilities.
- Implements a network-first strategy for `prompts.json` (so updates are fetched immediately if online) and cache-first for static assets (`index.html`, `app.css`, `app.js`, manifest, and icons).
- Falls back to cached prompts if offline.
- Listens for `skipWaiting` message to activate new updates.

#### [manifest.json](file:///c:/code/manifest.json)
- PWA manifest file containing the application's configuration.
- Specifies app name, icons, start URL, background color, theme color, and display mode (`standalone`).

#### [icon.svg](file:///c:/code/icon.svg)
- An SVG-based app icon, ensuring high resolution and fast loading on Android devices.
- Manifest and HTML link tags will point to the SVG icon (supported by modern Android Chrome PWA).

---

### Category & Tag Selection with Custom Creation

#### [index.html](file:///c:/code/index.html)
- Replaced static category and tag text inputs in `#draft-form` with a dynamic category select dropdown (`#draft-cat-select`), custom category text input (`#draft-cat-custom`), and a tag chip picker container.

#### [app.css](file:///c:/code/app.css)
- Added styles for `.form-select`, `.tag-picker-container`, `.selected-tags-wrapper`, `.tag-chip`, `.tag-chip.active`, and `.tag-chip-remove`.

#### [app.js](file:///c:/code/app.js)
- Implemented `getAllCategories()` and `getAllTags()` to aggregate categories and normalized (lowercased/trimmed) tags from `prompts` and `drafts`.
- Implemented `populateCategorySelect()` to populate existing categories and toggle an inline text input when `+ Add New Category` is chosen.
- Implemented `renderTagPicker()` and `handleAddNewTag()` to display clickable tag chips, enable selecting/deselecting tags, and allow typing custom tag pills.
- Integrated category and tag picker pre-filling into prompt creation and editing modals.

---

### Prompt Management & Compiler Script

#### [package.json](file:///c:/code/package.json)
- Node project definition.
- Includes scripts for local development (`npm run dev` to launch Vite) and compilation (`npm run build`).
- Includes devDependencies for `vite` (local static file dev server).

#### [scripts/compile-prompts.js](file:///c:/code/scripts/compile-prompts.js)
- A Node.js build script that reads all `.md` files in the `prompts/` folder.
- Parses frontmatter if present (using a simple regex parser to avoid external dependencies) to read:
  - `title`: Name of the prompt.
  - `description`: Summary of what it does.
  - `category`: Category name.
  - `tags`: Comma-separated search tags.
- Fallback parsing: If no frontmatter is found, it extracts the first header as `title`, the subsequent paragraph as `description`, and the first code block as `prompt`.
- Extracts the first markdown code block (starting with ` ``` `) as the prompt body. If no code block is found, it treats everything after the frontmatter/description as the prompt body.
- Generates `prompts.json` and writes it to the root/public folder.

#### [prompts/summarizer.md](file:///c:/code/prompts/summarizer.md)
- Example prompt file showing frontmatter configuration and variables:
  ```markdown
  ---
  title: Text Summarizer
  description: Condenses long articles or text into key bullet points.
  category: Writing
  tags: writing, productivity
  ---
  
  Summarize the following text into exactly {count:3} bullet points:
  
  {text}
  ```

#### [prompts/translator.md](file:///c:/code/prompts/translator.md)
- Another example prompt file:
  ```markdown
  ---
  title: English to Spanish Translator
  description: Translates English text into conversational Spanish.
  category: Translation
  tags: languages, communication
  ---
  
  Translate the following English text to Spanish using a {tone:friendly} tone:
  
  {text}
  ```

---

### CI/CD Deployment

#### [.github/workflows/deploy.yml](file:///c:/code/.github/workflows/deploy.yml)
- GitHub Actions workflow triggering on pushes to `main`.
- Checks out the repository, installs Node.js, runs `npm install`, runs `npm run compile` to build `prompts.json`, and deploys the static files directly to GitHub Pages.

---

## Verification & Testing Plan

To ensure the application functions correctly, is installable, and is free of bugs, the following testing procedure will be executed:

### 1. Verification of the Markdown Compiler
We will run:
```bash
npm run compile
```
- **Validation**: Inspect `public/prompts.json` to ensure:
  - Valid JSON structure.
  - The script parses markdown frontmatter correctly (reads `title`, `description`, `category`, and `tags`).
  - Fallback logic works (if a markdown file has no frontmatter, H1 is title, next paragraph is description, code block is prompt).
  - Placeholders with default values are correctly identified and stored.
  - Using the markdown filename (without `.md`) as the unique `id` to prevent name collisions.

### 2. Local App Server Testing
We will launch a local development server using Vite:
```bash
npm run dev
```
- **Visual Validation**: Open `http://localhost:5173` in a desktop browser and inspect:
  - **Aesthetics**: Ensure minimalist light mode theme matches the high contrast, clean white/gray cards design.
  - **Responsive Design**: Resize the browser window to phone dimensions to verify card wrap and typography sizes.
  - **Search functionality**: Type terms in the search bar. Ensure matching operates on Title, Description, and Tags (excluding the prompt text itself).
  - **Tabs**: Click category tabs to ensure cards are filtered properly. Verify that favorited cards appear under the "Favorites" tab.
- **Dynamic Variable Forms**: Expand a card containing placeholders. Verify that single-line inputs and textareas are rendered correctly. Type values, click copy, and paste the output to verify placeholders are correctly substituted.
- **Accidental Clear Protection**: Click the "Reset" button on a modified prompt card. Verify that a confirmation dialog pops up before clearing the inputs.
- **Tactile Settings**: Check that the Gear icon opens the settings panel and that toggles (e.g. vibration toggle) save and load successfully from `localStorage`.
- **Clipboard & Share API**: Test clicking cards to copy. Test clicking the native share button (on a compatible mobile browser or simulated environment).

### 3. Service Worker & PWA Verification
- **Installation Check**: Inspect Chrome DevTools under the **Application** tab:
  - Verify that `manifest.json` is detected with correct name, display mode (`standalone`), start URL, and SVG icon.
  - Confirm the browser shows the install button/prompt in the URL bar (meaning the PWA meets installability criteria).
- **Offline Mode**: 
  - Toggle the **Offline** mode in the Chrome DevTools network tab.
  - Reload the page. Verify the application interface loads, cached static files serve correctly, and cached prompts are readable.
- **Online Refresh Notification**: 
  - Change connection back to online.
  - Verify that if `prompts.json` is updated, the app displays the toast: "Prompts updated from GitHub".
- **Asset Update Banner**:
  - Test modifying the service worker version hash and verify the PWA displays an "App Update Available" notification.
