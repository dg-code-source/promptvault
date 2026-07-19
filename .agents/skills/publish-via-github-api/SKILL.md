---
name: publish-via-github-api
description: >-
  Use this skill when the user wants to understand or debug the GitHub API integration
  in PromptVault: publishing a draft prompt, editing a published prompt, deleting a prompt,
  setting up a Personal Access Token, or troubleshooting API errors (401, 404, 409, 422).
---

# Skill: GitHub REST API Integration in PromptVault

PromptVault uses the GitHub Contents API to read, write, update, and delete prompt
markdown files directly in the repository from the browser — no backend required.

---

## Prerequisites

The user must configure a **GitHub Personal Access Token (PAT)** in Settings:
- Stored in `localStorage` as `pv_github_token`
- Required scope: `repo` (or `contents:write` for fine-grained tokens)
- The token is NEVER committed to git — it lives only in the user's browser

If no token is set, all API write operations trigger an error toast and auto-open the Settings modal.

---

## Repository Auto-Detection

`app.js` detects `repoOwner` and `repoName` at startup:
```js
let repoOwner = 'dg-code-source';  // fallback for local dev
let repoName = 'promptvault';
if (window.location.hostname.endsWith('github.io')) {
  repoOwner = window.location.hostname.split('.')[0];
  const paths = window.location.pathname.split('/').filter(p => p.length > 0);
  if (paths.length > 0) repoName = paths[0];
}
```

All API calls use:
```
https://api.github.com/repos/{repoOwner}/{repoName}/contents/prompts/{id}.md
```

---

## Operation 1: Publish a Draft

**Trigger:** User clicks "Publish" on a Draft card.

**Flow:**
1. Build markdown string with frontmatter + prompt body from draft object
2. Base64-encode the content (UTF-8 safe):
   ```js
   const encoded = btoa(unescape(encodeURIComponent(markdownContent)));
   ```
3. PUT request to GitHub Contents API:
   ```js
   fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/prompts/${id}.md`, {
     method: 'PUT',
     headers: {
       'Authorization': `token ${githubToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       message: `Add prompt: ${title}`,
       content: encoded
     })
   });
   ```
4. On success (201): delete local draft from `pv_drafts`, run optimistic UI update
5. On failure: show error toast with HTTP status

---

## Operation 2: Edit a Published Prompt

**Trigger:** User clicks Edit on a published (non-draft) card and saves changes.

**Flow:**
1. Fetch the file's current `sha` checksum — required by GitHub API for updates:
   ```js
   const metaRes = await fetch(
     `https://api.github.com/repos/${repoOwner}/${repoName}/contents/prompts/${id}.md`,
     { headers: { 'Authorization': `token ${githubToken}` } }
   );
   const meta = await metaRes.json();
   const sha = meta.sha;
   ```
2. Build new markdown content from edited form values
3. PUT request including the `sha`:
   ```js
   body: JSON.stringify({
     message: `Update prompt: ${title}`,
     content: encoded,
     sha: sha
   })
   ```
4. On success (200): apply optimistic local update to in-memory `prompts` array and re-render

**Important:** Without the correct `sha`, GitHub returns `409 Conflict`. Always fetch fresh `sha` immediately before the PUT — never cache it.

---

## Operation 3: Delete a Prompt

**Trigger:** User clicks the trash icon in the Edit modal header and confirms.

**Flow:**
1. Fetch current `sha` (same pattern as edit)
2. DELETE request:
   ```js
   fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/prompts/${id}.md`, {
     method: 'DELETE',
     headers: { 'Authorization': `token ${githubToken}`, 'Content-Type': 'application/json' },
     body: JSON.stringify({ message: `Delete prompt: ${id}`, sha: sha })
   })
   ```
3. On success: optimistically remove from `prompts` array and re-render
4. If the prompt was a local draft: remove from `pv_drafts` instead (no API call needed)

---

## Optimistic Updates

GitHub Actions takes ~30 seconds to recompile and redeploy. To avoid users seeing
stale data, `app.js` applies updates immediately to the **in-memory** `prompts` array
after a successful API call, then calls `renderPrompts()`.

This in-memory state is reset on the next `loadPrompts()` call (Force Sync or page reload).

---

## API Error Reference

| HTTP Status | Meaning | Fix |
|-------------|---------|-----|
| `401 Unauthorized` | Invalid or missing PAT | Re-enter token in Settings |
| `403 Forbidden` | Token lacks `repo` scope | Generate a new PAT with correct scope |
| `404 Not Found` | File doesn't exist / wrong repo | Check `repoOwner` and `repoName` auto-detection; verify file exists |
| `409 Conflict` | Wrong `sha` on PUT/DELETE | Fetch fresh `sha` before writing; the file may have been updated by another commit |
| `422 Unprocessable` | Invalid request body | Check Base64 encoding and JSON structure |

---

## Debugging API Calls

1. Open DevTools → Network → filter for `api.github.com`
2. Check the request payload (should have `message`, `content`, and `sha` for updates)
3. Check the response body — GitHub API errors include a descriptive `message` field
4. Verify the token scope at: https://github.com/settings/tokens

---

## Security Notes

- The PAT is stored in plain text in `localStorage` — remind users never to use a token with more than `repo` or `contents:write` scope
- The token is sent as an `Authorization: token <PAT>` header — only visible in DevTools on the user's own device
- Never log `githubToken` to the console or include it in error messages shown to users
