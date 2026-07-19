---
name: modify-app-feature
description: >-
  Use this skill when the user wants to add a new feature, modify existing behaviour,
  or fix a bug in the PromptVault frontend. Covers how to safely edit app.js, index.html,
  and app.css while respecting the single-file architecture and mobile-first constraints.
---

# Skill: Modify a PromptVault Frontend Feature

PromptVault is a **single-file-per-concern** app: all logic lives in `app.js` (~1900 lines),
all styles in `app.css`, all structure in `index.html`. This skill ensures changes are made
consistently and safely.

---

## Architecture Map

```
index.html   — DOM structure, all element IDs, modal scaffolding, meta/PWA tags
app.js       — All state, event listeners, rendering, GitHub API calls, localStorage I/O
app.css      — All visual styles, CSS custom properties, animations, responsive rules
sw.js        — Service Worker: caching strategy (do NOT touch unless changing cache behaviour)
```

---

## Before Making Any Change

1. **Read `design_decisions.md`** — it is the authoritative record of every architectural and UX decision. Many "obvious" changes have already been explicitly decided against.
2. **Grep for the affected area** in `app.js` before adding new code — the function you need likely already exists.
3. **Check the existing DOM IDs** in `index.html` before adding new elements — `app.js` grabs references at the top of the file.

---

## Step-by-Step: Adding a New Feature

### 1. Add DOM Structure to `index.html`
- Give every interactive element a unique, descriptive `id` attribute (required by the test suite)
- Follow existing modal patterns for overlays: `<div id="foo-modal">` + `<div id="foo-overlay">`
- Keep semantic HTML — use `<button>`, `<section>`, `<nav>` appropriately

### 2. Cache the DOM Reference in `app.js`
All element references are declared at the top of `app.js`:
```js
// Add alongside existing declarations
const myNewBtn = document.getElementById('my-new-btn');
```

### 3. Add State Variables (if needed)
State variables are declared at the very top of `app.js`, above `init()`:
```js
let myFeatureState = false;
```
If the state should persist across sessions, use `localStorage`:
```js
let myFeatureState = localStorage.getItem('pv_my_feature') === 'true';
```
And register the key in `CLAUDE.md` localStorage table.

### 4. Write the Feature Logic
- Place new functions near related existing ones (search for similar operations)
- Follow the existing pattern for toasts: `showToast('Message', 'success'|'error'|'info')`
- Follow the existing pattern for haptics: `if (hapticsEnabled && navigator.vibrate) navigator.vibrate(50);`

### 5. Register Event Listeners
Event listeners are set up inside `setupEventListeners()`. Add yours there:
```js
myNewBtn.addEventListener('click', () => {
  // handler
});
```

### 6. Add CSS in `app.css`
- Add new rules at the bottom of the relevant section (search for nearby selectors)
- Use existing CSS custom properties: `var(--color-primary)`, `var(--radius)`, etc.
- All new UI must be mobile-first — test at 375px width mentally
- Avoid fixed pixel widths on cards and modals; use `%`, `vw`, `max-width`

---

## Mobile-First Rules (Critical)

These constraints come from `design_decisions.md` and must never be violated:

- **Toast positioning**: New toasts must appear at the **top** of screen (`top: env(safe-area-inset-top, 16px)`), never bottom — bottom overlaps Android clipboard popup
- **Clipboard**: Always use the fallback pattern:
  ```js
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  } else {
    // fallback: off-screen textarea + execCommand('copy')
  }
  ```
- **Vibration**: Always guard with `if (hapticsEnabled && navigator.vibrate)`
- **Button wrapping**: Card action rows use `flex-wrap: wrap` — do not set `overflow: hidden` or `white-space: nowrap` on `.card-actions`
- **Variable inputs**: Use `width: 100%` on `.variable-input` — never constrain with fixed widths

---

## Testing Your Change

1. Run the test suite — HTML structure tests will catch missing IDs:
   ```bash
   python -m unittest discover -s tests -p "test_*.py"
   ```
2. If you added a new element ID that `app.js` references, add it to `tests/test_html_structure.py`
3. If you added a new `localStorage` key, add it to `tests/test_js_app_logic.py`
4. Start the dev server and test on a mobile viewport (Chrome DevTools → 375px):
   ```bash
   npm run dev
   ```

---

## Service Worker Cache Invalidation

If you modified `app.js`, `app.css`, `index.html`, or `sw.js`, bump the cache version in `sw.js`:
```js
// Before:
const CACHE_NAME = 'promptvault-cache-v1.2.3';
// After: increment the patch version
const CACHE_NAME = 'promptvault-cache-v1.2.4';
```
This forces all existing users to download the updated files on next visit.
