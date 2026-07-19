---
name: debug-pwa-cache
description: >-
  Use this skill when the user reports stale content being shown after a deploy,
  the app not updating on mobile, Service Worker issues, prompts not refreshing,
  the "App update available" banner not appearing, or any PWA caching/offline problem.
---

# Skill: Debug PWA Caching & Service Worker Issues

PromptVault uses a Service Worker (`sw.js`) with a specific caching strategy. Most
"content is stale" or "update not showing" issues trace back to the cache version,
the caching strategy, or the update notification flow.

---

## Caching Architecture

```
sw.js
├── CACHE_NAME = 'promptvault-cache-v1.x.x'   ← version string
├── STATIC_ASSETS = [index.html, app.css, app.js, manifest.json, icons]
│   └── Strategy: Network-First with 5s timeout, falls back to cache
└── DYNAMIC_CACHE_URL = 'prompts.json'
    └── Strategy: Network-First with 5s timeout, falls back to cache
```

Both static assets AND `prompts.json` use **Network-First** — the app always tries
the network first, caching the successful response, and falls back to cached data only
when offline.

---

## Diagnostic Checklist

Work through these in order:

### 1. Is the cache version stale?

Open `sw.js` and check:
```js
const CACHE_NAME = 'promptvault-cache-v1.x.x';
```
If `app.js`, `app.css`, `index.html`, or `sw.js` changed but `CACHE_NAME` was NOT bumped,
the browser will continue serving the old cached version indefinitely.

**Fix:** Increment the version (e.g. `v1.2.3` → `v1.2.4`), commit, and push.

---

### 2. Is the "App update available" banner working?

The update flow in `app.js`:
1. `registerServiceWorker()` calls `reg.update()` on load and on `visibilitychange`
2. When a new SW installs, `updatefound` → `statechange` fires
3. If `navigator.serviceWorker.controller` exists (not first install), `updateBanner` is shown
4. User clicks "Update Now" → `newServiceWorker.postMessage({ action: 'skipWaiting' })` → page reloads

**Debugging:**
- Open DevTools → Application → Service Workers
- Check "Update on reload" for dev testing
- Check that `#update-banner` and `#update-btn` exist in `index.html`
- Verify `skipWaiting` is handled in `sw.js`:
  ```js
  self.addEventListener('message', event => {
    if (event.data && event.data.action === 'skipWaiting') {
      self.skipWaiting();
    }
  });
  ```

---

### 3. Is `prompts.json` being served stale?

The Force Sync button appends a cache-busting timestamp:
```js
const url = forceFetch ? `./prompts.json?t=${Date.now()}` : './prompts.json';
```

**Debugging:**
- Open DevTools → Network tab → filter for `prompts.json`
- Check response headers: `cache-control` and `etag`
- GitHub Pages sets `cache-control: max-age=600` — content may be up to 10 minutes stale via HTTP cache alone, even before the SW cache
- After Force Sync, verify the updated data appears

---

### 4. Is the app truly offline-capable?

Test offline mode:
1. DevTools → Network → Offline
2. Reload the page
3. The app should load from cache (static assets) and show the last-synced prompts

If the app shows a blank page offline:
- The `STATIC_ASSETS` list in `sw.js` may be missing a file
- The SW may not have installed/activated yet (first visit)
- Check DevTools → Application → Cache Storage → `promptvault-cache-vX.X.X`

---

### 5. Is the connection-restored auto-sync working?

`app.js` listens for:
```js
window.addEventListener('online', async () => {
  await loadPrompts(true);
  showToast('Connection restored. Prompts synced!', 'success');
});
```

If this toast is not appearing after going back online, verify the `online` event listener
is set up inside `setupEventListeners()`.

---

## Common Fixes

| Symptom | Fix |
|---------|-----|
| Old JS/CSS served after deploy | Bump `CACHE_NAME` in `sw.js` |
| Update banner never appears | Check `updatefound` listener in `registerServiceWorker()` |
| Prompts.json always stale | Use Force Sync button; check GitHub Pages CDN delay (~10 min) |
| App blank when offline | Check `STATIC_ASSETS` list includes all needed files |
| SW won't install in dev | Must be served from `localhost` or HTTPS |
| `navigator.clipboard` fails | Expected on HTTP (non-localhost); fallback textarea path kicks in |

---

## When Modifying sw.js

- Always bump `CACHE_NAME` — this is the only mechanism that forces cache invalidation
- Never remove the `FETCH_TIMEOUT` (5000ms) — it prevents the app from hanging on slow connections
- Always test both the online and offline paths after any SW change
- The SW file itself is NOT cached by the SW (browsers update sw.js independently, byte-by-byte)
